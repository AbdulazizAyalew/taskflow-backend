import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ShopsService } from './shops.service';
import {
  CreateShopMessage,
  ShopLaptopMessage,
  ShopsByLaptopMessage,
} from '@app/shared';

// Preserve existing public shop routes. Do not invent ownership rules in migration.
@Controller()
export class ShopsController {
  constructor(private readonly shops: ShopsService) {}

  @MessagePattern('catalog.shops.findAll')
  findAll() {
    return this.shops.findAll();
  }

  @MessagePattern('catalog.shops.create')
  create(@Payload() data: CreateShopMessage) {
    return this.shops.create(data);
  }

  @MessagePattern('catalog.shops.addLaptop')
  addLaptop(@Payload() data: ShopLaptopMessage) {
    return this.shops.addLaptop(data.shopId, data.laptopId);
  }

  @MessagePattern('catalog.shops.findByLaptop')
  findByLaptop(@Payload() data: ShopsByLaptopMessage) {
    return this.shops.findByLaptop(data.laptopId);
  }
}
