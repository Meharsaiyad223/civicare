import { env } from '../../config/env.js';
import { mockProvider } from './mockProvider.js';
import { openAiProvider } from './openaiProvider.js';
import { geminiProvider } from './geminiProvider.js';
import { openRouterProvider } from './openRouterProvider.js';

/**
 * AI provider boundary. Implementations classify an uploaded image, embed a
 * batch of texts when supported, and write a plain-English weekly narrative.
 */
export function getAIProvider() {
  if (!env.mockAi && env.aiProvider === 'openai' && env.openAiApiKey) return openAiProvider;
  if (!env.mockAi && env.aiProvider === 'gemini' && env.geminiApiKey) return geminiProvider;
  if (!env.mockAi && env.aiProvider === 'openrouter' && env.openRouterApiKey) return openRouterProvider;
  return mockProvider;
}

export function getAIProviderName() {
  return getAIProvider().name;
}
