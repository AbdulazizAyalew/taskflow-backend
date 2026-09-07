import {
  Column,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Laptop } from '../laptops/laptop.entity';

@Entity('shop')
export class Shop {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'integer', nullable: true })
  userId: number | null;

  @ManyToMany(() => Laptop)
  @JoinTable()
  laptops: Laptop[];

  @Column()
  name: string;

  @Column()
  location: string;
}
