# 心事寄存云端部署实施计划

**Goal:** 将“你的反差人格有多大？”发布到独立GitHub Pages站点，使用Supabase Edge Function与Postgres提供不限于本机的测评服务，店铺名称改为“心事寄存”。

**Architecture:** 保留当前React界面及本地开发服务，新增可配置的HTTPS API地址和Pages子目录构建。生产API通过Supabase Edge Function执行原有计分模块，Postgres事务负责密码三次额度、保存版本与幂等提交；表启用RLS且仅云端service_role可调用业务RPC。新部署不覆盖已有塔罗站点或其数据。

**Tech Stack:** React/Vite、Supabase Edge Functions/Deno、Supabase Postgres、GitHub Pages/Actions、PGlite及Playwright。

1. 修改店铺配置与页面标题；配置 `VITE_API_URL` 和 `VITE_BASE_PATH`，保持分享链接包含Pages子目录。
2. 新增 `supabase/migrations/202610180001_jianji.sql`。使用 `jianji_` 命名空间、显式索引、RLS和函数权限；开启测评时锁定密码行，在同一事务扣次与创建答卷。保存和提交检查版本及所有权。
3. 新增跨Node/Deno的 `shared/cloud-api-handler.js`，保持现有前端API结构，验证参数、限制请求体、处理CORS和云端限速，返回冲突时附带最新答卷。用准备脚本复制业务模块到Edge打包目录，避免题库漂移。
4. 在PGlite中执行实际生产迁移，测试密码、额度、配对计分、冲突、缺失值、公开报告、权限、SQL和HTTP输入验证。已有本地保存测试继续运行。
5. 增加云端密码生成/查询/停用命令，密钥只保存在忽略提交的本机环境文件；新增独立GitHub仓库和Pages自动构建。公开构建变量仅包含HTTPS API地址与公开调用key。
6. 确认可用账户后部署数据库及Edge Function，再发布前端。若需登录/注册或付费，由用户操作；代码、构建和验收准备继续进行。
7. 在公网运行独立验收密码的完整答题、保存长图、公开分享、再测和限次流程；交付HTTPS网址、未使用的三次密码及运营说明。免费套餐的闲置暂停和访问网络限制如实说明，不以监控规避服务商限制。
