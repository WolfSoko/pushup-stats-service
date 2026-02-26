import { buildServerApiBaseUrl } from './base-url.util';

describe('buildServerApiBaseUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.API_HOST;
    delete process.env.API_PORT;
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    (console.warn as jest.Mock).mockRestore?.();
  });

  it('returns empty string on browser platform', () => {
    const url = buildServerApiBaseUrl('browser', 'TestService');
    expect(url).toBe('');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('uses env host/port on server when provided', () => {
    process.env.API_HOST = 'api';
    process.env.API_PORT = '9999';
    const url = buildServerApiBaseUrl('server', 'TestService');
    expect(url).toBe('http://api:9999');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('falls back to 127.0.0.1:8788 on server and warns when env missing', () => {
    const url = buildServerApiBaseUrl('server', 'TestService');
    expect(url).toBe('http://127.0.0.1:8788');
    expect(console.warn).toHaveBeenCalled();
  });
});
