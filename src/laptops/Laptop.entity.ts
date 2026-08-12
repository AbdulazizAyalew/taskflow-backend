import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";

@Entity('laptops')
export class Laptop{
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    description: string;

    @Column()
    brand: string;

    @Column()
    ram: number;
    
    @Column()
    price: number;
}