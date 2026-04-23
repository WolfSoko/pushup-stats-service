import { readingMinutes } from './reading-time';

describe('readingMinutes', () => {
  it('returns at least 1 minute for any non-empty content', () => {
    expect(readingMinutes('one word')).toBe(1);
    expect(readingMinutes('')).toBe(1);
  });

  it('strips HTML tags before counting words', () => {
    const html = '<p><strong>hello</strong> <em>world</em></p>';
    expect(readingMinutes(html)).toBe(1);
  });

  it('rounds ~200 words per minute', () => {
    const sentence = 'word '.repeat(600).trim();
    expect(readingMinutes(sentence)).toBe(3);
  });

  it('decodes entities as whitespace (does not count as word chars)', () => {
    const html = '<p>hello&nbsp;world&amp;more</p>';
    expect(readingMinutes(html)).toBe(1);
  });

  it('ignores repeated whitespace and newlines', () => {
    const html = '<p>hello\n\n\n   world</p>';
    expect(readingMinutes(html)).toBe(1);
  });
});
