import { getCollection } from 'astro:content';
export const sortedPosts = async () => (await getCollection('posts')).sort((a, b) => +b.data.date - +a.data.date);
export const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
export function readingTime(body = '') {
  const text = body.replace(/```[\s\S]*?```/g, ' ');
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const words = (text.replace(/[\u4e00-\u9fff]/g, ' ').match(/[A-Za-z0-9_]+/g) || []).length;
  return Math.max(1, Math.round(cjk / 400 + words / 200));
}
