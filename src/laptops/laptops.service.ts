import { Injectable,NotFoundException } from '@nestjs/common';
import { LaptopInterface } from './interfaces/Laptops.interface';
import { CreateLaptopDto } from './dto/create-laptop.dto';
import { updateLaptopDto } from './dto/update-laptop.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Laptop } from './Laptop.entity';

@Injectable()
export class LaptopsService {

  constructor(
    @InjectRepository(Laptop)
    private laptopRepository: Repository<Laptop>,
  ) {}

  
  // Returns all the available Laptops
  async loadLaptops(): Promise<LaptopInterface[]> {
    return this.laptopRepository.find();
  }


  // Finds a Laptop by ID
  async loadlaptopById(id): Promise<LaptopInterface> {
    const laptop = await this.laptopRepository.findOne({
      where: { id },
    });
    if (laptop) {
      return laptop;
    }
    throw new NotFoundException(`Laptop with ID: ${id} Not Found!`);
  }


  // Adds the new Laptop into the Laptops data
  async createLaptop(newLaptop: CreateLaptopDto): Promise<Laptop> {
    const newlapt = await this.laptopRepository.create(newLaptop);

    return await this.laptopRepository.save(newlapt);
  }


  async updateLaptopById(
    id: number,
    updatedLaptop: updateLaptopDto,
  ): Promise<Laptop> {

    const laptop = await this.laptopRepository.findOne({
      where: { id },
    });

    if (!laptop) {
      throw new NotFoundException(`Laptop with id ${id} not found`);
    }

    // Merge the new incoming data onto the existing database object
    Object.assign(laptop, updatedLaptop);

    // TypeORM sees the ID already exists, so it runs an SQL UPDATE
    return await this.laptopRepository.save(laptop);
  }


  async deleteLaptopById(id: number): Promise<Laptop> {
    const laptop = await this.laptopRepository.findOne({
      where: {id}
    })

    if (!laptop){
      throw new NotFoundException(`Laptop with ${id} not found`);
    }
    return await this.laptopRepository.remove(laptop);
    
  }

}
