import api from './api';

export interface User {
  id: string;
  email: string;
  name: string;
  risk_profile: 'chill' | 'moderate' | 'aggressive';
  savings_pool: number;
  has_plaid_connected: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export async function registerUser(
  email: string,
  password: string,
  name: string
): Promise<TokenResponse> {
  const response = await api.post('/auth/register', { email, password, name });
  return response.data;
}

export async function loginUser(
  email: string,
  password: string
): Promise<TokenResponse> {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
}

export async function getMe(): Promise<User> {
  const response = await api.get('/auth/me');
  return response.data;
}

export async function updateRiskProfile(
  risk_profile: 'chill' | 'moderate' | 'aggressive'
): Promise<User> {
  const response = await api.put('/auth/risk-profile', { risk_profile });
  return response.data;
}
