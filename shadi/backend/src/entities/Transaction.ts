import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum Status {
  NEW = 'NEW',
  PENDING = 'PENDING',
  PAUSED = 'PAUSED',
  FINISHED = 'FINISHED',
  CANCELLED = 'CANCELLED',
}

export enum Location {
  RAMMALLAH = 'RAMMALLAH',
  NABLUS = 'NABLUS',
  SALFIT = 'SALFIT',
  BETHLEHEM = 'BETHLEHEM',
  TULKAREM = 'TULKAREM',
  ZOOM = 'ZOOM',
}

export enum ServiceType {
  MECHANIC = 'MECHANIC',
  ELECTRIC = 'ELECTRIC',
  CIVIL = 'CIVIL',
  ARCHITECTURAL = 'ARCHITECTURAL',
  CHARGES = 'CHARGES',
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column()
  name: string;

  @Column()
  phone: string;

  @Column()
  email: string;

  @Column({
    name: 'service_type',
    type: 'simple-array',
  })
  serviceType: ServiceType[];

  @Column({
    type: 'enum',
    enum: Location,
    nullable: true
  })
  location: Location;

  @Column({
    type: 'enum',
    enum: Status,
    default: Status.NEW,
  })
  status: Status;

  @Column({ type: 'bigint' })
  cost: number;

  @Column({ type: 'text' })
  notes: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @Column({ name: 'service_at', type: 'timestamp', nullable: true })
  serviceAt: Date | null;

  @Column({ name: 'admin_notes', type: 'text', nullable: true })
  adminNotes: string | null;

  @Column({ name: 'card_type', type: 'text', nullable: true })
  cardType: string | null;

  @Column({ name: 'transaction_no', type: 'text', nullable: true })
  transactionNO: string | null;

  @Column({ name: 'transaction_date', type: 'text', nullable: true })
  transactionDate: string | null;

  @Column({ name: 'transaction_amount', type: 'bigint', nullable: true })
  transactionAmount: number | null;

  @Column({ name: 'card_no', type: 'text', nullable: true })
  cardNo: string | null;
}
