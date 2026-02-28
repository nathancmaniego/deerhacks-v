import api from './api';

export async function getLinkToken(): Promise<string> {
  const response = await api.post('/plaid/link-token');
  return response.data.link_token;
}

export async function exchangePublicToken(publicToken: string): Promise<void> {
  await api.post('/plaid/exchange', { public_token: publicToken });
}

export async function fetchTransactions(): Promise<{
  new_transactions: number;
  message: string;
}> {
  const response = await api.get('/plaid/transactions');
  return response.data;
}
