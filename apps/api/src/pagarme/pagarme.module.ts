import { Module } from '@nestjs/common';
import { PagarmeService } from './pagarme.service';

@Module({
  providers: [PagarmeService],
  exports: [PagarmeService],
})
export class PagarmeModule {}
