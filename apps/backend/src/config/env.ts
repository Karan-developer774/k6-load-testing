import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface AppConfig {
  port: number;
  host: string;
  databaseUrl: string;
  k6BinPath: string;
  allowLocalTargets: boolean;
  maxVusCap: number;
  maxDurationSeconds: number;
  maxConcurrentTests: number;
  jwtSecret: string;
  encryptionKey: string;
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  k6BinPath: process.env.K6_BIN_PATH || 'k6',
  allowLocalTargets: process.env.ALLOW_LOCAL_TARGETS === 'true',
  maxVusCap: parseInt(process.env.MAX_VUS_CAP || '5000', 10),
  maxDurationSeconds: parseInt(process.env.MAX_DURATION_SECONDS || '3600', 10),
  maxConcurrentTests: parseInt(process.env.MAX_CONCURRENT_TESTS || '2', 10),
  jwtSecret: process.env.JWT_SECRET || 'k6-load-testing-platform-default-secret',
  encryptionKey:
    process.env.ENCRYPTION_KEY ||
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
};
