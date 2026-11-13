# PostgreSQL 后端设计与接入

2026-11-13。独立 API 在 Fastify 官方 MIT 脚手架上二次开发；小程序继续使用 uni-app，运营后台继续使用 Vue 3 / Element Plus。GitHub 项目比较与固定来源见 [第三方声明](../server/THIRD_PARTY_NOTICES.md)。

## 数据与接口结构

```mermaid
flowchart LR
  Mini[uni-app 小程序] -->|HTTPS /api + 用户令牌| API[Fastify API]
  Admin[Element Plus 后台] -->|HTTPS /api + 管理员令牌| API
  API --> Domain[现有业务与审核处理器]
  Domain --> Adapter[SQL 查询与事务适配]
  Adapter --> PG[(PostgreSQL 17)]
  API --> WX[微信登录 / 手机号 / 支付 v3]
  WX -->|验签、解密、幂等入账| API
  API --> Files[私有附件与限时访问链接]
```

业务 API 保留 `{ success, code, message, data }` 和现有路径，HTTP 错误同时使用对应状态码。`app/src/api/cloud.js` 在设置 `VITE_API_BASE` 时使用独立 HTTP 后端；用户身份来自服务端验证的微信 code 和签发令牌。`X-Openid` 不作为身份凭证。管理员采用独立签名密钥，数据库中管理员必须存在且启用；密码使用 scrypt，已有旧密码摘要登录成功后自动升级。

| 关系表 | 主要内容与关系 | 前端 / 管理入口 |
| --- | --- | --- |
| users、admins | 微信用户、企业资料、认证状态、积分余额；管理员凭据 | 登录、个人中心、企业资料、用户/认证审核 |
| categories、jobs、resumes | 工种、岗位、工人简历；岗位关联工种和发布者，简历关联用户 | 首页、招工、简历、工种管理、岗位/简历审核 |
| applications | 岗位报名、工人与发布者、处理状态 | 我的报名、应聘者、录用/拒绝 |
| wallet、orders、unlocks | 收支流水、微信充值订单、联系方式解锁 | 钱包、签到、置顶/刷新、财务流水 |
| favorites、reviews、notifications | 收藏、评价和消息 | 收藏、评价、消息列表 |
| blacklist、reports、feedback | 黑老板标记、举报及申诉、客服反馈 | 信用查询、举报、申诉审核、反馈处理 |
| trainings、training_enrolls | 培训课程及报名 | 培训列表、我的课程、培训管理和报名历史 |
| insurances、user_insurances | 保险产品及历史购买快照 | 保险列表、我的保障、保险管理和购买历史 |
| banners、announcements、configs | 轮播、公告、页面内容、字典和费用规则 | 运营内容、工种和费用配置 |
| uploads、audit_logs | 附件归属与磁盘文件元数据、管理员操作记录 | 授权附件预览、操作日志 |

完整字段、外键、唯一约束、索引在 [001_initial.sql](../server/db/001_initial.sql)，API 字段映射在 [schema.cjs](../server/db/schema.cjs)。核心数据使用类型列：金额 `numeric(14,2)`、事件时间 `timestamptz`、积分/计数为整数。API 的字符串 ID、毫秒时间保持兼容。配置及可选扩展资料使用 JSONB，业务关系使用外键。编号迁移带校验和，已应用迁移不得修改，应追加新迁移。

## CRUD 与审核规则

- 工种可编辑名称、描述、顺序与启停；历史岗位保留分类归属。字典 value 保持稳定，显示 label 可改。
- 培训、保险提供分页列表、新增、编辑、下架和历史查看；下架后停止新报名/购买，已产生的历史记录继续可见。培训报名沿用现有意向登记行为，课程标价不会自动扣款；保险购买按产品价格扣余额并记录流水，实际承保仍需接入保险服务商。
- 岗位状态为待审核 0、通过 1、下架 2、过期 3、驳回 4。简历 `status`（求职状态）和 `reviewStatus`（审核状态）分开维护，内容更新需重新审核。
- 实名/企业认证和简历继续通过专用审核接口处理。黑名单申诉复用 `reports.reportType=6`，通过/驳回为 2/3；通过在同一事务中撤销标记并通知用户，重复审结返回冲突。
- 费用管理只允许联系、置顶、刷新、签到、资料任务、信用查询和有效期的明确配置项；不暴露签名密钥、支付密钥等环境配置。
- 成功的管理写请求与 `audit_logs` 同事务落库，记录管理员、方法、路由、目标和时间，不记录密码、身份证或请求正文。当前权限模型为现有超级管理员角色，尚未拆分编辑员/审核员等细粒度角色。

## 一致性与附件

完整业务请求放在 PostgreSQL 事务中；失败响应或异常回滚。唯一约束覆盖 OpenID、报名、收藏、解锁、培训报名、充值订单/交易号与充值流水。支付回调验证平台签名、时间、商户、应用、付款人、币种、金额并解密后，才执行幂等入账。

微信 code/手机号交换、支付下单的网络等待均放在事务之外。充值先保存 pending 订单，之后调用微信；网络超时的订单保留 pending，允许后续已验签回调入账。订单主动查询、关单、定时对账尚需运营部署时补充，不能仅凭客户端成功提示入账。

当前兼容层仍使用全局 advisory transaction lock 串行化业务读改写，因为部分 GET 也会更新浏览计数和过期状态。该实现适合当前业务联调；高并发上线前需要针对实际压力测试，逐步拆分纯读取、账户锁和订单锁。金额扣减、订单状态和审计写入不能拆成无事务操作。

上传只接受最多 5 MiB 的 PNG/JPEG/WebP，落盘路径使用随机 ID；元数据保存在 uploads，业务记录保存 `ghq://ID`。读取时校验归属、管理员权限或已发布内容引用，再签发 15 分钟链接。私有资料不挂载静态公开目录。多实例部署应配置共享存储或对象存储，并同时备份数据库与附件目录。

## 本机已准备的环境

当前工作区的独立开发数据库容器是 `ghq-postgres-dev`，监听 `127.0.0.1:55438`，数据卷 `ghq_postgres_dev_data`。API 使用 `127.0.0.1:3002`，避免占用已有 3001 服务；后台验收地址 `http://127.0.0.1:5186/`。`server/.env` 已生成独立随机密钥，管理员账号为 `admin`，初始密码见该文件 `ADMIN_INIT_PASSWORD`，文件被 Git 忽略。验收课程已下架，记录保留用于核查审计。

重启现有本机环境：

```powershell
docker start ghq-postgres-dev
Set-Location D:\code\guanhanquan-miniprogram\server
npm ci
npm start
```

另一个终端启动后台：

```powershell
Set-Location D:\code\guanhanquan-miniprogram\admin
pnpm install --frozen-lockfile
$env:GHQ_API_TARGET = 'http://127.0.0.1:3002'
pnpm dev --host 127.0.0.1 --port 5186
```

## 新环境部署

1. 使用 Node.js 22+、PostgreSQL 17。复制 `server/.env.example` 为 `.env`，设置数据库密码、四个独立随机密钥及至少 12 位管理员初始密码。`PUBLIC_BASE_URL` 为 `https://api.example.com/api`，`CORS_ORIGINS` 填后台真实来源。
2. 可以在 server 目录执行 `docker compose up -d postgres` 启动 PostgreSQL；填写的 `POSTGRES_PASSWORD` 须与 `DATABASE_URL` 一致。安装 `npm ci` 后启动 `npm start`，服务启动自动执行迁移并初始化工种；也可单独 `npm run migrate`。
3. 构建管理后台，设置 `VITE_API_BASE=https://api.example.com/api`，或者让同域网关将 `/api` 反向代理至服务。管理员首次正确登录完成初始化，之后可移除 `ADMIN_INIT_PASSWORD`。
4. 小程序构建设置 `VITE_API_BASE=https://api.example.com/api`，将该域名加入微信 request/uploadFile/downloadFile 合法域名。正式构建不要设置 `VITE_LOCAL_API`。
5. 配置 `WX_APP_ID`、`WX_APP_SECRET` 后验证登录和手机号；支付另外配置商户号、证书序列号、商户私钥、API v3 密钥、平台证书或平台公钥，以及 HTTPS 回调 `https://api.example.com/api/pay/wechat/notify`。
6. 容器部署使用仓库根目录为 context：`docker build -f server/Dockerfile -t ghq-api .`。提供环境配置并持久挂载 uploads；生产环境禁止启用开发登录。

本地 H5 入口为 `http://127.0.0.1:8081/`，通过 `http://127.0.0.1:3002/api` 连接上述 PostgreSQL 后端。复制 `app/.env.development.example` 为 `app/.env.development.local`，设置 `VITE_API_BASE` 和 `VITE_DEV_LOGIN_KEY`（与服务 `DEV_LOGIN_KEY` 相同），随后在 app 目录运行 `npm run dev:h5 -- --host 127.0.0.1 --strictPort`。本机配置已完成；`server/.env` 的 `CORS_ORIGINS` 已包含该预览来源。

本地配置文件被 Git 忽略，并只在开发模式加载。H5 开发模式提供“本地开发登录”，使用后端签发的用户令牌访问个人资料、钱包和简历。登录后可完善头像和昵称，再回到来源页面；微信手机号仍需在小程序内真实授权。服务仅接受回环地址的开发登录，并在 `NODE_ENV=production` 禁用它。正式构建单独配置 HTTPS `VITE_API_BASE`，微信端始终使用真实 code 登录。

### 微信登录与头像昵称接入

登录调用链为 `uni.login → POST /auth/login → code2Session → OpenID 对应用户 → 业务 token`。服务端只返回用户资料和业务令牌，不返回微信 session_key。后续请求使用 `Authorization: Bearer <token>`。

岗位列表需要登录：`/jobs/list`、推荐/附近/最新列表及分类岗位列表均要求用户鉴权，匿名或失效令牌返回 401。首页默认可进入，游客只加载运营内容和筛选字典，岗位列表区域展示登录入口；登录后按当前筛选条件加载列表。

小程序使用 `chooseAvatar` 得到临时图片后，先上传到 `POST /files?dir=avatar`，再用返回地址与昵称请求 `PUT /users/profile`。后端验证图片所有权、昵称长度和可写字段，把图片保存为持久文件引用，响应时生成有时限的访问地址；`GET /users/profile` 和下一次登录会重新签发图片地址。重登仍对应相同用户。

微信开发者工具与真机配置：

1. 在 `app/src/manifest.json` 的 **mp-weixin.appid** 填写实际 AppID；根级 appid 不代替此字段。
2. 在服务端环境配置相同的 `WX_APP_ID` 与 `WX_APP_SECRET`，密钥只保留在服务端。
3. 小程序构建配置正式 HTTPS `VITE_API_BASE`；微信后台配置对应 request、uploadFile、downloadFile 合法域名及用户隐私保护指引。
4. 真机验证首次登录、拒绝或取消选择头像、微信昵称安全检测、资料回显、登录失效和返回来源页；手机号绑定另行验证。

当前本地服务尚未配置微信 AppID/密钥，因此本地验收覆盖实际 PostgreSQL 会话与资料读写，以及模拟微信网关的自动测试，尚未完成真实微信 code 交换。登录跳转与会话回归运行 `node app/scripts/test-auth.cjs`。

## 旧数据与验收边界

本次建立了完整持久化模型和接口，没有访问或搬迁线上微信云数据。迁移既有数据时需导出各集合、保留 `_id` / `_openid`、使用原 `CONTACT_KEY` 与 `PHONE_SALT` 才能解密联系方式和匹配历史黑名单，并按外键检查后事务导入。旧 `cloud://` 附件需转存并更新文件引用；独立服务不会冒充云存储返回可用链接。

服务端数据库测试命令：

```powershell
Set-Location server
$env:TEST_DATABASE_URL = 'postgresql://USER:PASSWORD@HOST:PORT/DATABASE'
npm test
```

测试创建并清理独立 schema，不清空现有业务表。未设置 `TEST_DATABASE_URL` 时数据库用例跳过，不能把跳过当成通过。另运行 `node cloudfunctions/api/test/run.js`、`content.test.js`、`management.test.js`，以及 app 的 `build:mp-weixin` / `build:h5` 和 admin 的 `build`。

真实数据库验收覆盖认证、权限、CRUD、审核、签到/解锁并发、报名、保险扣费、支付幂等、附件权限和服务重连读取。微信真机登录、手机号授权、原生拨号与真实商户支付仍需配置后联调。当前机器未安装 graft，仓库也未生成 graft 图谱，无法执行图谱刷新。

本次已执行：新增服务 62 项测试全部通过（包含真实 PostgreSQL），原业务 124 项通过、运营内容 20 项断言通过，新增管理回归通过；小程序、H5 和管理后台发行构建通过。浏览器已在 PostgreSQL 模式验收后台登录、课程新增/编辑/下架与刷新持久化、审计记录和申诉空状态，另检查 320px/390px 菜单和表单布局。

H5 当前在 `http://127.0.0.1:8081/` 使用本地开发登录接入同一 PostgreSQL。已复核首页空状态、三项主导航、34 个省级地区、7 个工种、登录令牌、钱包及已有简历整页刷新读取。此前已验证简历提交与完善资料奖励入账；验收简历保持待审核。首次匿名浏览只读取公开数据，登录后同步个人资料。
