# Pure-Admin 二次开发来源

- 上游仓库：https://github.com/pure-admin/pure-admin-thin
- 分支：main（官方非国际化应用精简版）
- 导入版本：6.2.0
- 固定提交：f0ff132561ab684bb78379239adf29f9a38ac7f1
- 源码链接：https://github.com/pure-admin/pure-admin-thin/tree/f0ff132561ab684bb78379239adf29f9a38ac7f1
- 导入日期：2026-11-13
- 许可：MIT，Copyright (c) 2020-present, pure-admin
- 原始许可全文：[licenses/pure-admin.MIT.txt](licenses/pure-admin.MIT.txt)

## 复用范围

本目录导入并二次开发上游的真实应用源码，包括 layout、components、store、router、utils、directives、plugins、style、登录与错误页面，以及配套构建配置、类型定义和依赖锁文件。保留侧栏、横向/混合导航、多标签页、面包屑、菜单搜索、主题与响应式布局。

管焊圈业务页面集中在 src/views/guanhanquan；业务接口适配位于 src/api/guanhanquan.js。改造项包括真实管理员登录、会话失效处理、业务菜单、运营概览、费用配置、品牌与空头像、业务表格与表单适配，以及通过代理连接 PostgreSQL API。业务页面按路由重新挂载，培训与保险各自读取自己的接口。

构建插件启用 Vue、JSX、Tailwind、SVG 和离线图标；应用运行数据来自 /api。包管理改为 pnpm，增加直接引用的 tippy.js 依赖；启动与构建命令兼容 PowerShell。

按当前业务使用情况裁剪了通用表格封装、全局弹窗、按钮权限组件、打印与缓存工具，以及未启用的构建插件和对应依赖。业务使用 Element Plus 表格与弹窗，路由权限过滤和服务端鉴权继续由现有实现负责。

## 选型记录

比较了 Pure-Admin、Geeker-Admin 和 Vben Admin。选择 Pure-Admin 官方精简版，是因为它与现有 Vue 3 / Element Plus 页面一致，具有完整的后台交互框架，适合接入本仓库已有的 PostgreSQL 业务 API。

- Pure-Admin：https://github.com/pure-admin/pure-admin-thin
- Geeker-Admin：https://github.com/HalseySpicy/Geeker-Admin
- Vben Admin：https://github.com/vbenjs/vue-vben-admin

npm 依赖分别遵循各包附带的许可。Remix 图标由上游 unplugin-icons / Iconify 配置离线打包；原版权声明随依赖包保留。
