# Changelog

## 0.2.0

适配 DSH 0.2.x（在 0.2.1-rc.2 上实测通过）。

### 修复

- **`peerDependencies` 的 DSH 范围止步于 `<0.2.0-0`**，0.2.x 加载器据此判定
  `incompatible-version`，并把整个 bundle 的行全部丢弃 —— 表现是插件在列表里
  「已启用」，但 Host 行没有挂载，界面里什么都没有。范围改为
  `>=0.1.0-rc.1 <0.3.0-0`，并补上 `engines.dsh` 显式声明支持区间。
- **`dsh.client.inject` 里列了 0.2.x 已不存在的包**
  （`@deepseek-ai/dsh-client-runtime`、`@deepseek-ai/dsh-client-ui-slots`，
  slot 与运行时现在由 `dsh-client-ui-renderer` / `dsh-client-ui-conversation` 提供），
  改为只列 `@deepseek-ai/dsh-client-ui-conversation`。

### 变更

- 「此刻正在做什么」改从插槽标准属性 **`useChat`**（`order` + `nodes`）读取。
  1.x 里从 `useSession` 快照读 `chat` 的写法在 0.2.x 取不到值，会让运行中那一行
  一直缺「正在…」文案；`running` 仍然取自 `useSession`。插槽不提供 `useChat` 时
  自动降级，不会抛错。
- 主机半不再导出伪 `Config`（那个 `~standard` 对象会被配置检查标成 `unsupported`）；
  本插件本来就没有配置项，现在与其它无配置插件一致显示 `absent`。
- `npm test` 改用 `node --test "test/**/*.test.mjs"`：Node 24 不再把 `test/`
  这样的目录参数当作测试发现路径，原写法会直接报 `MODULE_NOT_FOUND`。
- 测试与自检同步更新：畸形快照用例改为针对聊天快照（`order` / `nodes`）的形状，
  并新增「插槽不提供 useChat 也不能崩」的用例。

### 兼容性

- 槽位注册参数（`id` / `order`）、`ctx.slots.inject` 用法未变。
- 三个投影键 `todos` / `sessionStats` / `contextPressure` 在 0.2.1 仍然存在；
  投影缺席时 `useProjection` 返回 `undefined`，面板退化为「无任务清单」而不是整块消失。

## 0.1.1

### 变更

- **位置调整**：从输入框**上方**的 dock 移到输入框**下方**的带区
  （`conversation.input.dock` order 5 → `conversation.composer.dock` order 10）。
  上方那条已有 6 个内置占位者（任务条、目标条、队列、时间线…），下方只有内置统计行，更清爽。
  样式随之收紧以适配更窄的带区（间距 8→6px、内边距 2×4→1×2px、行高 1.5→1.4）。

### 修复

- 运行中但没有任务清单时，文案由光秃秃的「进行中」改为 **「进行中 · 无任务清单」**。
  用户两次把前者误读为功能故障——这一行是运行期唯一的视觉线索，必须自己说明白。
  已加测试锁住该文案。

## 0.1.0

首个版本。

### 功能

- 输入框上方的常驻工作进度行（`conversation.input.dock`，order 5，与内置任务条并排）
- 折叠态：完成计数、进度条、**当前正在做什么**
- 展开态：完整任务清单（✓ / ▸ / ○ 三态）、运行状态、轮次、步骤、模型耗时、工具耗时、上下文占用百分比
- 当前动作跟随会话流最后一个节点变化：`正在生成回复` / `正在执行命令` / `正在读取文件` 等，工具名做了中文化

### 实现要点

- 数据来自主机已内置并已 wire 的会话投影：`todos`、`sessionStats`、`contextPressure`，
  以及会话快照的 `chat.order` / `chat.nodes` / `running`
- 无自建 RPC、无轮询；主机半是无状态的，不注册服务也不注册投影单元
- 面板不替换任何内置 UI；id 与内置任务条不同，二者共存
