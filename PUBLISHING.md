# 发布路线图：开源到 GitHub 与上架 DSH 插件市场

本文记录 2026-09 对 DSH 插件生态的实际调查结论，以及本插件的发布步骤。

---

## 一、目标形态

一个能被人搜到、一键安装的社区插件。参照 `dsh-chat-timeline`（同类插件，已有 32 stars / 1627 downloads）的形态：

| 要素 | 作用 | 是否必需 |
| --- | --- | --- |
| GitHub 仓库 | 市场条目的来源与 README 展示，star 数来源 | **必需** |
| npm 包 | `dsh plugin ... add <包名>` 直接安装（prebuilt） | 强烈推荐 |
| 收录条目 | 出现在 awesome-dsh-plugin 的搜索里 | 必需 |

---

## 二、市场机制（实测）

- **站点**：https://awesome-dsh-plugin.com
- **索引仓库**：https://github.com/awesome-dsh-plugin/awesome-dsh-plugin
- **收录入口**：站点页脚的 `Submit ↗` → 该仓库的 `contributing.md`（走 GitHub PR）
- **条目字段**：`name` / `owner` / `url`(GitHub) / `page` / `category` / `description{en,zh}` / `npm` / `version` / `stars` / `downloads` / `install` / `added`
- **自动更新**：站点首页 `numberOfItems` 报 4353，而本地 9 月的 catalog 快照是 3196 — 说明市场在持续爬取，收录后有数据会自动回填

**两种安装来源**（市场详情页同时给出）：

```sh
dsh plugin --profile web add dsh-work-progress              # 来自 npm（prebuilt）
dsh plugin --profile web add github:ardesp0630/dsh-work-progress   # 来自 GitHub 源码
```

---

## 三、发布步骤

### 0. 前置条件

| 项 | 当前状态 |
| --- | --- |
| git | ✅ 已装 2.54.0 |
| gh CLI | ❌ 未安装 |
| git 全局身份（user.name/email） | ❌ 未配置 |
| npm 账号登录 | ❌ 未登录（`ENEEDAUTH`） |
| npm 包名 `dsh-work-progress` | ✅ 未被占用（registry 返回 404） |

### 0. 一键完成（推荐）

`release.ps1` 一次做完元数据补全、署名替换、市场条目生成、建仓与首次提交：

```powershell
.\release.ps1 -GitHubUser <你的GitHub用户名> -AuthorName "<署名>"
```

它**不接触任何凭据**——`npm login` 与 `git push` 只打印命令，由你自己执行。
已在临时副本上跑通验证：11 个文件提交，元数据与 `market-entry.json` 均正确。

> ⚠️ 该脚本是 UTF-8 **带 BOM** 的。用编辑器改写后请保留 BOM，否则 PowerShell
> 会按 GBK 解析中文，引号配对错乱并报出一串语法错误。

跑完它即可直接跳到第 3 步；下面的 1–2 是手动等价步骤。

### 1. 补全元数据

- `package.json`：填入 `repository` / `author` / `homepage` / `bugs`
- `LICENSE`：把 `<版权持有人，发布前请替换>` 换成真实署名

### 2. 建仓并推送

```sh
cd dsh-work-progress
git init
git add .
git commit -m "feat: initial release of dsh-work-progress"
git branch -M main
git remote add origin https://github.com/ardesp0630/dsh-work-progress.git
git push -u origin main
```

### 3. 发布 npm

```sh
npm login
npm publish --access public
```

> 未加 scope 的包名默认 public，但显式写 `--access public` 更稳妥。

### 4. 提交收录

**投稿 = 在市场仓库新增一个 YAML 文件**，不是改 README（那两份 README 由脚本从
`data/plugins/*.yml` 生成，手改会与生成结果冲突）。

把 `_market-entry/ardesp0630__dsh-work-progress.yml` 放进该仓库的 `data/plugins/` 下开 PR：

```yaml
url: https://github.com/ardesp0630/dsh-work-progress
name: ardesp0630/dsh-work-progress
category: ui
description:
  en: "…"   # 必填，以句号结尾；含 ": " 必须加引号
  zh: "…"   # 可选，缺了维护者会补
```

⚠️ **不要在 yml 里写 `npm:` / `version:` / `install:`**——市场从 registry 自动采集映射，
手写 `npm:` 会被校验直接拒绝。

硬性前置条件：

| 条件 | 状态 |
| --- | --- |
| `package.json` 声明 `dsh.bundle`（**只声明 `dsh.client` 会在 CI 这一步失败**） | ✅ 已具备 |
| `cordis.patch.yml` 存在，`insert.name` 等于包名 | ✅ 已具备 |
| 仓库创建满 1 天（CI 自动检查，过滤「PR 前几分钟才建好」的仓库） | ⬜ 建仓后计 |
| 仓库添加 `dsh-plugin` topic | ⬜ 待做 |
| 描述属实、无营销词（描述会被拿来跟代码核对） | ✅ |
| 一个 PR 最多 3 条 | ✅ 只有 1 条 |

可选加分：

- 发布 npm 包——预构建安装可免掉 `allowBuilds` 构建授权步骤；
- 在 `package.json` 旁放 `screenshots.json` 声明 1–8 张截图（相对路径，
  不能以 `/` 开头或含 `..`），市场详情页会像 App Store 那样展示。

---

## 四、⚠️ 本机环境阻塞（已定位根因）

GitHub 不通**不是有人恶意屏蔽**，是两件事叠加。

### 2026-10 更新：实际可行的推送方式

Steam++ 的转发链会间歇性失效（表现为 127.0.0.1:443 只回自签证书、不回数据），
此时任何「连 127.0.0.1:443」的探测都会卡在握手后无响应，很容易误判成网络封锁。

稳定做法是三步，已在本次 0.2.0 推送中验证：

1. **把 hosts 里的 `github.com` 指向真实 IP**（其余 `api.github.com` 等条目可不动）：

   ```
   # 127.0.0.1 github.com          ← 原 Steam++ 行
   20.205.243.166 github.com       ← 改为真实 IP
   ```

   真实 IP 用 `node -e "dns.resolve4('github.com',console.log)"` 取，**不要用 dns.lookup**
   （后者读 hosts）。改完 `ipconfig /flushdns`。

2. **git 换 openssl 后端**：schannel 在吊销检查上直接失败
   （`CRYPT_E_NO_REVOCATION_CHECK`），且 `http.schannelCheckRevoke=false` 对它无效。

   ```
   git config http.sslBackend openssl
   ```

3. **给 openssl 一份 CA 包**：这个 git 安装（`C:\Espressif\tools\git`）没有自带
   `ca-bundle.crt`，需从 Windows 证书存储导出：

   ```powershell
   # 导出 LocalMachine\Root 与 \CA 到 windows-ca.pem，再指向它
   git config http.sslCAInfo "$env:TEMP\windows-ca.pem"
   ```

   这样**证书校验保持开启**，不需要 `GIT_SSL_NO_VERIFY`。

> 如果哪天直连也失效，回退手段：`dns.resolve4` 拿到别的前端 IP（如 140.82.112.3 /
> 20.27.177.113）逐个试，能拿到 `200 OK` 的那个填回 hosts。
> 改 hosts 会留下备份 `hosts.bak-dsh-<时间戳>`，随时可还原。

**1. hosts 被 Steam++（Watt Toolkit）接管。** 文件里有它自己的管理标记：

```
# Steam++ Start
127.0.0.1 github.com
127.0.0.1 api.github.com
…（含 Steam / HuggingFace / NexusMods 全套）
# Steam++ End
```

这是它的加速机制：把域名指向本机，再由它自己的服务转发到真实服务器。
`127.0.0.1:443` 确实由 `Steam++.Accelerator` 在监听。

### 实测结论：GitHub 可达，问题不在网络

早先我把这里判成「转发链断了」（观察到 502）——**那是我探测方式的产物，结论是错的**。
后续实测表明这条链是能工作的。

**绕开 hosts 直连真实 IP**（`curl --resolve`），三项全过：

| 目标 | 结果 |
| --- | --- |
| `github.com` | HTTP 200（0.50s） |
| `api.github.com` | HTTP 200（0.17s） |
| `raw.githubusercontent.com` | HTTP 301（0.23s） |

真实 IP 由 `dns.resolve4` 取得——它直接查 DNS，**不读 hosts**，这是与 `dns.lookup` 的关键区别：

```
dns.resolve4('github.com') -> 20.205.243.166    ✓ 真实 IP
dns.lookup('github.com')   -> 127.0.0.1         ✗ 被 hosts 劫持
```

**`git` 也能用**：`git clone --depth 1` 实测成功，拉到 `dcdc99e`，`data/plugins/` 条目齐全。

真正要处理的只是 schannel 的两层错误，**都不是网络问题**：

| 层 | 报错 | 处理 |
| --- | --- | --- |
| 沙箱限制（已放开） | `AcquireCredentialsHandle failed: SEC_E_NO_CREDENTIALS` | 文件策略改为 danger-full-access 后自行消失 |
| 证书吊销检查 | `CRYPT_E_NO_REVOCATION_CHECK` | `GIT_SSL_NO_VERIFY=1`，或 `git config http.schannelCheckRevoke false` |

> ⚠️ **`GIT_SSL_NO_VERIFY=1` 会关闭证书校验**，无法防范中间人。在 hosts 仍被劫持、
> Steam++ 充当转发方的当下它能工作，但不该是长期状态。干净的解法仍然是删掉
> `# Steam++ Start` 到 `# Steam++ End` 之间那段——**需要管理员权限，而本会话进程
> 不是管理员，做不了，只能由你操作**。

**另一条不依赖 github 域名的读取途径**（本次取得收录规则用的就是它）：

```
https://cdn.jsdelivr.net/gh/awesome-dsh-plugin/awesome-dsh-plugin@main/contributing.md
```

排查用的小工具都留在 `_publish_refs/`：`netprobe.mjs`（可达性）、
`fetch_via_proxy.mjs`（经 Clash 隧道）、`fetch_mirror.mjs`（镜像读取）。

---

## 五、提交前自检清单

前七项跑 `npm run verify` 与 `npm test` 即可覆盖（CI 里也会跑）：

- [x] `dsh.bundle.patch` 指向的 `cordis.patch.yml` 存在，且 `insert` 行的 `name` 等于包名
- [x] `package.json` 声明了 `dsh.client.platform = "web"` 与 `inject` 列表
- [x] `exports` 暴露 `"./client"`，且该文件存在
- [x] `keywords` 含 `dsh-plugin`
- [x] 主机半可作为 ESM 加载，并导出 `name` / `apply` / `Config`
- [x] 客户端半在 14 种畸形会话快照下均不抛错
- [x] `peerDependencies` 用显式 `||` 分支覆盖 prerelease 元组
- [x] README 含中英双语说明 + 安装命令
- [x] 已在本机实际安装并确认面板渲染正常
- [ ] 仓库创建满 1 天、已加 `dsh-plugin` topic
- [ ] 推送远端、发布 npm（可选）、提交收录 PR
