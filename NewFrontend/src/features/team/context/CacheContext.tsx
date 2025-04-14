import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

// Define the structure of our cache
interface CacheData<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface CacheContextType {
  getCache: <T>(key: string) => T | null;
  setCache: <T>(key: string, data: T, ttlSeconds?: number) => void;
  invalidateCache: (key: string) => void;
  invalidateAllCache: () => void;
}

const CacheContext = createContext<CacheContextType | undefined>(undefined);

interface CacheProviderProps {
  children: ReactNode;
}

export const CacheProvider: React.FC<CacheProviderProps> = ({ children }) => {
  // Initialize cache from localStorage if available
  const [cache, setCacheState] = useState<Record<string, CacheData<any>>>(
    () => {
      try {
        const storedCache = localStorage.getItem("app_cache");
        return storedCache ? JSON.parse(storedCache) : {};
      } catch (error) {
        console.error("Failed to load cache from localStorage:", error);
        return {};
      }
    }
  );

  // Save cache to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem("app_cache", JSON.stringify(cache));
    } catch (error) {
      console.error("Failed to save cache to localStorage:", error);
    }
  }, [cache]);

  // Clean expired cache entries periodically
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const newCache = { ...cache };
      let hasChanges = false;

      Object.keys(newCache).forEach((key) => {
        if (newCache[key].expiresAt < now) {
          delete newCache[key];
          hasChanges = true;
        }
      });

      if (hasChanges) {
        setCacheState(newCache);
      }
    }, 60000); // Run cleanup every minute

    return () => clearInterval(cleanupInterval);
  }, [cache]);

  // Get data from cache
  const getCache = <T,>(key: string): T | null => {
    const cacheEntry = cache[key];

    // If no cache entry or expired, return null
    if (!cacheEntry || cacheEntry.expiresAt < Date.now()) {
      return null;
    }

    return cacheEntry.data as T;
  };

  // Set data in cache with optional TTL (default 5 minutes)
  const setCache = <T,>(key: string, data: T, ttlSeconds = 300) => {
    const now = Date.now();
    setCacheState((prevCache) => ({
      ...prevCache,
      [key]: {
        data,
        timestamp: now,
        expiresAt: now + ttlSeconds * 1000,
      },
    }));
  };

  // Invalidate a specific cache entry
  const invalidateCache = (key: string) => {
    setCacheState((prevCache) => {
      const newCache = { ...prevCache };
      delete newCache[key];
      return newCache;
    });
  };

  // Invalidate all cache entries
  const invalidateAllCache = () => {
    setCacheState({});
  };

  return (
    <CacheContext.Provider
      value={{ getCache, setCache, invalidateCache, invalidateAllCache }}
    >
      {children}
    </CacheContext.Provider>
  );
};

// Hook to use the cache
export const useCache = () => {
  const context = useContext(CacheContext);
  if (context === undefined) {
    throw new Error("useCache must be used within a CacheProvider");
  }
  return context;
};
