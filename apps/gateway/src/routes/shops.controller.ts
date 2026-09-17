import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RpcService } from '../rpc/rpc.service';
import {
  CreateShopMessage,
  ShopLaptopMessage,
  ShopsByLaptopMessage,
} from '@app/shared';

@Controller('shops')
export class ShopsController {
  constructor(private readonly rpc: RpcService) {}

  @Get()
  findAll() {
    return this.rpc.catalogRequest('catalog.shops.findAll', {});
  }

  @Post()
  create(@Body() body: CreateShopMessage) {
    return this.rpc.catalogRequest('catalog.shops.create', body);
  }

  @Post(':shopId/laptops/:laptopId')
  addLaptop(@Param() params: ShopLaptopMessage) {
    return this.rpc.catalogRequest('catalog.shops.addLaptop', params);
  }

  @Get('laptop/:laptopId')
  findByLaptop(@Param() params: ShopsByLaptopMessage) {
    return this.rpc.catalogRequest('catalog.shops.findByLaptop', params);
  }
}
