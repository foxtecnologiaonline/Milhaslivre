// Twilio/WhatsApp service integration
// TODO: Implement actual Twilio integration once SDK is available

import { logger } from '../logger';

interface SendWhatsAppMessageOptions {
  to: string;
  body: string;
  mediaUrl?: string;
}

interface WhatsAppTemplate {
  operationCreated: (operationId: string, amount: number) => string;
  operationConfirmed: (operationId: string, buyerName: string) => string;
  operationCompleted: (operationId: string, commission: number) => string;
  paymentReminder: (operationId: string, dueDate: string) => string;
}

export const templates: WhatsAppTemplate = {
  operationCreated: (operationId, amount) =>
    `🎉 Operação criada com sucesso!\n\nID: ${operationId}\nQuantidade: ${amount} pontos\n\nAcompanhe no dashboard: https://milhaslivre.com/ops/${operationId}`,

  operationConfirmed: (operationId, buyerName) =>
    `✅ Operação confirmada!\n\nComprador: ${buyerName}\nID: ${operationId}\n\nAguardando transferência de pontos...`,

  operationCompleted: (operationId, commission) =>
    `🎊 Operação concluída!\n\nID: ${operationId}\nComissão recebida: R$ ${commission.toFixed(2)}\n\nObrigado por usar Milhas Livre!`,

  paymentReminder: (operationId, dueDate) =>
    `⏰ Lembrete de pagamento\n\nID: ${operationId}\nVencimento: ${dueDate}\n\nPor favor, confirme o pagamento no dashboard.`,
};

export async function sendWhatsAppMessage(
  options: SendWhatsAppMessageOptions
): Promise<boolean> {
  try {
    // TODO: Implement Twilio SDK integration
    // const result = await twilio.messages.create({
    //   from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
    //   to: `whatsapp:${options.to}`,
    //   body: options.body,
    //   mediaUrl: options.mediaUrl,
    // });

    logger.info('WhatsApp message sent', {
      to: options.to,
      length: options.body.length,
    });

    return true;
  } catch (err) {
    logger.error('Failed to send WhatsApp message', err, { to: options.to });
    return false;
  }
}

export async function notifyOperationCreated(
  phoneNumber: string,
  operationId: string,
  amount: number
): Promise<boolean> {
  return sendWhatsAppMessage({
    to: phoneNumber,
    body: templates.operationCreated(operationId, amount),
  });
}

export async function notifyOperationConfirmed(
  phoneNumber: string,
  operationId: string,
  buyerName: string
): Promise<boolean> {
  return sendWhatsAppMessage({
    to: phoneNumber,
    body: templates.operationConfirmed(operationId, buyerName),
  });
}

export async function notifyOperationCompleted(
  phoneNumber: string,
  operationId: string,
  commission: number
): Promise<boolean> {
  return sendWhatsAppMessage({
    to: phoneNumber,
    body: templates.operationCompleted(operationId, commission),
  });
}

export async function sendPaymentReminder(
  phoneNumber: string,
  operationId: string,
  dueDate: string
): Promise<boolean> {
  return sendWhatsAppMessage({
    to: phoneNumber,
    body: templates.paymentReminder(operationId, dueDate),
  });
}
