import { NominatimGeocoder } from './NominatimGeocoder.js';
import { PlusCodeGeocoder } from './PlusCodeGeocoder.js';

export type { IGeocoder, GeocodeResult } from './IGeocoder.js';
export { NominatimGeocoder } from './NominatimGeocoder.js';
export { OfflineBundleGeocoder } from './OfflineBundleGeocoder.js';
export { PlusCodeGeocoder } from './PlusCodeGeocoder.js';

/** Active geocoders for v1.1. */
export const geocoder = new NominatimGeocoder();
export const plusCodeGeocoder = new PlusCodeGeocoder();
