# Ark Class Hub · Web（前端）

方舟班级中心的前端：Vite + Vue 3 + TypeScript + Pinia，PWA。配合后端仓库 [`Ark-Class-Hub-Server`](https://github.com/EasonXia7369/Ark-Class-Hub-Server) 使用。

- 生产地址：https://ark.macrostar.top （Cloudflare Pages，push 到 main 自动部署）
- API 地址：https://arkapi.macrostar.top（由 `.env.production` 的 `VITE_API_BASE` 注入）

## 本地开发

```bash
npm install
npm run dev      # Vite @ :5173，/api 代理到 http://localhost:8787
```

后端本地开发见后端仓库（`wrangler dev` 跑在 :8787）。

## 部署

push 到 `main` → GitHub Actions 自动 `vite build` 并 `wrangler pages deploy` 到 Cloudflare Pages（需要仓库 Secret：`CLOUDFLARE_API_TOKEN`）。

## 协议

GPL-3.0
