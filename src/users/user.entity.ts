import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';
import { UserRole } from 'src/common/enums/user-role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @Column({
    type:'enum',
    enum:UserRole,
    default:UserRole.USER,
  })
  role:UserRole;
}
