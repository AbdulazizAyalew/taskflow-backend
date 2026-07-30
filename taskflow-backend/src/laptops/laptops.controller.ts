import { Controller, Get } from '@nestjs/common';
import {LaptopsService} from './laptops.service';

@Controller('laptops')
export class LaptopsController {

    // Inject 
    constructor(private readonly laptopsService: LaptopsService){}

    @Get()
    getLaptops(){
        return this.laptopsService.loadLaptops('./src/datas/Laptops.json');
    }
}
