import { haversineKm } from '../../util/geo.js';
import type { IOptimizer, Leg, OptimizeResult, Point, Stop } from './IOptimizer.js';

/**
 * ACTIVE optimizer: pure-TypeScript nearest-neighbor construction + 2-opt
 * improvement over a haversine distance matrix. Open path by default; when an
 * `end` point is given the route is closed at that fixed terminal (return-to-home)
 * and the ordering + total account for the final leg back to `end`.
 */
export class Heuristic2Opt implements IOptimizer {
  readonly name = 'heuristic-2opt';

  optimize(stops: Stop[], start: Point, end?: Point): OptimizeResult {
    const returnKm = (from: Point): number =>
      end ? haversineKm(from.lat, from.lon, end.lat, end.lon) : 0;

    if (stops.length === 0) {
      if (!end) return { order: [], legs: [], total_km: 0 };
      const km = returnKm(start);
      return { order: [], legs: [{ from: 'start', to: 'end', km: round2(km) }], total_km: round2(km) };
    }
    if (stops.length === 1) {
      const km = haversineKm(start.lat, start.lon, stops[0].lat, stops[0].lon);
      const legs: Leg[] = [{ from: 'start', to: stops[0].id, km: round2(km) }];
      let total = km;
      if (end) {
        const rk = returnKm(stops[0]);
        legs.push({ from: stops[0].id, to: 'end', km: round2(rk) });
        total += rk;
      }
      return { order: [stops[0].id], legs, total_km: round2(total) };
    }

    // Distance matrix. Index 0 = start, 1..n = stops, n+1 = end (when present).
    const n = stops.length;
    const hasEnd = !!end;
    const endIdx = n + 1;
    const pts = [start, ...stops.map((s) => ({ lat: s.lat, lon: s.lon }))];
    if (end) pts.push({ lat: end.lat, lon: end.lon });
    const size = pts.length;
    const dist: number[][] = Array.from({ length: size }, (_, i) =>
      Array.from({ length: size }, (_, j) =>
        i === j ? 0 : haversineKm(pts[i].lat, pts[i].lon, pts[j].lat, pts[j].lon)
      )
    );

    // Nearest neighbor from start (over stops only).
    const route: number[] = []; // indices into stops (1..n)
    const used = new Array(n + 1).fill(false);
    let cur = 0;
    for (let k = 0; k < n; k++) {
      let best = -1;
      let bestD = Infinity;
      for (let j = 1; j <= n; j++) {
        if (!used[j] && dist[cur][j] < bestD) {
          bestD = dist[cur][j];
          best = j;
        }
      }
      used[best] = true;
      route.push(best);
      cur = best;
    }

    const routeDist = (r: number[]): number => {
      let d = 0;
      let prev = 0;
      for (const idx of r) {
        d += dist[prev][idx];
        prev = idx;
      }
      if (hasEnd) d += dist[prev][endIdx]; // return leg to home
      return d;
    };

    // 2-opt improvement. Start is fixed at index 0; when hasEnd, the terminal
    // after the last stop is `endIdx` (fixed), so ordering minimises the round trip.
    let improved = true;
    let guard = 0;
    while (improved && guard < 100) {
      improved = false;
      guard++;
      for (let i = 0; i < route.length - 1; i++) {
        for (let k = i + 1; k < route.length; k++) {
          const a = i === 0 ? 0 : route[i - 1];
          const b = route[i];
          const c = route[k];
          const dNode = k === route.length - 1 ? (hasEnd ? endIdx : -1) : route[k + 1];
          const before = dist[a][b] + (dNode === -1 ? 0 : dist[c][dNode]);
          const after = dist[a][c] + (dNode === -1 ? 0 : dist[b][dNode]);
          if (after < before - 1e-9) {
            // reverse route[i..k]
            let lo = i;
            let hi = k;
            while (lo < hi) {
              [route[lo], route[hi]] = [route[hi], route[lo]];
              lo++;
              hi--;
            }
            improved = true;
          }
        }
      }
    }

    const legs: Leg[] = [];
    let prev = 0;
    let prevId: number | string | 'start' = 'start';
    for (const idx of route) {
      legs.push({ from: prevId, to: stops[idx - 1].id, km: round2(dist[prev][idx]) });
      prev = idx;
      prevId = stops[idx - 1].id;
    }
    if (hasEnd) legs.push({ from: prevId, to: 'end', km: round2(dist[prev][endIdx]) });
    return {
      order: route.map((i) => stops[i - 1].id),
      legs,
      total_km: round2(routeDist(route)),
    };
  }
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
