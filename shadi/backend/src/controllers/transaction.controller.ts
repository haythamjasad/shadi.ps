import { Request, Response, NextFunction } from "express";
import {
  TransactionService,
  TransactionFilters,
} from "../services/transaction.service";
import { parsePaginationParams } from "../types/pagination";
import { Transaction, Status, Location, ServiceType } from "../entities/Transaction";
import {PaymentService} from "../services/payment.service";
import { config } from "../config/env";
import { EmailService } from "../services/email.service";
import { EmailTemplate } from '../utils/EmailTemplete';
import { v4 as uuidv4 } from 'uuid';

export class TransactionController {
  private static firstNonEmpty(...values: unknown[]) {
    for (const value of values) {
      const normalized = String(value ?? '').trim();
      if (normalized) return normalized;
    }
    return null;
  }

  private static extractPaymentFields(rawPayment: Record<string, any> | undefined) {
    const authorization = rawPayment?.authorization && typeof rawPayment.authorization === 'object'
      ? rawPayment.authorization
      : undefined;

    const cardType = TransactionController.firstNonEmpty(
      authorization?.brand,
      authorization?.card_type,
      authorization?.cardType,
      rawPayment?.brand,
      rawPayment?.card_type,
      rawPayment?.cardType,
      rawPayment?.channel
    );

    const last4 = TransactionController.firstNonEmpty(
      authorization?.last4,
      authorization?.last_4,
      rawPayment?.last4,
      rawPayment?.last_4,
      rawPayment?.card_last4,
      rawPayment?.cardLast4
    );

    return {
      cardType,
      cardNo: last4 ? `**** **** **** ${last4}` : null,
      transactionDate: TransactionController.firstNonEmpty(
        rawPayment?.paidAt,
        rawPayment?.paid_at,
        rawPayment?.transaction_date,
        rawPayment?.created_at
      ),
      transactionNO: TransactionController.firstNonEmpty(
        rawPayment?.id,
        rawPayment?.transaction_id,
        rawPayment?.transactionId,
        rawPayment?.reference,
        rawPayment?.trxref
      ),
      transactionAmount: rawPayment?.amount ?? null,
    };
  }

  private static buildStatusFilters(req: Request, status: Status | Status[]): TransactionFilters {
    return {
      name: req.query.name as string,
      phone: req.query.phone as string,
      status: Array.isArray(status) ? status : [status],
      location: req.query.location as Location,
    };
  }

  private static buildPublicTransactionResponse(transaction: Awaited<ReturnType<typeof TransactionService.findById>>) {
    return {
      id: transaction.id,
      name: transaction.name,
      phone: transaction.phone,
      serviceType: transaction.serviceType,
      location: transaction.location,
      status: transaction.status,
      cost: transaction.cost,
      createdAt: transaction.createdAt,
      notes: transaction.notes,
    };
  }

  private static parseMetadataValue(value: unknown) {
    const normalized = String(value ?? '').trim();
    return normalized || null;
  }

  private static buildTransactionFromPayment(rawPayment: Record<string, any> | undefined) {
    const metadata = rawPayment?.metadata && typeof rawPayment.metadata === 'object'
      ? rawPayment.metadata as Record<string, any>
      : undefined;

    const serviceType = String(metadata?.service_type || '')
      .split(',')
      .map((item) => String(item || '').trim().toUpperCase())
      .filter((item): item is ServiceType => Object.values(ServiceType).includes(item as ServiceType));

    const location = TransactionController.parseMetadataValue(metadata?.location);
    const cost = metadata?.cost !== undefined && metadata?.cost !== null && metadata?.cost !== ''
      ? Number(metadata.cost)
      : undefined;

    if (!metadata?.customer_name || !metadata?.customer_email || !metadata?.customer_phone || serviceType.length === 0) {
      return null;
    }

    return {
      name: String(metadata.customer_name),
      email: String(metadata.customer_email),
      phone: String(metadata.customer_phone),
      notes: String(metadata.notes || ''),
      serviceType,
      location: location as Location | null,
      cost,
    } as Partial<Transaction>;
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const draftTransaction = TransactionService.prepareCreateData(req.body);
      const paymentReference = uuidv4().replace(/-/g, '');

      const paymentData = await PaymentService.createPaymentTransaction(
        String(draftTransaction.cost || 0) + "00",
        String(draftTransaction.email || ''),
        "USD",
        paymentReference,
        config.hostApiUrl + "/transactions/verify-payment/" + paymentReference,
        {
          customer_name: String(draftTransaction.name || ''),
          customer_email: String(draftTransaction.email || ''),
          customer_phone: String(draftTransaction.phone || ''),
          notes: String(draftTransaction.notes || ''),
          location: draftTransaction.location || '',
          service_type: Array.isArray(draftTransaction.serviceType)
            ? draftTransaction.serviceType.join(',')
            : '',
          cost: draftTransaction.cost,
        }
      );

      res.status(201).json({
        status: 201,
        message: "Payment initialized successfully",
        data: null,
        reference: paymentReference,
        paymentData: paymentData,
      });
    } catch (error) {
      next(error);
    }
  }

  static async verify(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      let paymentStatusTarget = 'failed';
      const readQueryValue = (value: unknown) => {
        if (Array.isArray(value)) {
          return String(value[0] ?? '').trim();
        }
        return String(value ?? '').trim();
      };

      const verificationReference = readQueryValue(req.query.reference)
        || readQueryValue(req.query.trxref)
        || readQueryValue(req.query.transaction_id)
        || id;

      const paymentData = await PaymentService.getTransaction(verificationReference);
      const rawPayment = paymentData.data as Record<string, any> | undefined;
      const paymentFields = TransactionController.extractPaymentFields(rawPayment);

      if (paymentData.status === true && paymentData.data?.status === "success") {
        const existingTransaction = paymentFields.transactionNO
          ? await TransactionService.findByTransactionNo(String(paymentFields.transactionNO))
          : null;

        if (existingTransaction) {
          res.redirect(config.baseUrl + '/payment-status/' + existingTransaction.id);
          return;
        }

        const transactionDraft = TransactionController.buildTransactionFromPayment(rawPayment);

        if (!transactionDraft) {
          res.redirect(config.baseUrl + '/payment-status/failed');
          return;
        }

        const transaction = await TransactionService.create(transactionDraft);
        const subject = transaction.serviceType.includes(ServiceType.CHARGES) ? "تم تسديد المستحقات بنجاح" : "تم حجز الاستشارة بنجاح";

        const newStatus = transaction.serviceType.includes(ServiceType.CHARGES)
          ? Status.FINISHED
          : Status.PENDING;

        const normalizedTransactionNo = paymentFields.transactionNO ? String(paymentFields.transactionNO) : null;
        const response = await TransactionService.update(transaction.id, {
          status: newStatus,
          cardType: paymentFields.cardType,
          transactionNO: normalizedTransactionNo,
          cardNo: paymentFields.cardNo,
          transactionDate: paymentFields.transactionDate,
          transactionAmount: paymentFields.transactionAmount,
          adminNotes: transaction.adminNotes,
        });

        const emailHTML = EmailTemplate.generateTransactionConfirmationEmail(response);
        EmailService.sendEmail(transaction.email, subject, emailHTML);
        EmailService.sendEmail('shadi.86.shirri@gmail.com', subject, emailHTML);
        paymentStatusTarget = response.id;
      } else {
        res.redirect(config.baseUrl + '/payment-status/failed');
        return;
      }
      
      // Redirect to base URL after verification
      res.redirect(config.baseUrl + '/payment-status/' + paymentStatusTarget);
      
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const transaction = await TransactionService.update(id, req.body);

      res.json({
        status: 200,
        message: "Transaction updated successfully",
        data: TransactionController.buildPublicTransactionResponse(transaction),
      });
    } catch (error) {
      next(error);
    }
  }

  static async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const transaction = await TransactionService.findById(id);

      res.json({
        status: 200,
        message: "Transaction updated successfully",
        data: transaction,
      });
    } catch (error) {
      next(error);
    }
  }

  static async findAllOpen(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = TransactionController.buildStatusFilters(req, Status.PENDING);

      const pagination = parsePaginationParams(req.query);
      const result = await TransactionService.findAll(filters, pagination);

      res.json({
        status: 200,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async findAllClosed(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = TransactionController.buildStatusFilters(req, [
        Status.CANCELLED,
        Status.FINISHED,
      ]);

      const pagination = parsePaginationParams(req.query);
      const result = await TransactionService.findAll(filters, pagination);

      res.json({
        status: 200,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async findAllInit(req: Request, res: Response, next: NextFunction) {
    try {
      const filters: TransactionFilters = {
        name: req.query.name as string,
        phone: req.query.phone as string,
        status: [Status.CANCELLED] as Status[],
        unpaidOnly: true,
      };

      const pagination = parsePaginationParams(req.query);
      const result = await TransactionService.findAll(filters, pagination);

      res.json({
        status: 200,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async findAllNew(req: Request, res: Response, next: NextFunction) {
    try {
      const filters: TransactionFilters = {
        name: req.query.name as string,
        phone: req.query.phone as string,
        status: [Status.NEW] as Status[],
        unpaidOnly: true,
      };

      const pagination = parsePaginationParams(req.query);
      const result = await TransactionService.findAll(filters, pagination);

      res.json({
        status: 200,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async findAllCharge(req: Request, res: Response, next: NextFunction) {
    try {
      const filters: TransactionFilters = {
        name: req.query.name as string,
        phone: req.query.phone as string,
        serviceType: ServiceType.CHARGES,
        paidOnly: true,
      };

      const pagination = parsePaginationParams(req.query);
      const result = await TransactionService.findAll(filters, pagination);

      res.json({
        status: 200,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await TransactionService.delete(id);

      res.json({
        status: 200,
        message: "Transaction deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  static async findAllByStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const statusParam = String(req.params.status || '').toUpperCase();
      const allowedStatuses: Status[] = [Status.PENDING, Status.CANCELLED, Status.FINISHED];

      if (!allowedStatuses.includes(statusParam as Status)) {
        res.status(400).json({
          status: 400,
          message: 'Invalid transaction status filter',
        });
        return;
      }

      const statusFilters = statusParam === Status.PENDING
        ? [Status.NEW, Status.PENDING]
        : (statusParam as Status);

      const filters = TransactionController.buildStatusFilters(req, statusFilters);
      const pagination = parsePaginationParams(req.query);
      const result = await TransactionService.findAll(filters, pagination);

      res.json({
        status: 200,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
}
