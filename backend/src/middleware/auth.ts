import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
      };
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log('🔧 [Auth Middleware] Received auth header:', authHeader ? `${authHeader.substring(0, 20)}...` : 'none');
  console.log('🔧 [Auth Middleware] Extracted token:', token ? `${token.substring(0, 20)}...` : 'none');

  if (!token) {
    console.log('❌ [Auth Middleware] No access token provided');
    return res.status(401).json({ 
      success: false,
      error: 'Access token required' 
    });
  }

  // Check if token looks like a valid JWT (has 3 parts separated by dots)
  const tokenParts = token.split('.');
  if (tokenParts.length !== 3) {
    console.log('❌ [Auth Middleware] Invalid token format - not a valid JWT');
    return res.status(403).json({ 
      success: false,
      error: 'Invalid token format' 
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err: any, user: any) => {
    if (err) {
      console.log('❌ [Auth Middleware] Invalid token:', err.message);
      console.log('❌ [Auth Middleware] Token error details:', {
        name: err.name,
        message: err.message,
        expiredAt: err.expiredAt
      });
      return res.status(403).json({ 
        success: false,
        error: 'Invalid or expired token' 
      });
    }
    
    console.log('✅ [Auth Middleware] Token verified for user:', user.email);
    req.user = user; // Add user info to request
    next();
  });
};

export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // No token provided, continue without user info
    return next();
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err: any, user: any) => {
    if (!err && user) {
      req.user = user;
      console.log('✅ [Optional Auth] Token verified for user:', user.email);
    }
    next();
  });
};
