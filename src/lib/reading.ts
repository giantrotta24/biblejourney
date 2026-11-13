const WORD = /[\p{L}’']+/gu;

export function firstLetters(text: string): string {
  return text.replace(WORD, (word) => word[0]);
}

export function bibleGatewayUrl(reading: string, translation = "NIV"): string {
  const params = new URLSearchParams({ search: reading.replace(/[–—]/g, "-"), version: translation });
  return `https://www.biblegateway.com/passage/?${params}`;
}

const MINUTES_PER_CHAPTER = 5;
const MINIMUM_MINUTES = 10;

export function estimatedMinutes(chapters: number): number {
  return Math.max(MINIMUM_MINUTES, Math.round(chapters * MINUTES_PER_CHAPTER));
}

export function percentRead(done: ReadonlySet<number>, days: ReadonlyArray<{ index: number; chapters: number }>): number {
  let total = 0;
  let read = 0;
  for (const day of days) {
    total += day.chapters;
    if (done.has(day.index)) read += day.chapters;
  }
  return total === 0 ? 0 : Math.floor((read / total) * 100);
}
