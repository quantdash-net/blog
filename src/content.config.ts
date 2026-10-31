import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { CATEGORY_NAMES } from './consts';
const posts = defineCollection({ loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({ title: z.string(), description: z.string(), date: z.coerce.date(), category: z.enum(CATEGORY_NAMES), tags: z.array(z.string()).default([]) }) });
export const collections = { posts };
