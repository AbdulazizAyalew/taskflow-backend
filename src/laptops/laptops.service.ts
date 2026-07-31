import { Injectable } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { Laptop } from './interfaces/Laptops.interface';

@Injectable()
export class LaptopsService {

    async loadLaptops(path): Promise<Laptop[]>{
        const raw = await readFile(path, 'utf-8');
        const data = JSON.parse(raw) as Laptop[];
        return data;
    }
}
