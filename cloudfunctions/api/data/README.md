# 地区数据

`area-list.json` 来自 `@vant/area-data` **2.2.0**，2026-11-13 从 npm 官方包提取。保留原始行政代码与名称，许可证见 `VANT-LICENSE.txt`。

- 源项目：https://github.com/vant-ui/vant/tree/main/packages/vant-area-data
- 包版本：https://www.npmjs.com/package/@vant/area-data/v/2.2.0
- 数据：34 个省级、369 个市级、3478 个区县级条目。

后端 `regions.js` 转为 `{ value, text, children }`，通过 `GET /regions/tree` 提供给小程序与 H5。更新此数据快照并部署 API 即可更新客户端地区选项；前端仅缓存当前运行会话，不打包行政区数据。数据版本代表组件库快照，行政区划调整时应更新并复核。
