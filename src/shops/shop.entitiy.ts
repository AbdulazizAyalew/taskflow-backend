import { Entity, Column, PrimaryGeneratedColumn, ManyToMany, JoinTable, OneToOne, JoinColumn } from "typeorm";
import { Laptop } from "src/laptops/Laptop.entity";
import { User } from "src/users/user.entity";

@Entity('shop')
export class Shop{
    @PrimaryGeneratedColumn()
    id: number;

    @OneToOne(()=>User,{
        nullable:true,
        onDelete:'SET NULL',
    })
    @JoinColumn({name:'userId'})
    user:User;

    @Column({ nullable: true })
    userId: string;
    
    @ManyToMany(() => Laptop)
    @JoinTable()
    laptops: Laptop[];

    @Column()
    name: string;

    @Column()
    location: string;
}