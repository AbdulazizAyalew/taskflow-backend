import { LaptopsModule } from './laptops/laptops.module';
import { Module } from '@nestjs/common';

@Module({
  imports: [LaptopsModule], 
})
export class AppModule {}
