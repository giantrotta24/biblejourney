export function writingScale(fontScale: number): number {
  return Math.min(fontScale, 2);
}

export function ruledLine(base: number, fontScale: number): number {
  return Math.round(base * writingScale(fontScale));
}

export function caretLineY(text: string, index: number, line: number): number {
  const end = Math.max(0, Math.min(index, text.length));
  return (text.slice(0, end).split('\n').length - 1) * line;
}
