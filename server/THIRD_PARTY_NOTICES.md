# 上游项目与二次开发来源

检索日期：2026-11-13。

本服务的插件加载入口 `app.cjs` 改编自 [fastify/fastify-cli](https://github.com/fastify/fastify-cli) 的 `templates/app/app.js`，固定上游提交 `1fb1f49ab52b6ead413fb3ee7be640b494ef64e2`。完整 MIT 声明在 [licenses/fastify-cli-MIT.txt](licenses/fastify-cli-MIT.txt)。在此脚手架基础上添加 PostgreSQL 关系模型、现有业务路由适配、微信网关、文件授权和事务审计。Fastify 与 node-postgres 通过锁文件安装，不复制其运行时源码。

## GitHub 选型比较

| 项目 | 适用能力 | 本项目取舍 |
| --- | --- | --- |
| [Fastify CLI](https://github.com/fastify/fastify-cli) | MIT；插件和路由脚手架 | 采用；兼容现有 CommonJS handlers 和 Vue 后台 |
| [Strapi](https://github.com/strapi/strapi) | 内容管理、自动 API、PostgreSQL | 内容维护强，但钱包、微信和审核流程仍需编写自定义服务，已有后台也需迁移 |
| [Directus](https://github.com/directus/directus) | SQL 数据管理、自动 API、管理界面 | 适合通用数据运营；采用前需单独核对其当前许可证与使用条件，现有积分和审核规则仍需自定义扩展 |
| [Brocoders NestJS boilerplate](https://github.com/brocoders/nestjs-boilerplate) | MIT；TypeORM、PostgreSQL、认证、Docker | 适合全新 TypeScript 服务；当前选择复用已有业务和接口，减少同步重写 |

所选方案二次开发的是官方后端脚手架；招聘、审核及运营界面继续使用本仓库已有实现。没有将未采用项目的代码或许可证引入仓库。
