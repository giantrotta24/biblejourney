function httpBase(value: string | undefined): string | null {
  const root = value?.trim().replace(/\/+$/, '');
  if (!root) return null;
  try {
    const { protocol } = new URL(root);
    return protocol === 'https:' || protocol === 'http:' ? root : null;
  } catch {
    return null;
  }
}

/** The ask function itself, `https://<project>.supabase.co/functions/v1/ask`. */
export function askUrl(base: string | undefined = process.env.EXPO_PUBLIC_ASSISTANT_URL): string | null {
  return httpBase(base);
}

export function reportUrl(base: string | undefined = process.env.EXPO_PUBLIC_ASSISTANT_URL): string | null {
  const ask = httpBase(base);
  return ask ? `${ask}/report` : null;
}
