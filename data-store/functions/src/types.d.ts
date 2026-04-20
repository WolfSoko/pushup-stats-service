declare module 'web-push' {
  interface PushSubscription {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }

  function setVapidDetails(
    subject: string,
    publicKey: string,
    privateKey: string
  ): void;

  interface RequestOptions {
    urgency?: 'very-low' | 'low' | 'normal' | 'high';
    TTL?: number;
    topic?: string;
  }

  function sendNotification(
    subscription: PushSubscription,
    payload: string,
    options?: RequestOptions
  ): Promise<unknown>;
}
