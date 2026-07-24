import type { INotifier } from './INotifier.js';

/** STUB (V2): Firebase Cloud Messaging push notifications. */
export class FcmNotifier implements INotifier {
  readonly name = 'fcm';
  async send(_userId: number | null, _title: string, _body: string): Promise<void> {
    throw Object.assign(new Error('FcmNotifier is a V2 stub'), { status: 501 });
  }
}
