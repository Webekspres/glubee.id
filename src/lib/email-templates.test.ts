import { describe, expect, it } from "bun:test";
import {
  createEmergencyAlertEmail,
  createGlucoseReminderEmail,
  createContactInviteEmail,
  createAuthVerifyEmail,
  createPasswordResetEmail,
  renderEmailLayout,
} from "./email-templates";

describe("Email Templates Production (Refined Variant B)", () => {
  it("renders base email layout with PT. Webekspres Teknologi Indonesia in footer", () => {
    const { html } = createEmergencyAlertEmail({
      recipientName: "Siti Rahma",
      patientName: "Budi Santoso",
      glucoseValue: 285,
      timestamp: "14:15 WIB",
      condition: "Setelah Makan Siang",
      patientPhone: "+6281234567890",
    });

    expect(html).toContain("PT. Webekspres Teknologi Indonesia");
    expect(html).toContain("glubee");
    expect(html).toContain("285");
    expect(html).toContain("mg/dL");
    expect(html).toContain("Siti Rahma");
    expect(html).toContain("Budi Santoso");
    expect(html).toContain("tel:+6281234567890");
    // Strictly no medical diagnosis per FRD
    expect(html).toContain("TIDAK memberikan diagnosis");
  });

  it("escapes malicious input in email body to prevent XSS injection in webmail", () => {
    const result = renderEmailLayout({
      subject: "Test <script>alert(1)</script>",
      badgeLabel: "ALERT <img src=x onerror=alert(1)>",
      urgencyLevel: "critical",
      recipientName: "User <test>",
      headline: "Headline with <b>bold</b>",
      bodyParagraphs: ["Paragraph with <script>danger()</script>"],
      actionButton: {
        label: "Click & Go",
        url: "https://glubee.id/test?a=1&b=2",
      },
    });

    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
    expect(result).toContain("User &lt;test&gt;");
    expect(result).toContain("PT. Webekspres Teknologi Indonesia");
  });

  it("generates glucose reminder email with correct schedule and action link", () => {
    const email = createGlucoseReminderEmail({
      recipientName: "Budi Santoso",
      scheduleName: "2 Jam Pasca Makan Malam",
      targetTime: "20:00 WIB",
      targetRange: "80 – 140 mg/dL",
      logUrl: "https://glubee.id/log",
    });

    expect(email.subject).toBe("Waktunya Cek Gula Darah: 2 Jam Pasca Makan Malam");
    expect(email.html).toContain("2 Jam Pasca Makan Malam");
    expect(email.html).toContain("20:00 WIB");
    expect(email.html).toContain("https://glubee.id/log");
    expect(email.html).toContain("PT. Webekspres Teknologi Indonesia");
  });

  it("generates contact invite email with PDP compliance notice", () => {
    const email = createContactInviteEmail({
      recipientName: "Siti Rahma",
      inviterName: "Budi Santoso",
      acceptUrl: "https://glubee.id/contacts/accept?token=123",
      declineUrl: "https://glubee.id/contacts/decline?token=123",
    });

    expect(email.subject).toBe("Budi Santoso Mengundang Anda Menjadi Kontak Darurat di Glubee");
    expect(email.html).toContain("UU Perlindungan Data Pribadi (UU PDP)");
    expect(email.html).toContain("https://glubee.id/contacts/accept?token=123");
    expect(email.html).toContain("https://glubee.id/contacts/decline?token=123");
    expect(email.html).toContain("PT. Webekspres Teknologi Indonesia");
  });

  it("generates auth verification email with OTP metric card", () => {
    const email = createAuthVerifyEmail({
      recipientName: "Budi Santoso",
      verifyUrl: "https://glubee.id/auth/verify?token=abc",
      otpCode: "849201",
      expiryMinutes: 15,
    });

    expect(email.subject).toBe("Verifikasi Alamat Email Anda untuk Glubee.id");
    expect(email.html).toContain("849201");
    expect(email.html).toContain("Kode OTP");
    expect(email.html).toContain("Berlaku 15 Menit");
    expect(email.html).toContain("https://glubee.id/auth/verify?token=abc");
    expect(email.html).toContain("PT. Webekspres Teknologi Indonesia");
  });

  it("generates password reset email with security notice", () => {
    const email = createPasswordResetEmail({
      recipientName: "Budi Santoso",
      resetUrl: "https://glubee.id/update-password?token=xyz",
      expiryMinutes: 60,
    });

    expect(email.subject).toBe("Permintaan Pemulihan Kata Sandi Glubee.id");
    expect(email.html).toContain("60 Menit");
    expect(email.html).toContain("https://glubee.id/update-password?token=xyz");
    expect(email.html).toContain("PT. Webekspres Teknologi Indonesia");
  });
});
