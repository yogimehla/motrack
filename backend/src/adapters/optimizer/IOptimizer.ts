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
  optimize(stops: Stop[], start: Point): OptimizeResult;
}
