import { R2Storage } from './R2Storage.js';

export type { IMapStorage, SignedUrl } from './IMapStorage.js';
export { R2Storage } from './R2Storage.js';

/** Active storage adapter for v1.1 (stub returning CDN placeholder URLs). */
export const mapStorage = new R2Storage();
