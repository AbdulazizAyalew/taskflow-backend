import { Body, Controller, Get, Param, Patch, Post, Delete, UseGuards } from '@nestjs/common';
import {LaptopsService} from './laptops.service';
import { CreateLaptopDto } from './dto/create-laptop.dto';
import { updateLaptopDto } from './dto/update-laptop.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Public } from 'src/common/decorators/public.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/common/enums/user-role.enum';

@Controller('laptops')
@UseGuards(JwtAuthGuard,RolesGuard)
export class LaptopsController {

  constructor(private readonly laptopsService: LaptopsService) {}


  @Public()
  @Get()
  getLaptops() {
    return this.laptopsService.loadLaptops();
  }


  @Public()
  @Get(':id')
  getLaptopById(@Param('id') id: number) {
    return this.laptopsService.loadlaptopById(Number(id));
  }


  @Post()
  createLaptop(@Body() newLaptop: CreateLaptopDto) {
    return this.laptopsService.createLaptop(newLaptop);
  }


  @Patch(':id')
  updateLaptopById(
    @Param('id') id: number,
    @Body() updatedLaptop: updateLaptopDto,
  ) {
    return this.laptopsService.updateLaptopById(Number(id), updatedLaptop);
  }


  @Roles(UserRole.USER)
  @Delete(':id')
  deleteLaptopById(@Param('id') id: number) {
    return this.laptopsService.deleteLaptopById(Number(id));
  }

}
