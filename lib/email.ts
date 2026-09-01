import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM = process.env.RESEND_FROM_EMAIL || "KR Citas <noreply@krsystem-corp.com>";
const APP_URL = process.env.APP_URL || "https://krcitas.krsystem-corp.com";
const LOGO_URL = `${APP_URL}/logo.png`;

// Resend is optional in dev — if no API key is configured, reset links are
// logged to the server console instead of emailed, so the flow is still
// testable locally without an account. A delivery failure (e.g. Resend
// outage, unverified domain) is logged but never thrown — the reset token is
// already persisted by the time this runs, so a flaky email provider
// shouldn't surface as a broken "forgot password" flow to the user.
//
// bodyHtml is just the email-specific content — the logo header, container,
// and "KR Citas — By KR System" footer are shared here so every email
// carries the same branding without each sender repeating that markup.
async function send(to: string, subject: string, bodyHtml: string): Promise<boolean> {
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <img src="${LOGO_URL}" alt="KR Citas" width="48" height="48" style="display: block; margin: 0 auto 20px; border-radius: 10px;" />
      ${bodyHtml}
      <p style="color: #888; font-size: 12px; margin-top: 32px; text-align: center;">KR Citas — By KR System</p>
    </div>
  `;
  if (!resend) {
    console.log(`[email] RESEND_API_KEY not set — would send to ${to}: ${subject}\n${html}`);
    return true;
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
    return true;
  } catch (err) {
    console.error(`[email] failed to send to ${to}:`, err);
    return false;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function sendAnnouncementEmail(
  to: string,
  subject: string,
  message: string,
): Promise<boolean> {
  const bodyHtml = escapeHtml(message)
    .split("\n")
    .map((line) => `<p>${line || "&nbsp;"}</p>`)
    .join("");
  return send(to, subject, bodyHtml);
}

export async function sendSignupCodeEmail(to: string, code: string): Promise<void> {
  await send(
    to,
    "Tu código de verificación — KR Citas",
    `
      <h2>Confirma tu correo</h2>
      <p>Usa este código para terminar de registrar tu negocio en KR Citas:</p>
      <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px; text-align: center; margin: 24px 0;">${code}</p>
      <p>Este código vence en 10 minutos. Si no intentaste crear una cuenta, puedes ignorar este correo.</p>
    `,
  );
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password/${token}`;
  await send(
    to,
    "Recupera tu contraseña — KR Citas",
    `
      <h2>Recupera tu contraseña</h2>
      <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en KR Citas.</p>
      <p>
        <a href="${resetUrl}" style="display: inline-block; background: #4f3ddb; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Crear nueva contraseña
        </a>
      </p>
      <p>Este enlace vence en 1 hora. Si no solicitaste este cambio, puedes ignorar este correo.</p>
    `,
  );
}
