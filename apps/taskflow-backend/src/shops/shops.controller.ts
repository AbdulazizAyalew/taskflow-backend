import { Body, Controller, Get, Post, Param, ParseIntPipe } from '@nestjs/common';
import { CreateShopDto } from './dtos/create_shop_dto';
import { ShopsService } from './shops.service';
import { CreateLaptopDto } from 'src/laptops/dto/create-laptop.dto';
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
    async createshop(
        @Body('shop') newshop: CreateShopDto,
        @Body('laptop') newLaptop: CreateLaptopDto
 ): Promise<string>{

        return this.shopservice.createShop(newshop,newLaptop);

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
