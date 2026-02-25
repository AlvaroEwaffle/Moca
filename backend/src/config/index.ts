import dotenv from 'dotenv';

if (!process.env.MOCA_CONFIG_INITIALIZED) {
  dotenv.config();
  process.env.MOCA_CONFIG_INITIALIZED = 'true';
}

// Startup assertions — server will not start without these
const REQUIRED_VARS = [
  'JWT_SECRET',
  'MONGODB_URI',
  'OPENAI_API_KEY',
  'INSTAGRAM_APP_SECRET',
  'INSTAGRAM_VERIFY_TOKEN',
  'INSTAGRAM_CLIENT_ID',
  'INSTAGRAM_CLIENT_SECRET',
  'INSTAGRAM_REDIRECT_URI',
];

for (const varName of REQUIRED_VARS) {
  if (!process.env[varName]) {
    throw new Error(`❌ Missing required environment variable: ${varName}. Add it to .env and restart.`);
  }
}

const parseNumber = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const appConfig = {
  env: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI!,
  jwtSecret: process.env.JWT_SECRET!,
  encryptionKey: (process.env.ENCRYPTION_KEY || 'default_encryption_key_32_chars')
    .padEnd(32, '0')
    .slice(0, 32),
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || ''
  },
  analytics: {
    leadScoreThreshold: parseNumber(process.env.LEAD_SCORE_THRESHOLD, 4),
    defaultDateWindowDays: parseNumber(process.env.ANALYTICS_WINDOW_DAYS, 7)
  },
  pagination: {
    defaultLimit: parseNumber(process.env.DEFAULT_PAGE_SIZE, 50),
    maxLimit: parseNumber(process.env.MAX_PAGE_SIZE, 200)
  }
};

export default appConfig;

