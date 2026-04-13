import axios from 'axios';
import { config } from '../config/env';

interface PaymentPayload {
    amount: string;
    email: string;
    currency: string;
    reference: string;
    callback_url: string;
    metadata?: {
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
            const payload: PaymentPayload = {
                amount,
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

            console.info('Lahza initialize payload:', payload);
            console.info('Lahza initialize response:', response.data);

            const data: PaymentResponse = response.data;
            return data;
        } catch (error: any) {
            console.error('Lahza initialize error:', error.response?.data || error.message);
            return {
                status: false,
                message: error.message || 'Payment processing failed',
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
