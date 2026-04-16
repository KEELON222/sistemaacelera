import { Client } from './crm';

export type InvoiceStatus = 'pendente' | 'pago' | 'atrasado' | 'cancelado';

export interface Invoice {
    id: string;
    client_id: string;
    deal_id: string | null;
    amount: number;
    due_date: string;
    status: InvoiceStatus;
    created_at: string;
    updated_at: string;

    // Relações
    client?: Client;
}
