/**
 * Configuration utilities for Moca Frontend
 */

// Get backend URL with fallback
export const getBackendUrl = (): string => {
  // Check if we're in production (Cloudflare Pages)
  const isProduction = window.location.hostname.includes('pages.dev') || 
                      window.location.hostname.includes('moca.pages.dev');
  
  // Production backend URL - Railway deployment
  const productionBackendUrl = 'https://moca-production.up.railway.app';
  
  // Development backend URL
  const developmentBackendUrl = 'http://localhost:3002';
  
  // Use environment variable if set, otherwise use appropriate default
  const envBackendUrl = import.meta.env.VITE_BACKEND_URL;
  
  // Debug logging
  console.log('🔧 [Backend URL Debug]', {
    hostname: window.location.hostname,
    isProduction,
    envBackendUrl,
    productionBackendUrl,
    developmentBackendUrl
  });
  
  if (envBackendUrl) {
    console.log('✅ [Backend URL] Using environment variable:', envBackendUrl);
    return envBackendUrl;
  }
  
  // Fallback based on environment
  const finalUrl = isProduction ? productionBackendUrl : developmentBackendUrl;
  console.log('✅ [Backend URL] Using fallback:', finalUrl);
  return finalUrl;
};

// Export the backend URL
export const BACKEND_URL = getBackendUrl();
