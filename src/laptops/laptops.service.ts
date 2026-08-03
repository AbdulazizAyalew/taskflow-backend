import { Injectable } from '@nestjs/common';
import { Laptop } from './interfaces/Laptops.interface';
import { CreateLaptopDto } from './dto/create-laptop.dto';

@Injectable()
export class LaptopsService {
  public laptopsdata: Array<Laptop> = [
    {
      id: 1022,
      description: 'A brand new Lenovo Laptop',
      brand: 'Lenovo Yoga',
      ram: 16,
      price: 125000,
    },
    {
      id: 1023,
      description: 'A brand new HP Laptop',
      brand: 'HP Elitebook',
      ram: 16,
      price: 52000,
    },
    {
      id: 1024,
      description: 'A brand new Macbook M5 PRO Laptop',
      brand: 'Macbook M5 Pro 24GB Unified Memory',
      ram: 16,
      price: 550000,
    },
  ];


  // Returns all the available Laptops
  async loadLaptops(): Promise<Laptop[]> {
    return this.laptopsdata;
  }

  // Finds a Laptop by ID
  async loadlaptopById(id): Promise<Laptop>{

    for (const laptop of this.laptopsdata) {
        if (laptop.id === id){
            return laptop;
        }
    }
    return {
      id: 404,
      description: 'None',
      brand: '404',
      ram: 0,
      price: 0,
    };
    
  }

  // Adds the new Laptop into the Laptops data
  async createLaptop(newLaptop: CreateLaptopDto ): Promise<string>{
    this.laptopsdata.push(newLaptop);
    return `Successfully added \n ${JSON.stringify(newLaptop,null,2)}`;
  }
}
