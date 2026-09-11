import { Module } from '@nestjs/common';
import { MelhorEnvioService } from './melhorenvio.service';

@Module({
  providers: [MelhorEnvioService],
  exports: [MelhorEnvioService],
})
export class MelhorEnvioModule {}
