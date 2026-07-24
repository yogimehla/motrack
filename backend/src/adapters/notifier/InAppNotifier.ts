import { db } from '../../db.js';
import type { INotifier } from './INotifier.js';

/** ACTIVE: stores notifications in the DB; clients poll GET /notifications. */
export class InAppNotifier implements INotifier {
  readonly name = 'in-app';

  async send(userId: number | null, title: string, body: string): Promise<void> {
    db.prepare('INSERT INTO notifications (user_id, title, body) VALUES (?,?,?)').run(
      userId,
      title,
      body
    );
  }
}
