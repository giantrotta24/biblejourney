import { describe, expect, it } from "vitest";
import { isPushEndpoint } from "./endpoints";

describe("isPushEndpoint", () => {
  it("accepts https endpoints on the known push services", () => {
    for (const url of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://push.services.mozilla.com/abc",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
      "https://web.push.apple.com/QGx",
      "https://api.push.apple.com/3/device/abc",
    ]) {
      expect(isPushEndpoint(url), url).toBe(true);
    }
  });

  it("refuses plain http, other hosts, look-alike hosts and junk", () => {
    for (const url of [
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://evil.example/fcm.googleapis.com",
      "https://fcm.googleapis.com.evil.example/x",
      "https://notify.windows.com.evil.example/x",
      "https://evilpush.apple.com/x",
      "https://user:pass@fcm.googleapis.com:8443/x",
      "not a url",
      "",
    ]) {
      expect(isPushEndpoint(url), url).toBe(false);
    }
  });
});
