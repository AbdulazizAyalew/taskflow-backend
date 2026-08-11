import { Body, Controller, Get, Post, Param, ParseIntPipe } from '@nestjs/common';
import { CreateShopDto } from './dtos/create_shop_dto';
import { ShopsService } from './shops.service';
import { Shop } from './shop.entitiy';


@Controller('shops')
export class ShopsController {

    constructor(
        private readonly shopservice: ShopsService,
    ){}

    @Get()
    async getShops(): Promise<Shop[]>{
        return this.shopservice.getShops();
    }

    @Post()
    async createshop(@Body() newshop: CreateShopDto ): Promise<string>{
        return this.shopservice.createShops(newshop);
    }

    @Post(':shopId/laptops/:laptopId')
    async addLaptopToShop(
        @Param('shopId',ParseIntPipe) shopId:number,
        @Param('laptopId',ParseIntPipe) laptopId:number
    ): Promise<Shop>{
        
        return this.shopservice.addLaptopsToShop(shopId, laptopId);
    }


    @Get('/laptop/:laptopId')
    async shopsWithLaptop(
        @Param('laptopId', ParseIntPipe) laptopId: number
    ): Promise<Shop[]>{
        return this.shopservice.getShopsByLaptopId(laptopId);
    }
    
}
