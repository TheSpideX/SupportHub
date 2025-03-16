import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';

interface RateLimitState {
  isLimited: boolean;
  remainingTime: number;
  progress: number;
}

export const useRateLimit = () => {
  const [state, setState] = useState<RateLimitState>({
    isLimited: false,
    remainingTime: 0,
    progress: 100
  });

  const rateLimitInfo = useSelector((state: RootState) => state.auth.rateLimit);

  useEffect(() => {
    if (!rateLimitInfo?.expiresAt) {
      setState({ isLimited: false, remainingTime: 0, progress: 100 });
      return;
    }

    const updateRateLimit = () => {
      const now = Date.now();
      const remaining = Math.max(0, rateLimitInfo.expiresAt - now);
      const progress = 100 - (remaining / rateLimitInfo.duration * 100);

      setState({
        isLimited: remaining > 0,
        remainingTime: remaining,
        progress
      });
    };

    updateRateLimit();
    const interval = setInterval(updateRateLimit, 1000);

    return () => clearInterval(interval);
  }, [rateLimitInfo]);

  return state;
};