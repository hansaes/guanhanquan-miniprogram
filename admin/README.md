# 管焊圈运营中心

基于 [Pure-Admin 官方精简版](https://github.com/pure-admin/pure-admin-thin) 二次开发，面向 PC 浏览器的 Vue 3 + TypeScript + Pinia + Element Plus 管理后台。源码版本与许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 启动

需要 Node.js 20.19+ 或 22.13+、pnpm 9+。使用提交的 pnpm-lock.yaml 安装依赖：

```powershell
Set-Location D:\code\guanhanquan-miniprogram\admin
pnpm install --frozen-lockfile
$env:GHQ_API_TARGET = 'http://127.0.0.1:3002'
pnpm dev
```

默认访问 http://127.0.0.1:5186/，固定端口被占用时会报错。GHQ_API_TARGET 的默认值为 http://127.0.0.1:3001；本工作区 PostgreSQL 服务使用 3002。所有业务请求经过 /api 代理。管理员初始化账号与密码由 server/.env 配置。

生产构建与检查：

```powershell
pnpm typecheck
pnpm build
pnpm preview --host 127.0.0.1 --port 5190
```

部署 admin/dist 并在 Web 服务器将 /api 反向代理到 Fastify。public/platform-config.json 随构建发布，控制主题、布局、标题和标签页。默认 hash 路由。VITE_API_BASE 可用于独立 API 域名，此时需配置后端 CORS；API 密钥和数据库密码只保存在服务端。

## 业务入口

| 分组 | 页面 |
| --- | --- |
| 工作台 | 运营概览与待办快捷入口 |
| 审核中心 | 招工、简历、认证、举报、黑名单申诉 |
| 内容运营 | 小程序内容、工种、轮播、公告 |
| 用户与服务 | 用户、黑老板库、客服反馈 |
| 产品管理 | 培训课程、保险产品及报名/购买记录 |
| 财务与设置 | 费用与奖励、财务流水、操作日志 |

## 开发入口

- src/router/modules/business.ts：业务菜单与路由；home.ts 为运营概览。
- src/views/guanhanquan/：业务表单、列表、审核页面。
- src/api/guanhanquan.js：统一业务 API、错误处理和鉴权。
- src/utils/auth.ts / admin-session.ts：适配服务端管理员令牌，会话到期或服务端 401 时返回登录。
- src/layout/、src/components/、src/store/：Pure-Admin 框架源码。
- src/style/guanhanquan.scss：业务页面主题适配。
- public/platform-config.json：应用外观配置。

页面沿用服务端权限校验与审计记录；菜单分组用于导航。当前业务沿用既有管理员权限模型。费用修改含离开提示，保存后记录日志。业务页面按路径重新挂载，返回时读取最新数据。

## 本地验收

2026-11-13 在真实 PostgreSQL 开发库上完成：18 个页面 GET 请求成功且无浏览器运行时异常；费用配置与工种排序修改保存、刷新回读并恢复原值；菜单搜索与培训/保险切换通过；失效令牌返回 401 并清除会话，重新登录回到原页；生产构建及 TypeScript 检查通过，生产预览登录与页面加载通过。页面截图位于仓库 output/playwright/。验收不代表生产部署或微信真机验证。
