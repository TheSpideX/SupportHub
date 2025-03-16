import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { setupCache } from 'axios-cache-interceptor';
import { compress, decompress } from 'lz-string';
import { API_CONFIG } from '@/config/api';
import { RetryHandler } from '@/core/errors/retryHandler';
import { errorHandler } from '@/core/errors/errorHandler';
import { serverStatusService } from '@/components/ui/ServerStatusIndicator';

export class ApiClient {
  private static instance: ApiClient;
  private axiosInstance: AxiosInstance;
  
  private constructor() {
    this.axiosInstance = setupCache(axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      headers: API_CONFIG.HEADERS,
    }), {
      ttl: 5 * 60 * 1000, // 5 minutes cache
      methods: ['GET'], // Only cache GET requests
      debug: process.env.NODE_ENV === 'development',
      // Implement cache key generation based on request
      generateKey: (request) => {
        const { method, url, params, data } = request;
        return `${method}-${url}-${JSON.stringify(params)}-${JSON.stringify(data)}`;
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for compression
    this.axiosInstance.interceptors.request.use(
      (config) => {
        if (config.data && typeof config.data === 'string') {
          config.data = compress(config.data);
          config.headers['Content-Encoding'] = 'lz-string';
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for decompression
    this.axiosInstance.interceptors.response.use(
      (response) => {
        if (response.headers['content-encoding'] === 'lz-string') {
          response.data = decompress(response.data);
        }
        return response;
      },
      async (error) => {
        return RetryHandler.retry(
          () => this.axiosInstance(error.config),
          {
            maxAttempts: API_CONFIG.RETRY.MAX_RETRIES,
            retryableErrors: ['NETWORK_ERROR', 'TIMEOUT_ERROR']
          }
        );
      }
    );
  }

  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  public getAxiosInstance(): AxiosInstance {
    return this.axiosInstance;
  }
}

export const apiClient = ApiClient.getInstance().getAxiosInstance();