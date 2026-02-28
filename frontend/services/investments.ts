import api from './api';

export interface Investment {
  id: string;
  user_id: string;
  alpaca_order_id: string | null;
  asset: string;
  amount_invested: number;
  shares: number | null;
  status: string;
  created_at: string;
}

export interface PortfolioHolding {
  symbol: string;
  qty: number;
  market_value: number;
  avg_entry_price: number;
  current_price: number;
  unrealized_pl: number;
  unrealized_plpc: number;
}

export interface PortfolioResponse {
  holdings: PortfolioHolding[];
  total_value: number;
  total_gain_loss: number;
  savings_pool: number;
}

export interface InvestmentHistoryResponse {
  investments: Investment[];
  total_invested: number;
  count: number;
}

export async function executeInvestment(
  amount?: number,
  asset?: string
): Promise<Investment> {
  const body: any = {};
  if (amount) body.amount = amount;
  if (asset) body.asset = asset;
  const response = await api.post('/investments/execute', body);
  return response.data;
}

export async function getPortfolio(): Promise<PortfolioResponse> {
  const response = await api.get('/investments/portfolio');
  return response.data;
}

export async function getInvestmentHistory(
  limit: number = 50,
  skip: number = 0
): Promise<InvestmentHistoryResponse> {
  const response = await api.get('/investments/history', {
    params: { limit, skip },
  });
  return response.data;
}
