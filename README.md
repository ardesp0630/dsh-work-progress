# dsh-work-progress

在输入框上方常驻一行**工作进度**的 DSH 插件：折叠态显示任务完成度、进度条与当前进行中的任务；展开态显示完整任务清单，以及轮次、步骤、模型/工具耗时与上下文占用。

## 它显示什么

| 情形 | 折叠行 |
| --- | --- |
| 会话正在运行 | 脉动圆点 + `进行中 · 2/5` + 流光进度条 + 当前任务名 |
| 运行中但无任务清单 | `进行中` + 不确定推进的流光条 |
| 空闲且清单完成 | `任务 5/5` + 满格绿条 + `全部完成` |
| 无清单且空闲 | 整块不渲染，不占位 |

展开后额外显示：每条任务的状态（`✓` 完成 / `▸` 进行中 / `○` 待办）、运行状态、轮次、步骤、模型耗时、工具耗时、上下文占用百分比。

## 数据来源

面板**不建立自己的 RPC，也不轮询**。它直接订阅主机已内置、并已通过 wire 对浏览器可见的会话投影：

- `todos` — 任务清单
- `sessionStats` — 轮次、步骤、耗时
- `contextPressure` — 上下文占用
- 会话快照的 `running` — 运行状态

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

## 与内置任务条的关系

DSH 自带一条任务条（`conversation.input.dock` 中 id 为 `todo`、order 0）。本插件使用自己的 id `work-progress`、order 5，**与内置条目并排共存，不替换任何内置 UI**。若只想保留一个，把本插件的 id 改成 `todo` 即可顶替内置条目。

## 许可

MIT
