export const SITE_TITLE = 'QuantDash 量化数据博客';
export const SITE_DESC = 'QuantDash 金融数据 API + Python SDK 的教程与更新：A 股 / 美股 / 港股的 K 线、行情快照、盘口、分时。';
export const LINKS = { site: 'https://quantdash.net/', docs: 'https://docs.quantdash.net/zh-Hans', github: 'https://github.com/quantdash-net/QuantDash' };
export const CATEGORIES = [
  { name: '版本更新', slug: 'releases', color: 'blue', desc: 'QuantDash API 与 Python SDK 的新功能、变更与版本发布说明。' },
  { name: '接口教程', slug: 'tutorials', color: 'teal', desc: '逐个接口讲清参数、返回字段与调用示例：K 线、行情快照、盘口、分时等。' },
  { name: '量化实战', slug: 'practice', color: 'violet', desc: '用 QuantDash 数据做选股、回测、指标计算等完整的实战案例。' },
  { name: '常见问题', slug: 'faq', color: 'amber', desc: '复权、代码格式、频率限制等使用中常见问题的解答。' },
] as const;
export const CATEGORY_NAMES = ['版本更新', '接口教程', '量化实战', '常见问题'] as const;
export const catOf = (name: string) => CATEGORIES.find(c => c.name === name)!;
