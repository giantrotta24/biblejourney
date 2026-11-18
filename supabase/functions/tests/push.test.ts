// @ts-types="npm:@types/web-push@3.6.4"
import * as webpush from "web-push";
import { createPush } from "../reminders-send/push.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("web-push encrypts and posts a VAPID-authenticated payload under Deno", async () => {
  let received: { encoding: string | null; authorization: string | null; body: Uint8Array } | undefined;
  const server = Deno.serve({ hostname: "127.0.0.1", port: 0, onListen() {} }, async (request) => {
    received = {
      encoding: request.headers.get("content-encoding"),
      authorization: request.headers.get("authorization"),
      body: new Uint8Array(await request.arrayBuffer()),
    };
    return new Response(null, { status: 201 });
  });
  try {
    const key = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key.publicKey));
    const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
    const endpoint = `http://127.0.0.1:${server.addr.port}/push`;
    const vapid = webpush.generateVAPIDKeys();
    const config = { supabaseUrl: "", serviceRoleKey: "", vapidPublicKey: vapid.publicKey, vapidPrivateKey: vapid.privateKey, vapidSubject: "mailto:test@example.com" };
    const subscription = { endpoint, keys: { p256dh: base64url(raw), auth: base64url(crypto.getRandomValues(new Uint8Array(16))) } };
    let rejected = false;
    try { await createPush(config)(subscription, { title: "test", body: "reading", url: "/" }); } catch { rejected = true; }
    assert(rejected, "production endpoint validation must reject localhost");
    assert(!received, "rejected endpoint must not receive a request");
    await createPush(config, (value) => value === endpoint)(subscription, { title: "test", body: "reading", url: "/" });
    assert(received, "server received the encrypted notification");
    const notification = received as { encoding: string | null; authorization: string | null; body: Uint8Array };
    assert(notification.encoding === "aes128gcm", `encoding: ${notification.encoding}`);
    assert(notification.authorization?.startsWith("vapid t="), `authorization: ${notification.authorization}`);
    assert(notification.body.length > 100, "encrypted payload contains a salt, key and ciphertext");
    assert(!new TextDecoder().decode(notification.body).includes('"reading"'), "payload is not plaintext");
  } finally {
    await server.shutdown();
  }
});
