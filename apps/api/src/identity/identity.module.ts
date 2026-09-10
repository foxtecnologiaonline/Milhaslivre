import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { Env } from '../config/env.schema';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RolesGuard } from './guards/roles.guard';
import { IDENTITY_REPOSITORY } from './identity.repository';
import { PgIdentityRepository } from './identity.repository.pg';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { MeController } from './me.controller';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: { expiresIn: config.get('JWT_EXPIRY', { infer: true }) },
      }),
    }),
  ],
  controllers: [IdentityController, MeController],
  providers: [
    IdentityService,
    JwtStrategy,
    RolesGuard,
    { provide: IDENTITY_REPOSITORY, useClass: PgIdentityRepository },
  ],
  exports: [IdentityService, RolesGuard],
})
export class IdentityModule {}
