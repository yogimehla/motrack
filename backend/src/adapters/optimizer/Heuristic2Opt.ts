import { haversineKm } from '../../util/geo.js';
import type { IOptimizer, Leg, OptimizeResult, Point, Stop } from './IOptimizer.js';

/**
 * ACTIVE optimizer: pure-TypeScript nearest-neighbor construction + 2-opt
 * improvement over a haversine distance matrix. Open path (no return to start).
 */
export class Heuristic2Opt implements IOptimizer {
  readonly name = 'heuristic-2opt';

  optimize(stops: Stop[], start: Point): OptimizeResult {
    if (stops.length === 0) return { order: [], legs: [], total_km: 0 };
    if (stops.length === 1) {
      const km = haversineKm(start.lat, start.lon, stops[0].lat, stops[0].lon);
      return { order: [stops[0].id], legs: [{ from: 'start', to: stops[0].id, km }], total_km: km };
    }

    // Distance matrix. Index 0 = start, 1..n = stops.
    const n = stops.length;
    const pts = [start, ...stops.map((s) => ({ lat: s.lat, lon: s.lon }))];
    const dist: number[][] = Array.from({ length: n + 1 }, (_, i) =>
      Array.from({ length: n + 1 }, (_, j) =>
        i === j ? 0 : haversineKm(pts[i].lat, pts[i].lon, pts[j].lat, pts[j].lon)
      )
    );

    // Nearest neighbor from start (open route).
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
      return d;
    };

    // 2-opt improvement (open path: reverse segment, keep start fixed).
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
          const dNode = k === route.length - 1 ? -1 : route[k + 1];
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
