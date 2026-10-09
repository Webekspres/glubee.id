import { describe, expect, test } from "bun:test";
import { createScheduleReminderEmail } from "@/lib/email-templates";
import {
  classifyPush,
  classifySend,
  combinePush,
  dispatchAuthorized,
  reminderSettings,
  reminderWhen,
  validatePushSubscription,
} from "./reminder";

describe("classifySend", () => {
  test("success is sent", () => {
    expect(classifySend({ success: true, messageId: "x" })).toEqual({ result: "sent", errorClass: null });
  });
  test("SMTP 4xx and network errors retry", () => {
    expect(classifySend({ success: false, errorCode: "421" })).toEqual({ result: "retry", errorClass: "smtp_421" });
    expect(classifySend({ success: false, errorCode: "ETIMEDOUT" })).toEqual({ result: "retry", errorClass: "etimedout" });
    expect(classifySend({ success: false }).result).toBe("retry");
  });
  test("SMTP 5xx and config errors fail without retry", () => {
    expect(classifySend({ success: false, errorCode: "550" })).toEqual({ result: "failed", errorClass: "smtp_550" });
    expect(classifySend({ success: false, errorCode: "EAUTH" })).toEqual({ result: "failed", errorClass: "eauth" });
  });
});

describe("dispatchAuthorized", () => {
  const secret = "s".repeat(40);
  test("needs the exact bearer secret", () => {
    expect(dispatchAuthorized(`Bearer ${secret}`, secret)).toBe(true);
    expect(dispatchAuthorized(`Bearer ${secret}x`, secret)).toBe(false);
    expect(dispatchAuthorized(secret, secret)).toBe(false);
    expect(dispatchAuthorized(null, secret)).toBe(false);
  });
  test("missing or short secret disables the endpoint", () => {
    expect(dispatchAuthorized("Bearer ", "")).toBe(false);
    expect(dispatchAuthorized("Bearer short", "short")).toBe(false);
    expect(dispatchAuthorized("Bearer x", undefined)).toBe(false);
  });
});

describe("reminder settings and content", () => {
  test("off unless explicitly enabled; cap defaults to 150", () => {
    expect(reminderSettings({})).toMatchObject({ enabled: false, dailyCap: 150, push: false });
    expect(reminderSettings({ REMINDER_EMAIL_ENABLED: "true", REMINDER_EMAIL_DAILY_CAP: "40" })).toMatchObject({ enabled: true, dailyCap: 40 });
    expect(reminderSettings({ REMINDER_EMAIL_ENABLED: "1", REMINDER_EMAIL_DAILY_CAP: "-1" })).toMatchObject({ enabled: false, dailyCap: 150 });
  });

  test("time is written in the schedule's own zone", () => {
    expect(reminderWhen("2026-10-08", "07:30:00", "WITA")).toBe("Kamis, 8 Oktober 2026 pukul 07.30 WITA");
  });

  test("email has title and time only, escaped, no medical advice", () => {
    const { subject, html } = createScheduleReminderEmail({
      recipientName: "Bu Ani",
      title: "Obat <b>pagi</b>",
      when: "Kamis, 8 Oktober 2026 pukul 07.30 WIB",
      shortTime: "07.30 WIB",
      scheduleUrl: "https://glubee.id/schedule",
    });
    expect(subject).toBe("Pengingat jadwal Glubee pukul 07.30 WIB");
    expect(html).toContain("Obat &lt;b&gt;pagi&lt;/b&gt;");
    expect(html).toContain("https://glubee.id/schedule");
    expect(html).not.toMatch(/mg\/dL|hipoglikemia|target/i);
  });
});

describe("push", () => {
  test("classifyPush maps push service status codes", () => {
    expect(classifyPush(201)).toBe("sent");
    expect(classifyPush(410)).toBe("gone");
    expect(classifyPush(404)).toBe("gone");
    expect(classifyPush(429)).toBe("retry");
    expect(classifyPush(503)).toBe("retry");
    expect(classifyPush(undefined)).toBe("retry");
    expect(classifyPush(403)).toBe("failed");
  });
  test("combinePush: one device is enough, otherwise retry before failing", () => {
    expect(combinePush(["gone", "sent"]).result).toBe("sent");
    expect(combinePush(["gone", "retry"]).result).toBe("retry");
    expect(combinePush(["gone", "gone"])).toEqual({ result: "failed", errorClass: "push_gone" });
    expect(combinePush([]).result).toBe("failed");
  });
  test("validatePushSubscription accepts browser JSON only", () => {
    const ok = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "BNc-x_1", auth: "tBH2" } };
    expect(validatePushSubscription(ok)).toEqual(ok);
    expect(validatePushSubscription({ ...ok, endpoint: "http://evil.test" })).toBeNull();
    expect(validatePushSubscription({ ...ok, keys: { p256dh: "a b", auth: "x" } })).toBeNull();
    expect(validatePushSubscription({ endpoint: ok.endpoint })).toBeNull();
    expect(validatePushSubscription(null)).toBeNull();
  });
  test("push needs the flag and complete VAPID keys", () => {
    const vapid = { VAPID_PUBLIC_KEY: "p", VAPID_PRIVATE_KEY: "k", VAPID_SUBJECT: "mailto:a@b.test" };
    expect(reminderSettings({ REMINDER_PUSH_ENABLED: "true", ...vapid }).push).toBe(true);
    expect(reminderSettings({ REMINDER_PUSH_ENABLED: "true", ...vapid, VAPID_PRIVATE_KEY: "" }).push).toBe(false);
    expect(reminderSettings(vapid).push).toBe(false);
  });
});
