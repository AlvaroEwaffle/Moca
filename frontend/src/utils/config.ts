/**
 * Configuration utilities for Moca Frontend
 */

// Simplified backend URL resolution
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3006';

// Instagram OAuth redirect URI — must match exactly what is registered in the Meta App Dashboard
export const INSTAGRAM_REDIRECT_URI = import.meta.env.VITE_INSTAGRAM_REDIRECT_URI || 'https://moca.pages.dev/instagram-callback';
