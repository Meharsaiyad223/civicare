import { pairwiseTextSimilarities } from './ai/embeddings.js';

export function distanceMeters(first, second) {
  const coordinates = (value) => value?.location?.coordinates
    || value?.location?.center?.coordinates
    || value?.center?.coordinates
    || value?.coordinates
    || [];
  const firstCoordinates = coordinates(first);
  const secondCoordinates = coordinates(second);
  if (firstCoordinates.length < 2 || secondCoordinates.length < 2) return Infinity;
  const [longitude1, latitude1] = firstCoordinates;
  const [longitude2, latitude2] = secondCoordinates;
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(latitude2 - latitude1);
  const longitudeDelta = radians(longitude2 - longitude1);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(latitude1)) * Math.cos(radians(latitude2)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function reporterId(report) {
  return String(report?.reporter?._id || report?.reporter || '');
}

/**
 * A duplicate candidate must come from another citizen, be within 50 m and 14
 * days, and meet the text cosine threshold. Distance is Haversine; text uses
 * OpenAI embeddings when enabled, otherwise local TF-IDF cosine.
 */
export async function findDuplicates(report, reports, {
  now = new Date(),
  distanceLimitMeters = 50,
  windowDays = 14,
  similarityThreshold = 0.2,
} = {}) {
  const targetTime = new Date(report.createdAt || now).getTime();
  const cutoff = windowDays * 24 * 60 * 60 * 1000;
  const eligible = (reports || []).filter((candidate) => {
    if (!candidate || String(candidate._id || '') === String(report._id || '')) return false;
    if (reporterId(candidate) && reporterId(report) && reporterId(candidate) === reporterId(report)) return false;
    const age = Math.abs(targetTime - new Date(candidate.createdAt || now).getTime());
    return age <= cutoff && distanceMeters(report, candidate) <= distanceLimitMeters;
  });
  if (!eligible.length) return [];

  const similarities = await pairwiseTextSimilarities([report.description || '', ...eligible.map((item) => item.description || '')]);
  return eligible.map((candidate, index) => ({
    report: candidate,
    distanceMeters: Math.round(distanceMeters(report, candidate) * 10) / 10,
    similarity: Number(similarities[index] || 0),
  })).filter((candidate) => candidate.similarity >= similarityThreshold)
    .sort((a, b) => b.similarity - a.similarity);
}

export default findDuplicates;
