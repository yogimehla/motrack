import { InAppNotifier } from './InAppNotifier.js';

export type { INotifier } from './INotifier.js';
export { InAppNotifier } from './InAppNotifier.js';
export { FcmNotifier } from './FcmNotifier.js';

/** Active notifier for v1.1. */
export const notifier = new InAppNotifier();
