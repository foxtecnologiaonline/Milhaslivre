import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { DatabaseModule } from './database/database.module';
import { validateEnv } from './config/env.schema';
import { IdentityModule } from './identity/identity.module';
import { SellerModule } from './seller/seller.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    DatabaseModule,
    IdentityModule,
    SellerModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
