export interface GeocodeResult {
  lat: number;
  lon: number;
  display_name: string;
  plus_code?: string;
}

export interface IGeocoder {
  readonly name: string;
  search(q: string): Promise<GeocodeResult[]>;
  reverse(lat: number, lon: number): Promise<GeocodeResult | null>;
}
