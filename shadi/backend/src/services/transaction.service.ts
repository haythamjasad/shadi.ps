import { AppDataSource } from '../config/database';
import { Transaction, Status, Location, ServiceType } from '../entities/Transaction';
import { AppError } from '../utils/AppError';
import {
  PaginationParams,
  PaginatedResponse,
  createPaginatedResponse,
} from '../types/pagination';

const transactionRepository = AppDataSource.getRepository(Transaction);

export interface TransactionFilters {
  name?: string;
  phone?: string;
  status?: Status[];
  serviceType?: ServiceType;
  location?: Location;
  paidOnly?: boolean;
  unpaidOnly?: boolean;
}

export class TransactionService {
  static prepareCreateData(data: Partial<Transaction>): Partial<Transaction> {
    const serviceTypes = Array.isArray(data.serviceType)
      ? data.serviceType
      : data.serviceType
        ? [data.serviceType as ServiceType]
        : [];

    if (serviceTypes.length === 0) {
      throw new AppError(400, 'INVALID_SERVICE_TYPE', 'At least one service type is required');
    }

    const sanitizedData: Partial<Transaction> = {
      name: data.name,
      phone: data.phone,
      email: data.email,
      serviceType: serviceTypes,
      location: data.location,
      notes: data.notes,
    };

    let cost = 0;

    serviceTypes.forEach((type) => {
      if (type === ServiceType.CHARGES) {
        cost += data.cost ? data.cost : 0;
      } else {
        if (sanitizedData.location === Location.ZOOM) {
          cost += 50;
        } else {
          cost += 100;
        }
      }
    });

    sanitizedData.cost = cost;

    return sanitizedData;
  }

  static async create(data: Partial<Transaction>): Promise<Transaction> {
    const sanitizedData = TransactionService.prepareCreateData(data);

    const transaction = transactionRepository.create(sanitizedData);
    return transactionRepository.save(transaction);
  }

  static async update(id: string, data: Partial<Transaction>): Promise<Transaction> {
    const transaction = await transactionRepository.findOne({ where: { id } });

    if (!transaction) {
      throw new AppError(404, 'NOT_FOUND', 'Transaction not found');
    }

    // Object.assign(transaction, data); // to copy all props from data to transaction

    if (data.status !== undefined) {
      transaction.status = data.status;
    }
    if (data.adminNotes !== undefined) {
      transaction.adminNotes = data.adminNotes;
    }

    if (data.cardType !== undefined) {
      transaction.cardType = data.cardType;
    }

    if (data.transactionNO !== undefined) {
      transaction.transactionNO = data.transactionNO;
    }

    if (data.transactionDate !== undefined) {
      transaction.transactionDate = data.transactionDate;
    }

    if (data.transactionAmount !== undefined) {
      transaction.transactionAmount = data.transactionAmount;
    }

    if (data.cardNo !== undefined) {
      transaction.cardNo = data.cardNo;
    }

    return transactionRepository.save(transaction);
  }

  static async findById(id: string): Promise<Transaction> {
    const transaction = await transactionRepository.findOne({ where: { id } });

    if (!transaction) {
      throw new AppError(404, 'NOT_FOUND', 'Transaction not found');
    }

    return transaction;
  }

  static async findByTransactionNo(transactionNO: string): Promise<Transaction | null> {
    if (!transactionNO) return null;

    return transactionRepository.findOne({ where: { transactionNO } });
  }

  static async findAll(
    filters: TransactionFilters,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<Transaction>> {
    const queryBuilder = transactionRepository.createQueryBuilder('transaction');

    // Apply filters
    if (filters.name) {
      queryBuilder.andWhere('transaction.name LIKE :name', {
        name: `%${filters.name}%`,
      });
    }

    if (filters.phone) {
      queryBuilder.andWhere('transaction.phone LIKE :phone', {
        phone: `%${filters.phone}%`,
      });
    }

    if (filters.status) {
      queryBuilder.andWhere('transaction.status IN (:...status)', {
        status: filters.status,
      });
    }

    if (filters.serviceType) {
      queryBuilder.andWhere('transaction.serviceType = :serviceType', {
        serviceType: filters.serviceType,
      });
    }

    if (filters.location) {
      queryBuilder.andWhere('transaction.location = :location', {
        location: filters.location,
      });
    }

    if (filters.paidOnly) {
      queryBuilder
        .andWhere('transaction.transactionNO IS NOT NULL')
        .andWhere('transaction.transactionAmount IS NOT NULL');
    }

    if (filters.unpaidOnly) {
      queryBuilder.andWhere(
        '(transaction.transactionNO IS NULL OR transaction.transactionAmount IS NULL)'
      );
    }

    // Apply sorting
    const sortField = pagination.sort || 'createdAt';
    const sortOrder = pagination.order || 'DESC';
    queryBuilder.orderBy(`transaction.${sortField}`, sortOrder);

    // Apply pagination
    const skip = (pagination.page - 1) * pagination.size;
    queryBuilder.skip(skip).take(pagination.size);

    const [data, total] = await queryBuilder.getManyAndCount();

    return createPaginatedResponse(data, total, pagination);
  }

  static async delete(id: string): Promise<void> {
    const result = await transactionRepository.delete(id);

    if (result.affected === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Transaction not found');
    }
  }
}
