import { env } from '../../config/env.js';
import { mockProvider } from './mockProvider.js';

const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

async function generateText(prompt) {
  const response = await fetch(`${API_URL}/${encodeURIComponent(env.geminiModel)}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': env.geminiApiKey,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error?.message || `Gemini request failed with status ${response.status}.`);
    error.status = 502;
    error.code = 'AI_PROVIDER_ERROR';
    throw error;
  }

  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join(' ')
    .trim();
  if (!text) {
    const error = new Error('Gemini returned an empty weekly summary. Try again or use the demo summary.');
    error.status = 502;
    error.code = 'AI_PROVIDER_EMPTY_RESPONSE';
    throw error;
  }
  return text;
}

export const geminiProvider = {
  name: 'gemini',

  // Keep photo classification local to the demo provider; Gemini receives only
  // aggregate weekly counts for the narrative below.
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
      'Write a concise, plain-English weekly briefing for municipal officers in 3 to 5 sentences.',
      'Use only the supplied aggregate statistics. Do not invent details or include names, addresses, or personal data.',
      'Mention report volume and trend, leading issue categories, hotspot counts, recurrence, and one practical next action when supported by the data.',
      JSON.stringify(aggregate),
    ].join('\n\n');
    return generateText(prompt);
  },
};
