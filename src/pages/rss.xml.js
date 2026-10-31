import rss from '@astrojs/rss'; import { getCollection } from 'astro:content'; import { SITE_TITLE, SITE_DESC } from '../consts';
export async function GET(context) {
  const posts = (await getCollection('posts')).sort((a, b) => b.data.date - a.data.date);
  return rss({ title: SITE_TITLE, description: SITE_DESC, site: context.site,
    items: posts.map(p => ({ title: p.data.title, description: p.data.description, pubDate: p.data.date, link: `/posts/${p.id}/`, categories: p.data.tags })) });
}
