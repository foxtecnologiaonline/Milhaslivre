// PDF contract generation service (pdfkit)
import PDFDocument from 'pdfkit';
import { logger } from '../logger';

export interface ContractData {
  operationId: string;
  sellerId: string;
  sellerName: string;
  buyerId: string;
  buyerName: string;
  program: string;
  amount: number;
  pricePerThousand: number;
  totalPrice: number;
  commissionPercentage: number;
  commissionAmount: number;
  date: Date;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(date);
}

async function renderPDF(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    build(doc);
    doc.end();
  });
}

export async function generateContract(data: ContractData): Promise<Buffer> {
  try {
    const buffer = await renderPDF((doc) => {
      doc
        .fontSize(18)
        .text('Contrato de Intermediação de Pontos/Milhas', { align: 'center' })
        .moveDown(1.5);

      doc.fontSize(10).fillColor('#555').text(`Operação: ${data.operationId}`);
      doc.text(`Data: ${formatDate(data.date)}`);
      doc.moveDown();

      doc.fillColor('#000').fontSize(12).text('Partes', { underline: true });
      doc.fontSize(10);
      doc.text(`Vendedor: ${data.sellerName} (ID: ${data.sellerId})`);
      doc.text(`Comprador: ${data.buyerName} (ID: ${data.buyerId})`);
      doc.moveDown();

      doc.fontSize(12).text('Objeto', { underline: true });
      doc.fontSize(10);
      doc.text(`Programa: ${data.program}`);
      doc.text(`Quantidade: ${data.amount.toLocaleString('pt-BR')} pontos`);
      doc.text(`Preço por milheiro: ${formatCurrency(data.pricePerThousand)}`);
      doc.moveDown();

      doc.fontSize(12).text('Valores', { underline: true });
      doc.fontSize(10);
      doc.text(`Valor total: ${formatCurrency(data.totalPrice)}`);
      doc.text(
        `Comissão Milhas Livre (${data.commissionPercentage}%): ${formatCurrency(data.commissionAmount)}`
      );
      doc.text(`Valor líquido ao vendedor: ${formatCurrency(data.totalPrice - data.commissionAmount)}`);
      doc.moveDown(2);

      doc
        .fontSize(9)
        .fillColor('#777')
        .text(
          'Este contrato formaliza a intermediação realizada pela Milhas Livre entre as partes acima, ' +
            'nos termos dos valores e condições descritos.',
          { align: 'justify' }
        );
    });

    logger.info('Contract generated', { operationId: data.operationId, bytes: buffer.length });
    return buffer;
  } catch (err) {
    logger.error('Failed to generate contract', err, {
      operationId: data.operationId,
    });
    throw err;
  }
}

export async function generateReceiptPDF(
  operationId: string,
  amount: number,
  commission: number
): Promise<Buffer> {
  try {
    const buffer = await renderPDF((doc) => {
      doc.fontSize(18).text('Recibo', { align: 'center' }).moveDown(1.5);
      doc.fontSize(10);
      doc.text(`Operação: ${operationId}`);
      doc.text(`Data: ${formatDate(new Date())}`);
      doc.moveDown();
      doc.text(`Valor da operação: ${formatCurrency(amount)}`);
      doc.text(`Comissão Milhas Livre: ${formatCurrency(commission)}`);
    });

    logger.info('Receipt generated', { operationId, amount, commission, bytes: buffer.length });
    return buffer;
  } catch (err) {
    logger.error('Failed to generate receipt', err, { operationId });
    throw err;
  }
}

export async function generateStatement(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<Buffer> {
  try {
    const buffer = await renderPDF((doc) => {
      doc.fontSize(18).text('Extrato de Operações', { align: 'center' }).moveDown(1.5);
      doc.fontSize(10);
      doc.text(`Usuário: ${userId}`);
      doc.text(`Período: ${formatDate(startDate)} — ${formatDate(endDate)}`);
    });

    logger.info('Statement generated', { userId, startDate, endDate, bytes: buffer.length });
    return buffer;
  } catch (err) {
    logger.error('Failed to generate statement', err, { userId });
    throw err;
  }
}
