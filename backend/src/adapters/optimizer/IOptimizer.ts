export interface Stop {
  id: number | string;
  lat: number;
  lon: number;
}

export interface Point {
  lat: number;
  lon: number;
}

export interface Leg {
  from: number | string | 'start';
  to: number | string;
  km: number;
}

export interface OptimizeResult {
  order: (number | string)[];
  legs: Leg[];
  total_km: number;
}

export interface IOptimizer {
  readonly name: string;
  /**
   * Order `stops` starting from `start`. When `end` is given the route is
   * closed at that fixed terminal (return-to-home) and a final `to: 'end'`
   * leg is appended; otherwise the route is left open at the last stop.
   */
  optimize(stops: Stop[], start: Point, end?: Point): OptimizeResult;
}
