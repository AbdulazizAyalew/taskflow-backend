import { Module } from '@nestjs/common';
import { ShopsController } from './shops.controller';
import { ShopsService } from './shops.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shop } from './shop.entitiy';
import { Laptop } from 'src/laptops/Laptop.entity';
import { BullModule, BullQueueEvents } from '@nestjs/bull';

@Module({
  imports: [
    TypeOrmModule.forFeature([Shop,Laptop]),
    BullModule.registerQueue({
      name:'notifications',
    }),
  ],
  controllers: [ShopsController],
  providers: [ShopsService]
})
export class ShopsModule {}
