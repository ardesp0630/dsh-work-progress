# dsh-work-progress

在输入框卡片**下方**常驻一行**工作进度**的 DSH 插件：折叠态显示任务完成度、进度条与此刻正在做什么；展开态显示完整任务清单，以及轮次、步骤、模型/工具耗时与上下文占用。

> 适配 **DSH 0.1.x 与 0.2.x**（在 0.2.1-rc.2 上验证）。

## 它显示什么

| 情形 | 折叠行 |
| --- | --- |
| 会话正在运行 | 脉动圆点 + `进行中 · 2/5` + 流光进度条 + 此刻的动作 |
| 运行中但无任务清单 | `进行中 · 无任务清单` + 不确定推进的流光条 |
| 空闲且清单完成 | `任务 5/5` + 满格绿条 + `全部完成` |
| 无清单且空闲 | 整块不渲染，不占位 |

展开后额外显示：每条任务的状态（`✓` 完成 / `▸` 进行中 / `○` 待办）、运行状态、轮次、步骤、模型耗时、工具耗时、上下文占用百分比。

## 数据来源

面板**不建立自己的 RPC，也不轮询**。它全部经由插槽标准属性，直接订阅主机已内置、并已通过 wire 对浏览器可见的会话投影：

- `useProjection("todos")` — 任务清单
- `useProjection("sessionStats")` — 轮次、步骤、耗时
- `useProjection("contextPressure")` — 上下文占用
- `useSession((s) => s.running)` — 运行状态
- `useChat((s) => s.order / s.nodes)` — 会话流最后一个节点，翻译成「正在生成回复 / 正在执行命令」等

因此数据始终与宿主同步，且主机半是无状态的（见 `lib/index.js` 的说明）。

## 安装

```powershell
# 1. 把本目录放到 DSH 的 plugins 目录
$dsh = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE ".dsh" }
Copy-Item . (Join-Path $dsh "plugins\dsh-work-progress") -Recurse -Force
```

然后把它登记进你的 profile（以 `desktop` 为例）——在 `%DSH_HOME%\profiles\desktop\package.json` 中：

```jsonc
{
  "dependencies": {
    "dsh-work-progress": "link:C:/Users/ardesp0630/.dsh/plugins/dsh-work-progress"
  },
  "dsh": {
    "profile": {
      "bundles": [
        // ...已有的 bundles...
        "dsh-work-progress"
      ]
    }
  }
}
```

最后在 profile 目录执行 `pnpm install`，重启 DSH 并刷新浏览器。

> 也可以用官方 CLI：`dsh plugin --profile desktop add <路径或包名>`，它会替你完成登记。

## 卸载

从 `dsh.profile.bundles` 数组里移除 `dsh-work-progress`，删除 `dependencies` 中的对应项，重新 `pnpm install` 并重启。

## 与内置条目的关系

`conversation.composer.dock` 里内置了两条：`activity`（order 0，轮次/速度）与 `usage`（order 1，token 用量）。本插件使用自己的 id `work-progress`、order 10，排在它们**之后**，**不替换任何内置 UI**。若想顶替某条内置行，把本插件的 `id` 改成那条的 id 即可。

## 升级到 0.2.x 时踩过的两个坑

1. **peer 范围止步于 `<0.2.0-0`**：0.2.x 的加载器会判 `incompatible-version` 并**丢弃整个 bundle 的行**，表现为插件在列表里「已启用」但界面上什么都没有。范围要覆盖 `>=0.1.0-rc.1 <0.3.0-0`。
2. **`lib/client.js` 的语法必须真的过一遍**：浏览器半解析失败时不会报在界面上，只是静默地不注册任何插槽条目。改完请先跑 `npm run verify`。

## 许可

MIT
