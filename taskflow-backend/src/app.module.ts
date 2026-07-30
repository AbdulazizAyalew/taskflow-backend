import { LaptopsModule } from './laptops/laptops.module';
import { Module } from '@nestjs/common';

@Module({
  imports: [LaptopsModule], // Must be here
})
export class AppModule {}
