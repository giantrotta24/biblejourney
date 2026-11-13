export const END_MARKER = "\u001E";

export const STREAM_ENDS = ["complete", "refused", "truncated", "error"] as const;
export type StreamEnd = (typeof STREAM_ENDS)[number];

export function endFrame(end: StreamEnd): string {
  return `${END_MARKER}${end}`;
}

export function withoutMarker(text: string): string {
  return text.replaceAll(END_MARKER, "");
}

export function readStream(raw: string): { text: string; end: StreamEnd | null } {
  const at = raw.indexOf(END_MARKER);
  if (at === -1) return { text: raw, end: null };
  const end = raw.slice(at + END_MARKER.length);
  return { text: raw.slice(0, at), end: (STREAM_ENDS as readonly string[]).includes(end) ? (end as StreamEnd) : "error" };
}
