function functionBase(base: string | undefined): string | null {
  const root = base?.trim().replace(/\/+$/, "");
  if (!root) return null;
  try {
    const { protocol } = new URL(root);
    return protocol === "https:" || protocol === "http:" ? root : null;
  } catch {
    return null;
  }
}

export function assistantUrl(path: "ask" | "ask/report", base: string | undefined = process.env.NEXT_PUBLIC_ASSISTANT_URL): string {
  const root = functionBase(base);
  return root ? `${root}/${path}` : `/api/${path}`;
}
