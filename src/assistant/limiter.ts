export type LimitResult = { allowed: boolean; used: number };

export interface UsageLimiter {
  take(userId: string, now: Date): Promise<LimitResult>;
}

export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function memoryLimiter(limit: number): UsageLimiter {
  const counts = new Map<string, number>();
  return {
    async take(userId, now) {
      const day = utcDay(now);
      for (const key of counts.keys()) if (!key.startsWith(`${day}|`)) counts.delete(key);
      const key = `${day}|${userId}`;
      const used = counts.get(key) ?? 0;
      if (used >= limit) return { allowed: false, used };
      counts.set(key, used + 1);
      return { allowed: true, used: used + 1 };
    },
  };
}
