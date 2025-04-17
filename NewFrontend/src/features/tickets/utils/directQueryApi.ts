/**
 * Direct API utilities for query operations
 * Used as a fallback when RTK Query has issues with body parsing
 */

import { CreateQueryRequest } from '../api/queryApi';
import { getAuthToken } from '@/features/auth/utils/auth.utils';

/**
 * Create a query using direct fetch instead of RTK Query
 * This is a workaround for issues with body parsing in RTK Query
 */
export const createQueryDirectFetch = async (data: CreateQueryRequest) => {
  try {
    console.log('Creating query with direct fetch:', data);
    
    // Get the auth token
    const token = getAuthToken();
    
    // Make the request
    const response = await fetch('/api/queries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    
    // Check if the request was successful
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error creating query:', errorData);
      throw errorData;
    }
    
    // Parse and return the response
    const result = await response.json();
    console.log('Query created successfully:', result);
    return result;
  } catch (error) {
    console.error('Error in createQueryDirectFetch:', error);
    throw error;
  }
};
