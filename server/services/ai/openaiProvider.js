import { env } from '../../config/env.js';

const API_URL = 'https://api.openai.com/v1';

async function request(path, body) {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.openAiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error?.message || `OpenAI request failed with status ${response.status}.`;
    const error = new Error(message);
    error.status = 502;
    error.code = 'AI_PROVIDER_ERROR';
    throw error;
  }
  return payload;
}

export const openAiProvider = {
  name: 'openai',

  async classifyImage({ buffer, mimeType, description = '' }) {
    const dataUrl = `data:${mimeType};base64,${Buffer.from(buffer).toString('base64')}`;
    const payload = await request('/chat/completions', {
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'civic_issue_classification',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              category: { type: 'string', enum: ['pothole', 'garbage', 'water_leak', 'streetlight_damage', 'other'] },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
            },
            required: ['category', 'confidence'],
          },
        },
      },
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `Classify the visible civic issue. Use the description as context only: ${description || 'No description supplied.'}` },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
        ],
      }],
    });
    const result = JSON.parse(payload.choices?.[0]?.message?.content || '{}');
    return { category: result.category || 'other', confidence: Math.max(0, Math.min(1, Number(result.confidence) || 0)), provider: this.name };
  },

  async embedTexts(texts) {
    if (!Array.isArray(texts) || texts.length === 0) return [];
    const payload = await request('/embeddings', { model: 'text-embedding-3-small', input: texts });
    return payload.data.map((entry) => entry.embedding);
  },

  async writeWeeklyNarrative(statistics) {
    const payload = await request('/chat/completions', {
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        { role: 'system', content: 'Write a concise plain-English weekly briefing for municipal officers using only the supplied JSON statistics. Mention hotspots, category trends, recurrence, and practical actions. Do not invent facts.' },
        { role: 'user', content: JSON.stringify(statistics) },
      ],
    });
    return payload.choices?.[0]?.message?.content?.trim() || '';
  },
};
