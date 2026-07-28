import type { IOptimizer, OptimizeResult, Point, Stop } from './IOptimizer.js';

/**
 * STUB (V2): calls an external OR-Tools routing microservice for
 * time-windowed VRP. Not wired in v1.1.
 */
export class ORToolsServer implements IOptimizer {
  readonly name = 'ortools-server';
  optimize(_stops: Stop[], _start: Point, _end?: Point): OptimizeResult {
    throw Object.assign(new Error('ORToolsServer is a V2 stub'), { status: 501 });
  }
}
