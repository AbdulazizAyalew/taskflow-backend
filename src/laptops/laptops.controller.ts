import { Body, Controller, Get, Param, Patch, Post, Delete, UseGuards } from '@nestjs/common';
import {LaptopsService} from './laptops.service';
import { CreateLaptopDto } from './dto/create-laptop.dto';
import { updateLaptopDto } from './dto/update-laptop.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('laptops')
export class LaptopsController {
  // Injecting the service for the controller
  constructor(private readonly laptopsService: LaptopsService) {}

  @Get()
  getLaptops() {
    return this.laptopsService.loadLaptops();
  }

  @Get(':id')
  getLaptopById(@Param('id') id: number) {
    return this.laptopsService.loadlaptopById(Number(id));
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  createLaptop(@Body() newLaptop: CreateLaptopDto) {
    return this.laptopsService.createLaptop(newLaptop);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  updateLaptopById(
    @Param('id') id: number,
    @Body() updatedLaptop: updateLaptopDto,
  ) {
    return this.laptopsService.updateLaptopById(Number(id), updatedLaptop);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  deleteLaptopById(@Param('id') id: number) {
    return this.laptopsService.deleteLaptopById(Number(id));
  }
}
