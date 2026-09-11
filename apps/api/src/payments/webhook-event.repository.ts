export const WEBHOOK_EVENT_REPOSITORY = Symbol('WEBHOOK_EVENT_REPOSITORY');

export interface WebhookEventRepository {
  wasProcessed(id: string): Promise<boolean>;
  markProcessed(id: string): Promise<void>;
}
