import axios from 'axios';
import { getItem, deleteItem } from '@/services/storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// API base URL: from .env (EXPO_PUBLIC_API_URL) via app.config.js → extra.apiUrl,
// or fallback: Android emulator → 10.0.2.2:8000, else → localhost:8000
// On Expo Go on a physical device, localhost is the phone — set EXPO_PUBLIC_API_URL to your computer's IP (e.g. http://192.168.1.5:8000)
const getBaseUrl = () => {
  const envUrl = Constants.expoConfig?.extra?.apiUrl;
  if (envUrl) return envUrl;

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }
  return 'http://localhost:8000';
};

const API_BASE_URL = getBaseUrl();

if (__DEV__ && typeof console !== 'undefined') {
  console.log('[API] baseURL:', API_BASE_URL);
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach JWT token
api.interceptors.request.use(
  async (config) => {
    const token = await getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await deleteItem('access_token');
    }
    return Promise.reject(error);
  }
);

export default api;

/** User-friendly message for auth/screen errors (network vs server message). */
export function getApiErrorMessage(error: any, fallback: string): string {
  if (!error) return fallback;
  const noResponse = !error.response;
  if (noResponse && (error.code === 'ERR_NETWORK' || error.message?.includes('Network'))) {
    return "Can't reach the server. Is the backend running? On a physical device, set EXPO_PUBLIC_API_URL in .env to your computer's IP (e.g. http://192.168.1.5:8000) and restart Expo.";
  }
  const detail = error.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  return fallback;
}
