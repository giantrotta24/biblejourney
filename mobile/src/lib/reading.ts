export function bibleGatewayUrl(reading: string, translation = 'NIV'): string {
  const params = new URLSearchParams({
    search: reading.replace(/[–—]/g, '-'),
    version: translation,
  });
  return `https://www.biblegateway.com/passage/?${params}`;
}
