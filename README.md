# Urania

**Global Product Intelligence & CRM** — 全球 AI 选品研究、B2B 客户开发与外贸销售工作台。

> 当前版本是前端基础框架与交互原型。界面中的市场指标、产品机会、企业线索和销售金额均为演示数据；尚未连接真实业务 API，不应作为商业决策依据。

## 首期模块

- 工作台：产品机会、销售管道、待办事项与数据源状态。
- 产品研究：机会列表、市场筛选、评分解释、利润情景入口。
- CRM：企业线索池、匹配度、销售阶段与后续客户详情入口。
- 数据情报：全球搜索、企业/联系人情报、市场趋势、证据规范。
- 自动化中心：任务队列、首次开发邮件人工审批示意。
- API 集成中心：SerpApi、DataForSEO、Keepa、eBay Browse API、Google Trends 与 Supabase 连接器目录。
- 系统设置：权限、数据治理、预算、审计与健康状态入口。

## 技术栈

- React + TypeScript + Vite
- Lucide React icons
- Responsive CSS
- 后续集成：Supabase Postgres/Auth、Cloudflare Workers/Queues、受授权的外部 API

## 本地运行

要求 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

构建与类型检查：

```bash
npm run typecheck
npm run build
npm run preview
```

静态构建输出到 `dist/`。

## 关键约束

1. 所有外部 API 密钥必须保存在服务端 secret / secret manager 中，不可放入前端、Git 历史或公开环境变量。
2. 数据源必须记录许可范围、来源 URL、采集时间、数据类型与保留期限。
3. 区分直接交易数据（T1）、代理指标（T2）与模型估算（T3）；不把搜索热度、商品排名或评论增长称为真实销量。
4. 首次开发邮件默认草稿并人工批准。前端的“批准”演示不发送邮件。
5. 在只读审计现有 Cloudflare Worker、Queues、Supabase schema/RLS 与仓库历史完成前，不覆盖现有资源。
6. 生产环境必须启用身份验证、最小权限、数据库 RLS、服务端校验和审计日志。

## 计划中的领域模块

- `research`: products, offers, observations, supplier_quotes, profit_scenarios, scores, reports
- `crm`: accounts, contacts, leads, opportunities, activities, quotes, orders
- `integrations`: data_sources, connector_configs, usage_events, license_policies
- `automation`: collection_jobs, task_runs, queue_events, approvals
- `audit`: audit_events, data_change_events

数据库 schema 与迁移需先完成资源审计后再实施。现有 Urania Cloudflare Worker 与其他 B2B / Sophrosyne 资源保持独立。
