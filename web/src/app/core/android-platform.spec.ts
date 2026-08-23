import { isAndroidDevice, isRunningInTwa } from './android-platform';

describe('isAndroidDevice', () => {
  it('should detect a Chrome-on-Android user agent', () => {
    // given
    const ua =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
    // when
    const result = isAndroidDevice(ua);
    // then
    expect(result).toBe(true);
  });

  it('should reject an iOS user agent', () => {
    // given
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
    // when
    const result = isAndroidDevice(ua);
    // then
    expect(result).toBe(false);
  });

  it('should reject a desktop user agent', () => {
    // given
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
    // when
    const result = isAndroidDevice(ua);
    // then
    expect(result).toBe(false);
  });

  it('should reject an empty user agent', () => {
    // given
    const ua = '';
    // when
    const result = isAndroidDevice(ua);
    // then
    expect(result).toBe(false);
  });
});

describe('isRunningInTwa', () => {
  it('should detect the Bubblewrap TWA referrer scheme', () => {
    // given
    const referrer = 'android-app://com.pushupstats.app';
    // when
    const result = isRunningInTwa(referrer);
    // then
    expect(result).toBe(true);
  });

  it('should reject a normal http referrer', () => {
    // given
    const referrer = 'https://pushup-stats.com/';
    // when
    const result = isRunningInTwa(referrer);
    // then
    expect(result).toBe(false);
  });

  it('should reject an empty referrer', () => {
    // given
    const referrer = '';
    // when
    const result = isRunningInTwa(referrer);
    // then
    expect(result).toBe(false);
  });
});
