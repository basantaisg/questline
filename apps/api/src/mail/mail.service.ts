import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Resend's REST API, called directly. The `resend` SDK is a thin wrapper over
 * this same endpoint, and skipping it keeps the serverless cold start lean.
 */
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/**
 * Resend only accepts `onboarding@resend.dev` as a sender for accounts with no
 * verified domain, and it will ONLY deliver to the address that owns the Resend
 * account. Point MAIL_FROM at a verified domain before real users sign up.
 */
const DEFAULT_FROM = 'QuestLine <onboarding@resend.dev>';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  private get apiKey(): string | undefined {
    return this.config.get<string>('RESEND_API_KEY');
  }

  async sendOtp(to: string, code: string, purpose: 'signup' | 'password_change') {
    const forSignup = purpose === 'signup';
    const subject = forSignup
      ? `${code} is your QuestLine verification code`
      : `${code} — confirm your QuestLine password change`;
    const intro = forSignup
      ? 'Enter this code to activate your character and begin the quest.'
      : 'Enter this code to authorize a password change on your account.';

    await this.send({ to, subject, html: otpEmailHtml(code, intro) });
  }

  private async send({ to, subject, html }: { to: string; subject: string; html: string }) {
    const apiKey = this.apiKey;

    // Without a key, fall back to logging the mail rather than hard-failing:
    // local development stays usable, and the code is visible in the terminal.
    if (!apiKey) {
      this.logger.warn(
        `RESEND_API_KEY is not set — email not sent. Would have mailed "${subject}" to ${to}`,
      );
      return;
    }

    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.config.get<string>('MAIL_FROM') ?? DEFAULT_FROM,
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      // Deliberately not surfaced to the caller: a mail outage must not leak
      // provider internals, and signup already tells the user to re-request.
      this.logger.error(`Resend rejected the email (${res.status}): ${detail}`);
      throw new Error('Failed to send email');
    }
  }
}

/** Inline styles only — mail clients strip <style> blocks and external CSS. */
function otpEmailHtml(code: string, intro: string): string {
  return `
  <div style="margin:0;padding:40px 16px;background:#07070c;font-family:ui-sans-serif,system-ui,'Segoe UI',sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#0e0e18;border:1px solid rgba(255,255,255,0.10);border-radius:16px;padding:36px;">
      <p style="margin:0 0 24px;font-size:13px;letter-spacing:.22em;text-transform:uppercase;color:#22d3ee;">
        Quest<span style="color:#f0f0f5;">line</span>
      </p>
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#f0f0f5;">Verification code</h1>
      <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#9a9aad;">${intro}</p>
      <div style="padding:20px;background:rgba(34,211,238,0.08);border:1px solid rgba(34,211,238,0.35);border-radius:12px;text-align:center;">
        <span style="font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:34px;font-weight:700;letter-spacing:.32em;color:#22d3ee;">${code}</span>
      </div>
      <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#9a9aad;">
        This code expires in <strong style="color:#f0f0f5;">5 minutes</strong>.
        If you didn't request it, you can safely ignore this email.
      </p>
    </div>
  </div>`;
}
