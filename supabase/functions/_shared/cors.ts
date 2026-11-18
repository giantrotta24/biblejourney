export function withCors(request: Request, response: Response | null, origins: string): Response {
  const result = response ?? new Response(null, { status: 204 });
  const headers = new Headers(result.headers);
  headers.append("Vary", "Origin");
  const origin = request.headers.get("origin");
  if (origin && origins.split(",").map((value) => value.trim()).includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "authorization, content-type");
    headers.set("Access-Control-Expose-Headers", "x-assistant-cache");
  }
  return new Response(result.body, { status: result.status, statusText: result.statusText, headers });
}
