export interface INotifier {
  readonly name: string;
  /** Deliver a notification to a user (or broadcast when userId is null). */
  send(userId: number | null, title: string, body: string): Promise<void>;
}
