import { Module } from '@nestjs/common';
import { LaptopsController } from './laptops.controller';
import { LaptopsService } from './laptops.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [LaptopsController],
  providers: [LaptopsService]
})
export class LaptopsModule {}
