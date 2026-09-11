import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { OrdersModule } from '../orders/orders.module';
import { PagarmeModule } from '../pagarme/pagarme.module';
import { SellerModule } from '../seller/seller.module';
import { IDEMPOTENCY_REPOSITORY } from './idempotency.repository';
import { PgIdempotencyRepository } from './idempotency.repository.pg';
import { PAYMENT_REPOSITORY } from './payment.repository';
import { PgPaymentRepository } from './payment.repository.pg';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { SPLIT_TRANSACTION_REPOSITORY } from './split-transaction.repository';
import { PgSplitTransactionRepository } from './split-transaction.repository.pg';
import { WEBHOOK_EVENT_REPOSITORY } from './webhook-event.repository';
import { PgWebhookEventRepository } from './webhook-event.repository.pg';

@Module({
  imports: [IdentityModule, OrdersModule, SellerModule, PagarmeModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    { provide: PAYMENT_REPOSITORY, useClass: PgPaymentRepository },
    { provide: SPLIT_TRANSACTION_REPOSITORY, useClass: PgSplitTransactionRepository },
    { provide: IDEMPOTENCY_REPOSITORY, useClass: PgIdempotencyRepository },
    { provide: WEBHOOK_EVENT_REPOSITORY, useClass: PgWebhookEventRepository },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
