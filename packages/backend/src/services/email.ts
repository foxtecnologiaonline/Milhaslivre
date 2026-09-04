// Email notification service (SendGrid)
import sgMail from '@sendgrid/mail';
import { logger } from '../logger';

const FROM_ADDRESS = process.env.SENDGRID_FROM_EMAIL || 'no-reply@milhaslivre.com';

let configured = false;

function ensureConfigured(): boolean {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return false;

  if (!configured) {
    sgMail.setApiKey(apiKey);
    configured = true;
  }
  return true;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  if (!ensureConfigured()) {
    logger.info('Email not configured, skipping send (dev no-op)', {
      to: options.to,
      subject: options.subject,
    });
    return false;
  }

  try {
    await sgMail.send({
      to: options.to,
      from: FROM_ADDRESS,
      subject: options.subject,
      html: options.html,
    });

    logger.info('Email sent', { to: options.to, subject: options.subject });
    return true;
  } catch (err) {
    logger.error('Failed to send email', err, { to: options.to, subject: options.subject });
    return false;
  }
}

export async function sendWelcomeEmail(to: string, name: string): Promise<boolean> {
  return sendEmail({
    to,
    subject: 'Bem-vindo(a) à Milhas Livre!',
    html: `
      <h2>Olá, ${name}!</h2>
      <p>Sua conta na Milhas Livre foi criada com sucesso.</p>
      <p>Você já pode criar operações e acompanhar suas cotações no dashboard.</p>
    `,
  });
}

export async function sendOperationConfirmedEmail(
  to: string,
  operationId: string,
  buyerName: string
): Promise<boolean> {
  return sendEmail({
    to,
    subject: `Operação ${operationId} confirmada`,
    html: `
      <h2>Operação confirmada</h2>
      <p>Comprador: ${buyerName}</p>
      <p>ID da operação: ${operationId}</p>
      <p>Aguardando transferência de pontos e pagamento.</p>
    `,
  });
}

export async function sendPaymentReceiptEmail(
  to: string,
  operationId: string,
  amount: number,
  commission: number
): Promise<boolean> {
  return sendEmail({
    to,
    subject: `Recibo da operação ${operationId}`,
    html: `
      <h2>Operação concluída</h2>
      <p>ID: ${operationId}</p>
      <p>Valor: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)}</p>
      <p>Comissão Milhas Livre: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(commission)}</p>
    `,
  });
}
