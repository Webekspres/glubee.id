import nodemailer from "nodemailer";
import type { SentMessageInfo, TransportOptions } from "nodemailer";
import { APP_CONFIG } from "./config";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  attachments?: Array<{
    filename: string;
    content?: string | Buffer;
    path?: string;
    contentType?: string;
  }>;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Konversi sederhana dari HTML ke teks biasa agar email selalu
 * memiliki versi multipart (HTML + Text) demi skor deliverability yang optimal.
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Membaca konfigurasi SMTP dari environment variable.
 * Default disesuaikan untuk Mailpit bawaan Supabase CLI (host 127.0.0.1, port 54325).
 */
export function getSmtpConfig(): SmtpConfig {
  const host = process.env.SMTP_HOST || "127.0.0.1";
  const port = parseInt(process.env.SMTP_PORT || "54325", 10);
  const secure =
    process.env.SMTP_SECURE === "true" || (!process.env.SMTP_SECURE && port === 465);

  const user = process.env.SMTP_USER || undefined;
  const pass = process.env.SMTP_PASS || undefined;

  const fromName = process.env.SMTP_FROM_NAME || APP_CONFIG.name;
  const fromEmail = process.env.SMTP_FROM_EMAIL || "no-reply@glubee.id";
  const replyTo = process.env.SMTP_REPLY_TO || "support@glubee.id";

  return {
    host,
    port,
    secure,
    user,
    pass,
    fromName,
    fromEmail,
    replyTo,
  };
}

/**
 * Membuat nodemailer transporter berdasarkan konfigurasi SMTP.
 * Mendukung Mailpit lokal (tanpa auth, port 54325) dan Brevo (STARTTLS port 587 / SSL 465).
 */
export function createEmailTransporter(customConfig?: Partial<SmtpConfig>) {
  const config = { ...getSmtpConfig(), ...customConfig };
  const isLocal =
    config.host === "127.0.0.1" ||
    config.host === "localhost" ||
    config.host === "host.docker.internal";

  const transportOptions: TransportOptions = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    ...(config.port === 587 ? { requireTLS: true } : {}),
    ...(config.user && config.pass
      ? {
          auth: {
            user: config.user,
            pass: config.pass,
          },
        }
      : {}),
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 15000,
    tls: {
      rejectUnauthorized: !isLocal,
    },
  } as TransportOptions;

  return nodemailer.createTransport(transportOptions);
}

/**
 * Verifikasi koneksi ke SMTP server (berguna untuk health check atau diagnosis).
 */
export async function verifyEmailConnection(
  customConfig?: Partial<SmtpConfig>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const transporter = createEmailTransporter(customConfig);
    await transporter.verify();
    return { ok: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: errorMsg };
  }
}

/**
 * Mengirim email menggunakan konfigurasi SMTP yang aktif.
 * Memastikan email multipart (text + HTML), header standar, dan sanitasi pengirim.
 */
export async function sendEmail(
  options: SendEmailOptions,
  customConfig?: Partial<SmtpConfig>,
): Promise<SendEmailResult> {
  const config = { ...getSmtpConfig(), ...customConfig };
  const transporter = createEmailTransporter(config);

  const fromHeader =
    options.from || `"${config.fromName}" <${config.fromEmail}>`;
  const replyToHeader = options.replyTo || config.replyTo;

  // Pastikan email selalu memiliki versi text dan HTML untuk deliverability & anti-spam score
  let text = options.text;
  let html = options.html;

  if (html && !text) {
    text = htmlToPlainText(html);
  } else if (text && !html) {
    html = `<p>${text.replace(/\n/g, "<br>")}</p>`;
  }

  try {
    const info: SentMessageInfo = await transporter.sendMail({
      from: fromHeader,
      to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
      replyTo: replyToHeader,
      subject: options.subject,
      text,
      html,
      attachments: options.attachments,
      headers: {
        "X-Mailer": `${config.fromName} Mailer`,
        ...(options.headers || {}),
      },
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: errorMsg,
    };
  }
}
