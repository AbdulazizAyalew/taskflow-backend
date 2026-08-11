import { Entity, Column, PrimaryGeneratedColumn, ManyToMany, JoinTable } from "typeorm";
import { Laptop } from "src/laptops/Laptop.entity";

@Entity('shop')
export class Shop{
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToMany(() => Laptop)
    @JoinTable()
    laptops: Laptop[];

    @Column()
    name: string;

    @Column()
    location: string;
}