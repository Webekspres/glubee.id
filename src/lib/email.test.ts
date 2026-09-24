import { describe, expect, it } from "bun:test";
import { getSmtpConfig, createEmailTransporter } from "./email";

describe("email SMTP configuration", () => {
  it("defaults to local Mailpit configuration when env variables are not set", () => {
    const originalHost = process.env.SMTP_HOST;
    const originalPort = process.env.SMTP_PORT;
    const originalUser = process.env.SMTP_USER;
    const originalPass = process.env.SMTP_PASS;

    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;

    try {
      const config = getSmtpConfig();
      expect(config.host).toBe("127.0.0.1");
      expect(config.port).toBe(54325);
      expect(config.secure).toBe(false);
      expect(config.user).toBeUndefined();
      expect(config.pass).toBeUndefined();
      expect(config.fromEmail).toBe("no-reply@glubee.id");
      expect(config.fromName).toBe("Glubee");
    } finally {
      if (originalHost !== undefined) process.env.SMTP_HOST = originalHost;
      if (originalPort !== undefined) process.env.SMTP_PORT = originalPort;
      if (originalUser !== undefined) process.env.SMTP_USER = originalUser;
      if (originalPass !== undefined) process.env.SMTP_PASS = originalPass;
    }
  });

  it("correctly parses Brevo / custom SMTP configuration from env", () => {
    const originalHost = process.env.SMTP_HOST;
    const originalPort = process.env.SMTP_PORT;
    const originalUser = process.env.SMTP_USER;
    const originalPass = process.env.SMTP_PASS;
    const originalSecure = process.env.SMTP_SECURE;

    process.env.SMTP_HOST = "smtp-relay.brevo.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "brevo-user@example.com";
    process.env.SMTP_PASS = "xsmtp-brevo-key";
    process.env.SMTP_SECURE = "false";

    try {
      const config = getSmtpConfig();
      expect(config.host).toBe("smtp-relay.brevo.com");
      expect(config.port).toBe(587);
      expect(config.secure).toBe(false);
      expect(config.user).toBe("brevo-user@example.com");
      expect(config.pass).toBe("xsmtp-brevo-key");
    } finally {
      if (originalHost !== undefined) process.env.SMTP_HOST = originalHost;
      else delete process.env.SMTP_HOST;
      if (originalPort !== undefined) process.env.SMTP_PORT = originalPort;
      else delete process.env.SMTP_PORT;
      if (originalUser !== undefined) process.env.SMTP_USER = originalUser;
      else delete process.env.SMTP_USER;
      if (originalPass !== undefined) process.env.SMTP_PASS = originalPass;
      else delete process.env.SMTP_PASS;
      if (originalSecure !== undefined) process.env.SMTP_SECURE = originalSecure;
      else delete process.env.SMTP_SECURE;
    }
  });

  it("creates a transporter instance without throwing", () => {
    const transporter = createEmailTransporter({
      host: "127.0.0.1",
      port: 1025,
      secure: false,
    });
    expect(transporter).toBeDefined();
    expect(typeof transporter.sendMail).toBe("function");
  });
});
