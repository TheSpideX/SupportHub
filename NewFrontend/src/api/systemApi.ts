import { apiClient } from "./apiClient";
import { API_ROUTES } from "@/config/routes";

// Types
export interface SystemComponent {
  id: string;
  name: string;
  status: "operational" | "degraded" | "outage" | "maintenance";
  description: string;
  lastUpdated: string;
  metrics?: {
    name: string;
    value: string | number;
    unit?: string;
    status?: "normal" | "warning" | "critical";
    isReal?: boolean;
    isPartiallyReal?: boolean;
    isMock?: boolean;
    source?: string;
  }[];
}

export interface SystemIncident {
  id?: string;
  title?: string;
  status?: "investigating" | "identified" | "monitoring" | "resolved";
  severity?: "critical" | "major" | "minor";
  startTime?: string;
  lastUpdate?: string;
  resolvedTime?: string;
  affectedComponents?: string[];
  updates?: {
    time: string;
    message: string;
  }[];
  _meta?: {
    isMockData?: boolean;
    mockDataNotice?: string;
    realImplementationNote?: string;
    lastUpdated?: string;
  };
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    model: string;
    load: number[];
    isReal?: boolean;
    source?: string;
  };
  memory: {
    total: number;
    free: number;
    usage: number;
    isReal?: boolean;
    source?: string;
  };
  disk: {
    usage: number;
    isReal?: boolean;
    source?: string;
  };
  network: {
    connections: number;
    isPartiallyReal?: boolean;
    source?: string;
  };
  application: {
    uptime: number;
    activeUsers: number;
    requestsPerMinute: number;
    averageResponseTime: number;
    errorRate: number;
    isPartiallyReal?: boolean;
    source?: string;
  };
  _meta?: {
    realDataSources: string[];
    estimatedDataSources: string[];
    mockDataSources: string[];
    lastUpdated: string;
  };
}

export interface SystemStatus {
  status: string;
  timestamp: string;
  uptime: number;
  components: SystemComponent[];
}

export interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
  services: {
    database: string;
    redis: string;
  };
}

export interface VersionInfo {
  version: string;
  nodeVersion: string;
  environment: string;
  timestamp: string;
}

// System API client
const systemApi = {
  /**
   * Get basic health status
   * @returns Promise with health status
   */
  getHealthStatus: async (): Promise<HealthStatus> => {
    const response = await apiClient.get(API_ROUTES.SYSTEM.HEALTH);
    return response.data.data;
  },

  /**
   * Get detailed system status
   * @returns Promise with system status
   */
  getSystemStatus: async (): Promise<SystemStatus> => {
    const response = await apiClient.get(API_ROUTES.SYSTEM.STATUS);
    return response.data.data;
  },

  /**
   * Get system version information
   * @returns Promise with version information
   */
  getVersionInfo: async (): Promise<VersionInfo> => {
    const response = await apiClient.get(API_ROUTES.SYSTEM.VERSION);
    return response.data.data;
  },

  /**
   * Get system incidents
   * @returns Promise with system incidents
   */
  getSystemIncidents: async (): Promise<SystemIncident[]> => {
    const response = await apiClient.get(API_ROUTES.SYSTEM.INCIDENTS);
    return response.data.data;
  },

  /**
   * Get system metrics
   * @returns Promise with system metrics
   */
  getSystemMetrics: async (): Promise<SystemMetrics> => {
    const response = await apiClient.get(API_ROUTES.SYSTEM.METRICS);
    return response.data.data;
  },
};

export default systemApi;
