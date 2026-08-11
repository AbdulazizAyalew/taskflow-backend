import { Module } from '@nestjs/common';
import { ShopsController } from './shops.controller';
import { ShopsService } from './shops.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shop } from './shop.entitiy';
import { Laptop } from 'src/laptops/Laptop.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Shop,Laptop])],
  controllers: [ShopsController],
  providers: [ShopsService]
})
export class ShopsModule {}
