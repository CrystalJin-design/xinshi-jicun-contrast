# 你的反差人格有多大？ · 心事寄存

云端网址：https://crystaljin-design.github.io/xinshi-jicun-contrast/

前端为GitHub Pages，后端为独立Supabase项目的Edge Function与Postgres。发货密码、更新和免费套餐说明见 [云端部署与发货](docs/云端部署与发货.md)。关闭本地电脑后云端网站仍可使用；免费Supabase项目可能因低活动暂停，此方案由用户选择。

48道原创本土情境题、4组双情境观察、2项补充观察、16种主要趣味画像，以及中点过渡/信息不足处理。米白、墨绿与暖杏色的原创界面，支持手机和电脑。

完整题库、理论来源、计分和待实施验证计划见 [测评内容与理论说明](docs/测评内容与理论说明.md)。这是理论启发的原创自评初版，尚未通过本土样本信效度验证。程序验收不能替代心理测量验证。

## 本机运行

需要Node.js 24及以上。

```powershell
cd D:\coedx产出\测评工具\jianji
npm ci
npm run dev
```

电脑打开 http://localhost:5174 。同一局域网手机可打开终端显示的Network地址（当前环境为 http://192.168.8.20:5174），电脑需保持运行且防火墙允许访问。

本地交付体验密码：`JIANJI2026`。独立于验收密码，初始3次；仅开发模式首次运行时创建。验证不扣次，开始新测评才扣次，未完成可继续。一个密码最多同时保留一份未完成测评。

## 用户功能

- 服务端SQLite事务限制每密码共3次，多设备或重复点击不会重复开启同一未完成测评。
- 48题，支持返回、修改、查看题目导航、串行自动同步、网络失败时的本机草稿、刷新恢复。
- 并发修改时检测版本冲突，用户可选择载入最新进度。
- 服务器计分，拒绝缺答与非法参数；不适用按缺失处理。
- 完整报告PNG长图、预览、下载、手机长按保存和浏览器支持时的系统图片分享。
- 随机192位报告链接，无需密码即可阅读。分享前提示报告包含部分回答摘录，不暴露密码或整份原始答卷。
- 历史报告、再测一次、好评后联系客服发送截图领取1元返现的友好提示。

网页保存图片需要用户点击下载、长按图片或使用系统分享菜单；浏览器不能自动无交互写入手机相册。

## 店铺配置

编辑 `site.config.json` 设置店铺名称、客服联系说明、可选客服微信与返现文案。当前店铺为“心事寄存”，客服入口提示返回店铺联系。修改后重新发布前端与Edge Function。

## 密码发货

```powershell
npm run codes:create -- --count 100 --label 第一批发货
npm run codes:list
npm run codes:revoke -- --code JJ-要停用的密码
```

生成的明文密码仅在忽略提交的 `data/发货密码-时间.csv` 中保存。数据库只存SHA-256摘要；生成密码具有48位随机熵（6字节），配合验证限速。请保管CSV。停用不删除已经分享的报告。

## 备用的自建Node服务运行

当前线上服务使用Supabase；以下仅用于选择自行托管Node服务的情况。构建时须清除 `.env.production.local` 中的云端配置或显式将API地址设为 `/api`、基础路径设为 `/`。

```powershell
npm ci
npm run build
$env:NODE_ENV='production'
$env:PUBLIC_ORIGIN='https://你的域名'
$env:DATA_DIR='D:/持久化目录/jianji-data'
npm run codes:create -- --count 100
npm start
```

默认监听8790端口，Express同时提供 `dist` 与 `/api`。配置HTTPS反向代理到8790，`PUBLIC_ORIGIN` 与用户访问的域名一致。保持 `DATA_DIR` 在持久磁盘上，备份SQLite（写入时使用支持WAL的一致性备份方式），不要暴露data目录。生产模式不生成公开体验密码；如果复用开发数据库，请先停用开发体验密码。多实例部署需使用共享数据库和分布式限速，本项目默认单实例。

服务端仅信任本机回环地址的代理转发。HTTPS反向代理需位于同一主机，并正确覆盖/追加 `X-Forwarded-For`；生产环境建议设置 `HOST=127.0.0.1`，由代理对外提供访问，避免所有用户共用代理IP的登录限额。若代理拓扑不同，需按实际可信代理地址调整配置，不应无条件信任转发头。

GitHub Pages本身只提供静态前端；本项目通过独立的Supabase后端提供次数验证、进度和报告。此目录独立于外层已上线的塔罗项目，本次没有修改其线上部署。

## 验证

```powershell
npm test
npm run build
node scripts/export-content.js
node scripts/verify-browser.js
```

浏览器脚本需要先启动开发服务，首次运行使用 `npx playwright install chromium` 安装浏览器。使用独立QA密码，完成后停用；截图和下载PNG保存在忽略提交的 `artifacts/` 中。

本次实际检查结果与未验证范围见 [交付验收记录](docs/verification.md)。
