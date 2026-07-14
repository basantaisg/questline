import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Built lazily and cached: a serverless invocation that never sends mail
   * should not pay for an SMTP handshake, and one that sends twice should not
   * pay twice.
   */
  private transporter?: Transporter;

  private getTransporter(): Transporter | undefined {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    if (!host || !user || !pass) return undefined;

    if (!this.transporter) {
      const port = Number(this.config.get<string>('SMTP_PORT') ?? 465);
      this.transporter = createTransport({
        host,
        port,
        // 465 speaks TLS from the first byte; 587 opens in the clear and
        // upgrades via STARTTLS. Getting this backwards hangs the connection.
        secure: port === 465,
        auth: { user, pass },
      });
    }
    return this.transporter;
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
    const transporter = this.getTransporter();

    // Without SMTP credentials, fall back to logging the mail rather than
    // hard-failing: local development stays usable, and the code is visible in
    // the terminal.
    if (!transporter) {
      this.logger.warn(
        `SMTP is not configured — email not sent. Would have mailed "${subject}" to ${to}`,
      );
      return;
    }

    try {
      await transporter.sendMail({
        from: this.config.get<string>('MAIL_FROM') ?? this.config.get<string>('SMTP_USER'),
        to,
        subject,
        html,
      });
    } catch (err) {
      // Deliberately not surfaced to the caller: a mail outage must not leak
      // provider internals, and signup already tells the user to re-request.
      this.logger.error(`SMTP rejected the email: ${String(err)}`);
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
