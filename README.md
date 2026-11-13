# 管焊圈小程序

面向焊工、管工、铆工、起重工等蓝领技术工人的招工找活平台。招工方发布岗位，工人浏览联系，平台审核并管理黑名单。

## PostgreSQL 后端与运营管理

新增 `server/` 独立后端，在 [Fastify 官方脚手架](https://github.com/fastify/fastify-cli) 上二次开发，使用 PostgreSQL 17 的 24 张业务表，接通现有小程序接口与 Element Plus 后台。支持工种、页面内容、培训、保险、费用配置以及招工、简历、认证、举报和申诉审核，管理写入记录操作日志。

启动、数据模型、接口覆盖与微信配置见 **[PostgreSQL 后端设计与接入](docs/PostgreSQL后端设计与接入.md)**。后端来源与许可见 [server/THIRD_PARTY_NOTICES.md](server/THIRD_PARTY_NOTICES.md)。

管理后台基于 [Pure-Admin 官方应用精简版](https://github.com/pure-admin/pure-admin-thin) 二次开发，使用其完整布局、多标签页、菜单搜索和主题系统，接入 18 个业务页面。启动说明见 [admin/README.md](admin/README.md)，固定上游提交及 MIT 许可见 [admin/THIRD_PARTY_NOTICES.md](admin/THIRD_PARTY_NOTICES.md)。

## 结构

```
app/                小程序端（uni-app 3 + Vue 3 + Vite）
  src/api/          接口层：PostgreSQL HTTP / 微信云函数 / 内存演示
  src/pages/        33 个已注册页面
  src/store/        Vuex 4
cloudfunctions/
  api/              单入口云函数，91 条路由
    handlers/       auth jobs workers applications categories social wallet blacklist admin
    test/           内存数据库 + 124 项业务验收
  pay-notify/       微信支付回调
admin/              Pure-Admin 运营后台（Vue 3 + TypeScript + Pinia + Element Plus）
server/             Fastify + PostgreSQL 独立服务、迁移、微信网关与集成测试
scripts/dev-api.cjs 本地 API 服务（无需云环境即可联调）
docs/               交付验收与闭环报告（唯一文档）
```

## 内存演示（没有 AppID 也能跑）

```bash
# 1. 起本地 API（跑的是云函数同一套 handler + 内存数据库，自带演示数据）
node scripts/dev-api.cjs          # http://localhost:3001/api

# 2. 编译小程序（注入本地 API 地址）
cd app && npm install
VITE_LOCAL_API=http://localhost:3001/api npm run build:mp-weixin

# 3. 微信开发者工具导入仓库根目录（测试号即可），编译预览
```

运营后台：

```bash
cd admin
pnpm install --frozen-lockfile
pnpm dev                       # http://127.0.0.1:5186，代理到 3001 API
```

默认管理员：`admin` / `dev-admin-pass`（仅本地内存库）。

## 业务验收

```bash
cd cloudfunctions/api && node test/run.js
```

当前 124 项通过 0 失败。

小程序 E2E：

```bash
cli.bat auto --project <仓库根目录> --auto-port 9420
cd e2e && node ui.cjs       # 16 项
cd e2e && node closure.cjs  # 19 项
```

## 交付状态

代码闭环完成：PDF 3.x 的 77 项功能点中 75 项闭环、2 项为明确产品取舍、0 项缺失。真实微信支付、真机绑手机、云环境部署仍需外部凭证。

逐项需求矩阵、修复对账、验证证据、部署步骤、剩余风险与二期 B1–B10 交接见：

**[docs/交付验收与缺口总表.md](docs/交付验收与缺口总表.md)**

## 云开发部署

见交付报告第七章：填 AppID 与云环境 ID → 建集合与索引 → 部署两个云函数 → 配置环境变量 → 绑定微信支付。

## 许可

MIT（源自 BXCQ/Gigplatform_front，保留原始版权声明）。

## UI 与后台内容配置

页面改动前请阅读 [UI设计规范](docs/UI设计规范.md)。后台的「小程序内容」管理运营标签、筛选选项、入口与常见问题，「工种管理」维护工种名称和启停。小程序与云函数需要配套更新，配置保存在 `configs` 集合的 `uiContent` 项中；尚未保存时使用服务端默认内容。
