import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { ServiceType } from './Transaction';

@Entity('join_us')
export class JoinUs {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column()
  name: string;

  @Column()
  phone: string;

  @Column({
    name: 'engineering_type',
    type: 'simple-array'
  })
  engineeringType: ServiceType[];

  @Column({ type: 'text' })
  skills: string;

  @Column({ name: 'graduated_at', type: 'bigint' })
  graduatedAt: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
