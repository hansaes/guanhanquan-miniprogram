# 管焊圈小程序

面向焊工、管工、铆工、起重工等蓝领技术工人的招工找活平台。招工方发布岗位，工人浏览联系，平台审核并管理黑名单。

## PostgreSQL 后端与运营管理

`server/` 为独立后端，在 [Fastify 官方脚手架](https://github.com/fastify/fastify-cli) 上二次开发，使用 PostgreSQL 17 的 24 张业务表，接通小程序接口与 Element Plus 后台。支持工种、页面内容、培训、保险、费用配置以及招工、简历、认证、举报和申诉审核，管理写入记录操作日志。

启动、数据模型、接口覆盖与微信配置见 **[PostgreSQL 后端设计与接入](docs/PostgreSQL后端设计与接入.md)**。后端来源与许可见 [server/THIRD_PARTY_NOTICES.md](server/THIRD_PARTY_NOTICES.md)。

管理后台基于 [Pure-Admin 官方应用精简版](https://github.com/pure-admin/pure-admin-thin) 二次开发，使用其完整布局、多标签页、菜单搜索和主题系统，接入 18 个业务页面。启动说明见 [admin/README.md](admin/README.md)，固定上游提交及 MIT 许可见 [admin/THIRD_PARTY_NOTICES.md](admin/THIRD_PARTY_NOTICES.md)。

## 结构

```
app/                小程序端（uni-app 3 + Vue 3 + Vite）
  src/api/          接口层：PostgreSQL HTTP / 微信云函数 / 内存演示
  src/pages/        首页、发布、个人中心及业务页面
  src/store/        Vuex 4
cloudfunctions/
  api/              HTTP 服务与云函数共用的业务接口
    handlers/       登录、岗位、简历、报名、钱包、内容及管理接口
    test/           内存数据库 + 124 项业务验收
  pay-notify/       微信支付回调
admin/              Pure-Admin 运营后台（Vue 3 + TypeScript + Pinia + Element Plus）
server/             Fastify + PostgreSQL 独立服务、迁移、微信网关与集成测试
scripts/dev-api.cjs 本地 API 服务（无需云环境即可联调）
docs/               UI 规范、验收记录、后端接入与架构决策
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

```powershell
# 从仓库根目录执行
node --test app/scripts/test-*.cjs
node cloudfunctions/api/test/run.js
node cloudfunctions/api/test/content.test.js
node cloudfunctions/api/test/regions.test.js
node cloudfunctions/api/test/profile-form.test.js
node cloudfunctions/api/test/management.test.js
```

后端 PostgreSQL 集成测试在隔离 schema 中运行，需要先配置 `TEST_DATABASE_URL`，执行方式见 [后端接入文档](docs/PostgreSQL后端设计与接入.md)。

编译检查：

```powershell
Set-Location app
npm run build:mp-weixin
npm run build:h5
Set-Location ../admin
pnpm typecheck
pnpm build
```

微信原生登录、头像昵称、拨号与支付仍需微信开发者工具和真机验证。界面验收步骤与已验证范围见 [UI验收记录](docs/UI验收记录.md)，临时截图统一存放在 Git 忽略的 `output/`。

## 文档入口

- [UI设计规范](docs/UI设计规范.md)：组件、导航、交互和后台内容契约。
- [UI验收记录](docs/UI验收记录.md)：本次改版的测试、截图和微信端待验证项。
- [PostgreSQL后端设计与接入](docs/PostgreSQL后端设计与接入.md)：服务启动、迁移、微信配置和部署。
- [原始需求与历史验收基线](docs/交付验收与缺口总表.md)：2026-11-11 的需求矩阵与交接背景。

## 云开发部署

云函数部署路径继续保留。当前 HTTP 服务的部署配置以 [后端接入文档](docs/PostgreSQL后端设计与接入.md) 为准。

## 许可

MIT（源自 BXCQ/Gigplatform_front，保留原始版权声明）。

## UI 与后台内容配置

页面改动前请阅读 [UI设计规范](docs/UI设计规范.md)。后台的「小程序内容」管理运营标签、筛选选项、入口与常见问题，「工种管理」维护工种名称和启停。小程序与云函数需要配套更新，配置保存在 `configs` 集合的 `uiContent` 项中；尚未保存时使用服务端默认内容。
