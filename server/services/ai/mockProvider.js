import crypto from 'node:crypto';

const categories = ['pothole', 'garbage', 'water_leak', 'streetlight_damage', 'other'];

export const mockProvider = {
  name: 'mock',

  async classifyImage({ buffer }) {
    const digest = crypto.createHash('sha256').update(buffer || Buffer.from('civiccare-demo-image')).digest();
    const category = categories[digest[0] % categories.length];
    const confidence = Number((0.78 + (digest[1] / 255) * 0.2).toFixed(2));
    return { category, confidence, provider: this.name };
  },

  async embedTexts() {
    return null;
  },

  async writeWeeklyNarrative(statistics) {
    const categoryLine = Object.entries(statistics.categoryCounts || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category, count]) => `${count} ${category.replaceAll('_', ' ')}`)
      .join(', ');
    const hotspotLine = (statistics.topHotspots || [])
      .slice(0, 2)
      .map((spot) => `${spot.reportCount} reports near ${spot.label || spot.cellId}`)
      .join('; ');
    const recurrenceRate = Number(statistics.recurrenceRate || 0).toFixed(1);
    const trend = Number(statistics.weekOverWeekChange || 0);
    const trendText = trend > 0 ? `Reports rose ${trend}% from last week.`
      : trend < 0 ? `Reports fell ${Math.abs(trend)}% from last week.`
        : 'Report volume was steady compared with last week.';
    return `This week, the city received ${statistics.totalReports || 0} civic reports. ${trendText} The most common issues were ${categoryLine || 'spread across categories'}. ${hotspotLine ? `Current hotspots include ${hotspotLine}. ` : ''}The recurrence rate was ${recurrenceRate}%. Prioritize high-scoring repeat locations and verify recent repairs in the field.`;
  },
};
