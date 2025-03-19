import axios from 'axios';
import { API_CONFIG } from '@/config/api';

// Create a reusable API client
const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  withCredentials: true, // Important for HTTP-only cookies
  headers: API_CONFIG.HEADERS
});

export { apiClient };