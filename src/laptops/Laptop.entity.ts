import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from "typeorm";
import { User} from "src/users/user.entity";

@Entity('laptops')
export class Laptop{
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(()=>User,{
        nullable: true,
        onDelete: 'SET NULL',
    })
    @JoinColumn({name:'userId'})
    user: User;

    @Column({ nullable: true })
    userId: string;

    @Column()
    description: string;

    @Column()
    brand: string;

    @Column()
    ram: number;
    
    @Column()
    price: number;
}