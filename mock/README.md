# 纯前端预览（Mock API）

不启动后端、只看画面时使用：

```bash
npm run dev:mock
```

- 默认 `npm run dev` 不受影响（/api 仍代理到 localhost:8787），mock 默认关闭。
- `/api/*` 由 `mock/server.js` 的内存数据接管；PUT/POST 会真实修改内存状态，重启 dev server 重置。
- 登录页随便输入用户名/密码即可（返回"演示老师"教师账号）。
- AI 总结、考勤洞察返回固定示例文本（延迟 ~600ms 模拟生成）。
- 不支持 WebSocket（消息实时推送静默失败，不影响画面预览）。
- 某个页面报"mock 未实现该端点"时，终端会打印对应 `METHOD /path`，在 `mock/server.js` 的 `routes` 表里补一条即可。
