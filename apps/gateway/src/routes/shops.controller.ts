import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RpcService } from '../rpc/rpc.service';
import {
  CreateShopBody,
  ShopLaptopParams,
  ShopsByLaptopParams,
} from '../dto/catalog.dto';

@Controller('shops')
export class ShopsController {
  constructor(private readonly rpc: RpcService) {}

  @Get()
  findAll() {
    return this.rpc.catalogRequest('catalog.shops.findAll', {});
  }

  @Post()
  create(@Body() body: CreateShopBody) {
    return this.rpc.catalogRequest('catalog.shops.create', body);
  }

  @Post(':shopId/laptops/:laptopId')
  addLaptop(@Param() params: ShopLaptopParams) {
    return this.rpc.catalogRequest('catalog.shops.addLaptop', params);
  }

  @Get('laptop/:laptopId')
  findByLaptop(@Param() params: ShopsByLaptopParams) {
    return this.rpc.catalogRequest('catalog.shops.findByLaptop', params);
  }
}
