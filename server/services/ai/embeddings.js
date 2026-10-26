import { getAIProvider } from './providerInterface.js';

const stopWords = new Set(['a', 'an', 'and', 'are', 'at', 'by', 'for', 'from', 'in', 'is', 'it', 'near', 'of', 'on', 'the', 'to', 'with']);

export function tokenize(text = '') {
  return String(text).toLowerCase().match(/[a-z0-9]+/g)?.filter((token) => token.length > 1 && !stopWords.has(token)) || [];
}

function magnitude(vector) {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

export function cosineSimilarity(left, right) {
  if (!left?.length || !right?.length || left.length !== right.length) return 0;
  const denominator = magnitude(left) * magnitude(right);
  if (!denominator) return 0;
  return left.reduce((sum, value, index) => sum + value * right[index], 0) / denominator;
}

/** Local TF-IDF cosine fallback; IDF is calculated across the texts being compared. */
export function tfidfSimilarities(texts) {
  const tokenLists = texts.map(tokenize);
  const vocabulary = [...new Set(tokenLists.flat())].sort();
  const documentFrequency = new Map(vocabulary.map((term) => [term, tokenLists.filter((tokens) => tokens.includes(term)).length]));
  const vectors = tokenLists.map((tokens) => {
    const counts = new Map();
    for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1);
    const length = Math.max(tokens.length, 1);
    return vocabulary.map((term) => {
      const frequency = (counts.get(term) || 0) / length;
      const idf = Math.log(1 + (texts.length / (1 + (documentFrequency.get(term) || 0))));
      return frequency * idf;
    });
  });
  return vectors;
}

export async function pairwiseTextSimilarities(texts) {
  const provider = getAIProvider();
  if (provider.name === 'openai' && provider.embedTexts) {
    try {
      const vectors = await provider.embedTexts(texts);
      if (vectors?.length === texts.length) {
        return vectors.slice(1).map((vector) => cosineSimilarity(vectors[0], vector));
      }
    } catch {
      // Keep duplicate detection available when the embedding service is temporarily unavailable.
    }
  }
  const vectors = tfidfSimilarities(texts);
  return vectors.slice(1).map((vector) => cosineSimilarity(vectors[0], vector));
}
