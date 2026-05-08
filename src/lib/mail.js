import nodemailer from 'nodemailer';

let cached = null;

function getTransport() {
  if (cached) return cached;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!user || !pass) {
    throw new Error('SMTP_USER / SMTP_PASSWORD not configured');
  }
  cached = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
  return cached;
}

function fromAddress() {
  return process.env.SMTP_FROM || `佛堂法會報名系統 <${process.env.SMTP_USER}>`;
}

export async function sendVerificationCode(toEmail, code) {
  const transport = getTransport();
  const subject = '【佛堂法會報名】密碼重設驗證碼';
  const text = `您好，

您的密碼重設驗證碼為：${code}

此驗證碼將於 15 分鐘後失效。如非本人操作，請忽略此信。

— 佛堂法會報名系統`;
  const html = `
    <div style="font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #8B1A1A; border-bottom: 2px solid #8B1A1A; padding-bottom: 8px;">密碼重設驗證碼</h2>
      <p>您好，</p>
      <p>您的密碼重設驗證碼為：</p>
      <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #8B1A1A; background: #FAF3E7; padding: 16px; text-align: center; border-radius: 8px;">${code}</p>
      <p style="color: #666; font-size: 14px;">此驗證碼將於 <strong>15 分鐘</strong> 後失效。如非本人操作，請忽略此信。</p>
      <p style="color: #999; font-size: 12px; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px;">— 佛堂法會報名系統</p>
    </div>
  `;
  await transport.sendMail({ from: fromAddress(), to: toEmail, subject, text, html });
}
