export function assistantUrl(path: "ask" | "ask/report", base: string | undefined = process.env.NEXT_PUBLIC_ASSISTANT_URL): string {
  const root = base?.trim().replace(/\/+$/, "");
  return root ? `${root}/${path}` : `/api/${path}`;
}
