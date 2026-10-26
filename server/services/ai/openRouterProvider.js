import { env } from '../../config/env.js';
import { mockProvider } from './mockProvider.js';

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function generateText(prompt) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.openRouterApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': env.clientOrigin,
      'X-Title': 'CityPulse Weekly Reports',
    },
    body: JSON.stringify({
      model: env.openRouterModel,
      messages: [
        { role: 'system', content: 'Write concise, factual weekly briefings for a city issue reporting demo. Do not invent details.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    const error = new Error(payload.error?.message || `OpenRouter request failed with status ${response.status}.`);
    error.status = 502;
    error.code = 'AI_PROVIDER_ERROR';
    throw error;
  }

  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) {
    const error = new Error('OpenRouter returned an empty summary. Try again or use the demo summary.');
    error.status = 502;
    error.code = 'AI_PROVIDER_EMPTY_RESPONSE';
    throw error;
  }
  return text;
}

export const openRouterProvider = {
  name: 'openrouter',
  // Keep image classification local; only aggregate weekly statistics go to OpenRouter.
  classifyImage: mockProvider.classifyImage,
  embedTexts: mockProvider.embedTexts,

  async writeWeeklyNarrative(statistics) {
    const aggregate = {
      periodStart: statistics.periodStart,
      periodEnd: statistics.periodEnd,
      totalReports: statistics.totalReports,
      previousWeekReports: statistics.previousWeekReports,
      weekOverWeekChange: statistics.weekOverWeekChange,
      categoryCounts: statistics.categoryCounts,
      hotspots: (statistics.topHotspots || []).map(({ reportCount, averagePriority }) => ({ reportCount, averagePriority })),
      recurrenceCount: statistics.recurrenceCount,
      recurrenceRate: statistics.recurrenceRate,
      repairsCompleted: statistics.repairsCompleted,
      repairRecurrences: statistics.repairRecurrences,
    };
    const prompt = [
      'Write a plain-English weekly city briefing in 3 to 5 sentences.',
      'Use only these aggregate statistics. Do not include personal data, names, addresses, or invented facts.',
      'Mention report volume and trend, leading categories, hotspot counts, recurrence, and a practical next action when supported.',
      JSON.stringify(aggregate),
    ].join('\n\n');
    return generateText(prompt);
  },
};
