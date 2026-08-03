import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {LaptopsService} from './laptops.service';
import { CreateLaptopDto } from './dto/create-laptop.dto';
import { updateLaptopDto } from './dto/update-laptop.dto';

@Controller('laptops')
export class LaptopsController {

    // Injecting the service for the controller
    constructor(private readonly laptopsService: LaptopsService){}

    @Get()
    getLaptops(){
        return this.laptopsService.loadLaptops();
    }

    @Get(':id')
    getLaptopById(@Param('id') id: number){
        return this.laptopsService.loadlaptopById(Number(id));
    }

    @Post()
    createLaptop(@Body() newLaptop:CreateLaptopDto){
        return this.laptopsService.createLaptop(newLaptop);
    }

    @Patch(':id')
    updateLaptopById(@Param('id') id:number, @Body() updatedLaptop:updateLaptopDto){
        return this.laptopsService.updateLaptopById(Number(id),updatedLaptop);
    }
}

