const WORD = /[\p{L}’']+/gu;

export function firstLetters(text: string): string {
  return text.replace(WORD, (word) => word[0] ?? '');
}

export function bibleGatewayUrl(reading: string, translation = 'NIV'): string {
  const params = new URLSearchParams({
    search: reading.replace(/[–—]/g, '-'),
    version: translation,
  });
  return `https://www.biblegateway.com/passage/?${params}`;
}
