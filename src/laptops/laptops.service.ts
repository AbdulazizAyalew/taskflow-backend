import { ForbiddenException, Injectable,NotFoundException } from '@nestjs/common';
import { LaptopInterface } from './interfaces/Laptops.interface';
import { CreateLaptopDto } from './dto/create-laptop.dto';
import { updateLaptopDto } from './dto/update-laptop.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Laptop } from './Laptop.entity';
import { UserRole } from 'src/common/enums/user-role.enum';

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
  async createLaptop(newLaptop: CreateLaptopDto, user:any): Promise<Laptop> {
    const newlapt = await this.laptopRepository.create({
      ...newLaptop,
      userId: user.userId,
    });

    return await this.laptopRepository.save(newlapt);
  }


  async updateLaptopById(
    id: number,
    updatedLaptop: updateLaptopDto,
    user: any,
  ): Promise<Laptop> {

    const laptop = await this.laptopRepository.findOne({
      where: { id },
    });

    if (!laptop) {
      throw new NotFoundException(`Laptop with id ${id} not found`);
    }

    if (laptop.userId !== user.userId){
      throw new ForbiddenException('You can only edit your own laptops')
    }
    // To merge the incoming updated data with the existing laptop data
    Object.assign(laptop, updatedLaptop);

    return await this.laptopRepository.save(laptop);
  }


  async deleteLaptopById(id: number, user: any): Promise<Laptop> {
    const laptop = await this.laptopRepository.findOne({
      where: {id}
    })

    if (!laptop){
      throw new NotFoundException(`Laptop with ${id} not found`);
    }

    if (laptop.userId != user.userId) {
      if (user.role !== UserRole.ADMIN){
        throw new ForbiddenException('You can only delete you own Laptops');
      }
      
    }
    return await this.laptopRepository.remove(laptop);
    
  }

}
