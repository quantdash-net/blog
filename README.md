# QuantDash 博客
Astro 静态站点。`npm ci && npm run dev` 本地预览；`npm run build` 输出到 `dist/`。
Cloudflare Pages：构建命令 `npm run build`，输出目录 `dist`，Node 22。或用 `.github/workflows/deploy.yml`（需仓库 secrets CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID）。
