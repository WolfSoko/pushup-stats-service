import { describe, expect, it, jest } from '@jest/globals';

import { sendToSubscriptions, type PushSendOptions } from './deliver';

const OPTIONS: PushSendOptions = { urgency: 'normal', TTL: 60, topic: 't' };

function sub(key: string, endpoint = `https://push.test/${key}`) {
  return { key, data: { endpoint, keys: { p256dh: 'p', auth: 'a' } } };
}

describe('push/deliver', () => {
  it('should send the payload to every complete subscription', async () => {
    // given
    const send = jest.fn<() => Promise<unknown>>().mockResolvedValue(undefined);

    // when
    const result = await sendToSubscriptions(
      [sub('a'), sub('b')],
      '{"title":"x"}',
      OPTIONS,
      send
    );

    // then
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith(
      { endpoint: 'https://push.test/a', keys: { p256dh: 'p', auth: 'a' } },
      '{"title":"x"}',
      OPTIONS
    );
    expect(result).toEqual({ sent: 2, expired: [], failed: [] });
  });

  it('should skip a record without endpoint or keys', async () => {
    // given
    const send = jest.fn<() => Promise<unknown>>().mockResolvedValue(undefined);

    // when
    const result = await sendToSubscriptions(
      [
        { key: 'x', data: { endpoint: 'https://push.test/x', keys: null } },
        { key: 'y', data: { keys: { p256dh: 'p', auth: 'a' } } },
      ],
      'p',
      OPTIONS,
      send
    );

    // then
    expect(send).not.toHaveBeenCalled();
    expect(result.sent).toBe(0);
  });

  it('should report a gone subscription as expired, not as a failure', async () => {
    // given — 410 from the push service
    const send = jest
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce({ statusCode: 410 })
      .mockResolvedValueOnce(undefined);

    // when
    const result = await sendToSubscriptions(
      [sub('dead'), sub('live')],
      'p',
      OPTIONS,
      send
    );

    // then
    expect(result).toEqual({ sent: 1, expired: ['dead'], failed: [] });
  });

  it('should keep going after a failure and hand back what went wrong', async () => {
    // given
    const send = jest
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce({ statusCode: 500, message: 'boom' })
      .mockResolvedValueOnce(undefined);

    // when
    const result = await sendToSubscriptions(
      [sub('a'), sub('b')],
      'p',
      OPTIONS,
      send
    );

    // then
    expect(result.sent).toBe(1);
    expect(result.failed).toEqual([
      { endpoint: 'https://push.test/a', status: 500, message: 'boom' },
    ]);
  });
});
