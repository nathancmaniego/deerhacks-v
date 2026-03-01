import api from './api';

export interface Investment {
  id: string;
  user_id: string;
  asset: string;
  amount_invested: number;
  shares: number | null;
  price_at_purchase: number | null;
  status: string;
  created_at: string;
  asset_type?: string;
}

export interface PortfolioHolding {
  symbol: string;
  qty: number;
  market_value: number;
  avg_entry_price: number;
  current_price: number;
  unrealized_pl: number;
  unrealized_plpc: number;
  asset_type?: string;
}

export interface PortfolioResponse {
  holdings: PortfolioHolding[];
  total_value: number;
  total_gain_loss: number;
  total_cost?: number;
  total_gain_loss_pct?: number;
  savings_pool: number;
}

export interface InvestmentHistoryResponse {
  investments: Investment[];
  total_invested: number;
  count: number;
}

export interface SupportedAssets {
  crypto: string[];
  stocks: string[];
}

export async function executeInvestment(
  amount?: number,
  asset?: string,
  assetType?: 'crypto' | 'stock'
): Promise<Investment> {
  const body: Record<string, unknown> = {};
  if (amount != null) body.amount = amount;
  if (asset) body.asset = asset;
  if (assetType) body.asset_type = assetType;
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

export async function getSupportedAssets(): Promise<SupportedAssets> {
  const response = await api.get('/investments/supported');
  return response.data;
}

export interface StockSearchResult {
  symbol: string;
  name: string;
  price: number;
}

export async function searchStocks(query: string, limit: number = 15): Promise<StockSearchResult[]> {
  if (!query?.trim()) return [];
  const response = await api.get('/investments/stocks/search', { params: { q: query.trim(), limit } });
  return response.data.results ?? [];
}

export async function sellHolding(asset: string, assetType: 'crypto' | 'stock'): Promise<{
  asset: string;
  asset_type: string;
  shares_sold: number;
  price: number;
  proceeds: number;
  savings_pool: number;
}> {
  const response = await api.post('/investments/sell', { asset, asset_type: assetType });
  return response.data;
}
