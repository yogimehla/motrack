import type { IncomingOrder, IOrderSource } from './IOrderSource.js';

/**
 * CSV bulk import. Expected header:
 * pickup_address,pickup_lat,pickup_lon,dropoff_address,dropoff_lat,dropoff_lon,customer_name,customer_phone,cod_amount,weight_kg,priority
 */
export class CsvOrderSource implements IOrderSource {
  readonly name = 'csv';

  parse(raw: unknown): IncomingOrder[] {
    if (typeof raw !== 'string') throw new Error('CsvOrderSource expects CSV text');
    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];
    const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
    const idx = (name: string) => header.indexOf(name);
    const need = ['pickup_address', 'pickup_lat', 'pickup_lon', 'dropoff_address', 'dropoff_lat', 'dropoff_lon', 'customer_name'];
    for (const n of need) {
      if (idx(n) === -1) throw new Error(`CSV missing required column: ${n}`);
    }
    const orders: IncomingOrder[] = [];
    for (let i = 1; i < lines.length; i++) {
      const c = splitCsvLine(lines[i]);
      const num = (name: string, def = 0) => {
        const v = idx(name) >= 0 ? Number(c[idx(name)]) : NaN;
        return Number.isFinite(v) ? v : def;
      };
      const str = (name: string) => (idx(name) >= 0 ? (c[idx(name)] || '').trim() : '');
      orders.push({
        external_order_id: str('external_order_id') || `csv-${i}`,
        pickup: { address: str('pickup_address'), lat: num('pickup_lat'), lon: num('pickup_lon') },
        dropoff: { address: str('dropoff_address'), lat: num('dropoff_lat'), lon: num('dropoff_lon') },
        customer_name: str('customer_name'),
        customer_phone: str('customer_phone') || undefined,
        cod_amount: idx('cod_amount') >= 0 && str('cod_amount') !== '' ? num('cod_amount') : undefined,
        weight_kg: idx('weight_kg') >= 0 && str('weight_kg') !== '' ? num('weight_kg', 1) : undefined,
        priority: idx('priority') >= 0 && str('priority') !== '' ? num('priority', 5) : undefined,
      });
    }
    return orders;
  }
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
