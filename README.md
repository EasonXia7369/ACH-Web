<div align="center">

# Ark Class Hub · Web

**方舟班级中心 · 前端** —— 面向学校/年级组的轻量班级事务平台

*[后端仓库 ArkClassHub-Server](https://github.com/EasonXia7369/ArkClassHub-Server) · 线上地址 [ach.macrostar.top](https://ach.macrostar.top)*

</div>

## 功能总览

| 板块 | 内容 |
|------|------|
| **大板** | 教室大屏首页：大时钟、每日寄语、作业通栏大卡（实时同步）、今日课程、出勤概况（含异常人名）、今日值日生 |
| **出勤** | 每日登记（早/中/晚 × 出勤/请假/迟到/旷课/违纪 + 备注）、月度统计（按天/按次双口径）、请假申请与审批、周报（Excel / 分享图片导出） |
| **作业** | 作业布置（学生与老师同权，操作按角色留痕）、未交登记、区间统计导出 |
| **消息** | 班级群实时聊天（WebSocket）：文字、快捷短语、语音（60s）、图片，浏览器通知 + 提示音 |
| **管理** | 名单管理（单个添加 + 批量导入）、课程表（支持 [CSES v1](https://github.com/SmartTeachCN/CSES) 导入导出）、值日表、班级设置、账号管理（管理员）、邀请码、旧数据导入 |
| **一体机** | `/kiosk` 学生密码解锁 → 值日生身份进入大板登记，操作留痕为「学生」 |

**PWA**：可安装到主屏幕，离线查看最近数据，消息实时推送。

## 技术栈

- Vite + Vue 3 + TypeScript + Pinia + Vue Router
- VueUse（主题/定时/工具）、dayjs、pinyin-pro（名单拼音检索）、ExcelJS（懒加载导出）、js-yaml（CSES 互通）
- MiSans 分片 webfont（按需加载）
- PWA：vite-plugin-pwa（预缓存应用、API NetworkFirst、字体 CacheFirst）

## 本地开发

```bash
npm install
npm run dev        # Vite @ :5173，/api 代理到本地后端 :8787
```

后端启动见[后端仓库](https://github.com/EasonXia7369/ArkClassHub-Server)（`wrangler dev` 跑在 :8787）。本地测试账号：

| 姓名 | 角色 | 密码 |
|------|------|------|
| admin | 管理员 | dev1234 |
| teacher | 班主任 | teach123 |

> 本地数据库的账号密码若丢失，可用引导码（`server/.dev.vars`）重新激活或直接重置本地 D1。

## API 地址配置

- 开发：走 vite 代理（相对路径 `/api`）
- 生产：`.env.production` 的 `VITE_API_BASE`（当前 `https://arkapi.macrostar.top`）

## 部署

push 到 `main` → GitHub Actions 自动构建并部署到 Cloudflare Pages（需仓库 Secret `CF_API_TOKEN`）。

## 相关仓库

- [ArkClassHub-Server](https://github.com/EasonXia7369/ArkClassHub-Server) — 后端 API（Cloudflare Workers + D1）
- [Ark-Class-Hub](https://github.com/EasonXia7369/Ark-Class-Hub) — 原型存档

## 协议

GPL-3.0
