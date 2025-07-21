// Environment configuration for authentication
export const CONFIG = {
  // JWT Configuration
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  
  // Environment detection
  IS_SCF: process.env.SERVERLESS === 'true' || process.env.SCF_RUNTIME_API !== undefined,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Session fallback for Replit
  SESSION_SECRET: process.env.SESSION_SECRET || 'resource-sharing-secret',
  
  // Database
  DATABASE_URL: process.env.DATABASE_URL,
  
  // COS Configuration
  COS_SECRET_ID: process.env.COS_SECRET_ID,
  COS_SECRET_KEY: process.env.COS_SECRET_KEY,
  COS_BUCKET: process.env.COS_BUCKET,
  COS_REGION: process.env.COS_REGION || 'ap-beijing',
  COS_DOMAIN: process.env.COS_DOMAIN,
};

// Authentication mode selection
export const AUTH_MODE = CONFIG.IS_SCF ? 'jwt' : 'hybrid';

console.log(`🔧 认证模式: ${AUTH_MODE} (${CONFIG.IS_SCF ? 'SCF环境' : 'Replit环境'})`);