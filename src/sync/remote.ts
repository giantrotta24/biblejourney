import type { DayRow, ProgressRows, VerseRow } from "@/progress/rows";

export type RemoteChange =
  | { kind: "put-day"; row: DayRow }
  | { kind: "delete-day"; day_index: number }
  | { kind: "put-verse"; row: VerseRow }
  | { kind: "delete-verse"; week: number };

export type RemoteProgress = {
  pull(): Promise<ProgressRows>;
  putDays(rows: readonly DayRow[]): Promise<void>;
  deleteDay(dayIndex: number): Promise<void>;
  putVerses(rows: readonly VerseRow[]): Promise<void>;
  deleteVerse(week: number): Promise<void>;
  subscribe(onChange: (change: RemoteChange) => void): () => void;
};

export function changeKey(change: RemoteChange): string {
  switch (change.kind) {
    case "put-day":
      return `day:${change.row.day_index}`;
    case "delete-day":
      return `day:${change.day_index}`;
    case "put-verse":
      return `verse:${change.row.week}`;
    case "delete-verse":
      return `verse:${change.week}`;
  }
}

export function sendChange(remote: RemoteProgress, change: RemoteChange): Promise<void> {
  switch (change.kind) {
    case "put-day":
      return remote.putDays([change.row]);
    case "delete-day":
      return remote.deleteDay(change.day_index);
    case "put-verse":
      return remote.putVerses([change.row]);
    case "delete-verse":
      return remote.deleteVerse(change.week);
  }
}

export class RemoteRefusedError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "RemoteRefusedError";
  }
}

export const isRefusal = (error: unknown): error is RemoteRefusedError => error instanceof RemoteRefusedError;
