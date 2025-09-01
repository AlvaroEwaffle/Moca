/**
 * Configuration utilities for Moca Frontend
 */

// Get backend URL with fallback
export const getBackendUrl = (): string => {
  // Check if we're in production (Cloudflare Pages)
  const isProduction = window.location.hostname.includes('pages.dev') || 
                      window.location.hostname.includes('moca.pages.dev');
  
  // Production backend URL - you'll need to set this to your actual backend URL
  const productionBackendUrl = 'https://your-backend-domain.com';
  
  // Development backend URL
  const developmentBackendUrl = 'http://localhost:3002';
  
  // Use environment variable if set, otherwise use appropriate default
  const envBackendUrl = import.meta.env.VITE_BACKEND_URL;
  
  if (envBackendUrl) {
    return envBackendUrl;
  }
  
  // Fallback based on environment
  return isProduction ? productionBackendUrl : developmentBackendUrl;
};

// Export the backend URL
export const BACKEND_URL = getBackendUrl();
