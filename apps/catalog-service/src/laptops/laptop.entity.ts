import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('laptops')
export class Laptop {
  @PrimaryGeneratedColumn()
  id: number;

  // External identity reference; there is no cross-database User relation.
  @Index()
  @Column({ type: 'integer', nullable: true })
  userId: number | null;

  @Column()
  description: string;

  @Index()
  @Column()
  brand: string;

  @Column()
  ram: number;

  @Column()
  price: number;
}
