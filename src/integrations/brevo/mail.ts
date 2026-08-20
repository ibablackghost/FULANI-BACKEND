/** Brevo (Sendinblue) transactional email via REST API. */

type BrevoRecipient = { email: string; name?: string };

type SendEmailInput = {
  to: BrevoRecipient[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  replyTo?: BrevoRecipient;
};

export type BrevoSendResult =
  | { ok: true; messageId?: string }
  | { ok: false; skipped?: boolean; error: string };

const getConfig = () => {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();
  const senderName = process.env.BREVO_SENDER_NAME?.trim() || 'Fulani Official';
  const notifyEmail = process.env.BREVO_NOTIFY_EMAIL?.trim();

  return { apiKey, senderEmail, senderName, notifyEmail };
};

export const isBrevoConfigured = () => {
  const { apiKey, senderEmail } = getConfig();
  return Boolean(apiKey && senderEmail);
};

export async function sendBrevoEmail(input: SendEmailInput): Promise<BrevoSendResult> {
  const { apiKey, senderEmail, senderName } = getConfig();

  if (!apiKey || !senderEmail) {
    return {
      ok: false,
      skipped: true,
      error: 'Brevo non configuré (BREVO_API_KEY / BREVO_SENDER_EMAIL).',
    };
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: input.to,
        subject: input.subject,
        htmlContent: input.htmlContent,
        textContent: input.textContent,
        replyTo: input.replyTo,
      }),
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        (body as any)?.message ||
        (body as any)?.error ||
        `Brevo HTTP ${response.status}`;
      return { ok: false, error: String(message) };
    }

    return { ok: true, messageId: (body as any)?.messageId };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'Erreur réseau Brevo' };
  }
}

export const getBrevoNotifyEmail = () => getConfig().notifyEmail || null;
