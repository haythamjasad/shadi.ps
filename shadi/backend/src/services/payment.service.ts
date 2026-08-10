import axios from 'axios';
import { config } from '../config/env';

interface PaymentPayload {
    amount: string;
    email: string;
    currency: string;
    reference: string;
    callback_url: string;
    metadata?: {
        name?: string;
        phone?: string;
        email?: string;
        note?: string;
        customer_name?: string;
        customer_email?: string;
        customer_phone?: string;
        notes?: string;
        location?: string;
        service_type?: string;
        cost?: number;
        [key: string]: unknown;
    };
}

interface PaymentResponse {
    status: boolean;
    data?: PaymentData;
    message?: string;
    statusCode?: number;
    providerError?: unknown;
}

interface PaymentData {
    authorization_url?: string;
    access_code?: string;
    reference?: string;
    status?: string;
    paidAt?: string;
    id?: string;
    amount?: number;
    authorization?: {
        brand: string;
        last4: string;
    };
    metadata?: Record<string, unknown>;
}

export class PaymentService {
    private static toMinorUnits(amount: string | number): string {
        const numeric = Number(amount);
        if (!Number.isFinite(numeric) || numeric <= 0) {
            return '0';
        }
        return String(Math.round(numeric * 100));
    }

    private static buildSafePaymentLog(reference: string, data?: PaymentResponse) {
        return {
            provider: 'Lahza',
            reference,
            status: data?.status,
            providerStatus: data?.data?.status,
            providerTransactionId: data?.data?.id,
        };
    }

    static async createPaymentTransaction(amount: string, email: string, currency: string, reference: string,
        callback_url: string, metadata?: PaymentPayload['metadata']): Promise<PaymentResponse> {
        const apiUrl = config.lahzaApiUrl + '/initialize';

        if (!config.lahzaSecretKey) {
            return {
                status: false,
                message: 'Payment provider is not configured',
            };
        }

        try {
            const amountMinor = PaymentService.toMinorUnits(amount);
            const payload: PaymentPayload = {
                amount: amountMinor,
                email,
                currency,
                reference,
                callback_url,
                ...(metadata ? { metadata } : {}),
            };

            const response = await axios.post(apiUrl, payload, {
                headers: {
                    Authorization: `Bearer ${config.lahzaSecretKey}`,
                    'Content-Type': 'application/json',
                },
            });

            console.info('Lahza initialize amount:', {
                provider: 'Lahza',
                reference,
                amountMajor: Number(amount),
                amountMinor,
                currency,
            });

            const data: PaymentResponse = response.data;
            console.info('Lahza initialize result:', PaymentService.buildSafePaymentLog(reference, data));
            return data;
        } catch (error: any) {
            const providerError = error.response?.data;
            console.error('Lahza initialize error:', {
                provider: 'Lahza',
                reference,
                statusCode: error.response?.status,
                providerStatus: providerError?.status,
                message: providerError?.message || error.message || 'Payment processing failed',
            });
            return {
                status: false,
                message: providerError?.message || error.message || 'Payment processing failed',
                statusCode: error.response?.status,
                providerError,
            };
        }
    }

    static async getTransaction(reference: string): Promise<PaymentResponse> {
        const apiUrl = config.lahzaApiUrl + '/verify/' + reference;

        if (!config.lahzaSecretKey) {
            return {
                status: false,
                message: 'Payment provider is not configured',
            };
        }

        try {
            const response = await axios.get(apiUrl, {
                headers: {
                    Authorization: `Bearer ${config.lahzaSecretKey}`,
                    'Content-Type': 'application/json',
                },
            });

            const data: PaymentResponse = response.data;
            return data;
        } catch (error: any) {
            return {
                status: false,
                message: error.message || 'Payment get failed',
            };
        }
    }
}
