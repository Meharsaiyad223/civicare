import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(serverDirectory, '..', '.env') });

const numberFromEnv = (name, fallback) => {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${name} must be a valid number.`);
  }
  return parsed;
};

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: numberFromEnv('PORT', 5000),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/civiccare',
  jwtSecret: process.env.JWT_SECRET || 'change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  openAiApiKey: process.env.OPENAI_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openRouterModel: process.env.OPENROUTER_MODEL || 'openrouter/free',
  aiProvider: (process.env.AI_PROVIDER || 'mock').toLowerCase(),
  mockAi: process.env.MOCK_AI === undefined
    ? (process.env.AI_PROVIDER || 'mock').toLowerCase() === 'mock'
    : process.env.MOCK_AI.toLowerCase() === 'true',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  uploadDirectory: process.env.UPLOAD_DIRECTORY || 'uploads',
});

if (env.nodeEnv === 'production' && env.jwtSecret === 'change_me') {
  throw new Error('Set JWT_SECRET to a secure value before starting in production.');
}
