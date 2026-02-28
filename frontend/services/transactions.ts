import api from './api';

export interface Transaction {
  id: string;
  user_id: string;
  plaid_transaction_id: string | null;
  merchant: string;
  amount: number;
  date: string;
  ai_category: 'essential' | 'discretionary' | null;
  savings_pct: number | null;
  savings_amount: number | null;
  processed: boolean;
  created_at: string;
}

export interface TransactionListResponse {
  transactions: Transaction[];
  total_savings: number;
  count: number;
}

export interface SavingsSummary {
  total_saved: number;
  savings_pool: number;
  total_invested: number;
  savings_history: { date: string; amount: number; transactions: number }[];
}

export async function getTransactions(
  limit: number = 50,
  skip: number = 0
): Promise<TransactionListResponse> {
  const response = await api.get('/transactions/', { params: { limit, skip } });
  return response.data;
}

export async function processTransactions(): Promise<{
  processed: number;
  results: any[];
}> {
  const response = await api.post('/transactions/process');
  return response.data;
}

export async function getSavingsSummary(): Promise<SavingsSummary> {
  const response = await api.get('/transactions/savings');
  return response.data;
}

export async function classifyTransactions(): Promise<{
  classifications: any[];
  count: number;
}> {
  const response = await api.post('/ai/classify');
  return response.data;
}
