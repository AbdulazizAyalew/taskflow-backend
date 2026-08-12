import { Module } from '@nestjs/common';
import { LaptopsController } from './laptops.controller';
import { LaptopsService } from './laptops.service';
import { AuthModule } from 'src/auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Laptop } from './Laptop.entity';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Laptop])
  ],
  controllers: [LaptopsController],
  providers: [LaptopsService]
})
export class LaptopsModule {}
