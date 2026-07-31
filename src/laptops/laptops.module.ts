import { Module } from '@nestjs/common';
import { LaptopsController } from './laptops.controller';
import { LaptopsService } from './laptops.service';

@Module({
  controllers: [LaptopsController],
  providers: [LaptopsService]
})
export class LaptopsModule {}
