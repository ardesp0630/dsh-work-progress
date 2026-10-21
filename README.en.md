# dsh-work-progress

A persistent work-progress row for DeepSeek Harness, docked **below** the composer card. Collapsed, it shows how far along the task list is, a progress bar, and **what the agent is doing right now**; expanded, it lists every task plus turns, steps, model/tool time, and context pressure.

> Supports **DSH 0.1.x and 0.2.x** (verified on 0.2.1-rc.2).

## What it shows

| Situation | Collapsed row |
| --- | --- |
| Session running | pulsing dot + `进行中 · 2/5` + shimmering bar + **current action** (`正在读取文件`) |
| Running, no task list | `进行中 · 无任务清单` + indeterminate shimmer bar |
| Idle, list complete | `任务 5/5` + full green bar + `全部完成` |
| Idle, no list | renders nothing at all — takes no space |

The **current action** is read from the last chat node in the conversation flow (`useChat`'s `order` + `nodes`): `正在生成回复` while the model streams, `正在执行命令` / `正在读取文件` / `正在搜索内容` while a tool runs. Tool names are localised to Chinese; unknown tools show their raw name.

Expanded, you also get: per-task status (`✓` done / `▸` in progress / `○` pending), run state, turns, steps, model time, tool time, and context usage percentage.

## Data source

The panel opens **no RPC of its own and never polls**. Through the slot's standard props it subscribes directly to what the host already computes and exposes over the wire:

- `useProjection("todos")` — the task list
- `useProjection("sessionStats")` — turns, steps, timings
- `useProjection("contextPressure")` — context usage
- `useSession((s) => s.running)` — run state
- `useChat((s) => s.order / s.nodes)` — current activity

That keeps it in lockstep with the host, and makes the host half stateless (see `lib/index.js`).

## Install

```sh
# from npm (prebuilt)
dsh plugin --profile web add dsh-work-progress

# or from source
dsh plugin --profile web add github:ardesp0630/dsh-work-progress
```

Then restart DSH and refresh the browser.

## Uninstall

Remove `dsh-work-progress` from the `dsh.profile.bundles` array and from `dependencies` in your profile's `package.json`, run `pnpm install`, and restart.

## Relationship to the built-in rows

`conversation.composer.dock` ships two rows: `activity` (order 0, turns/speed) and `usage` (order 1, token usage). This plugin takes its own id `work-progress` at order 10, so it sits **after** them rather than replacing anything. To replace one, change this plugin's id to that row's id.

## Two traps when moving to 0.2.x

1. **A peer range capped at `<0.2.0-0`** makes the 0.2.x loader report `incompatible-version` and **drop every row of the bundle** — the plugin still looks "enabled" while nothing appears in the UI. The range must cover `>=0.1.0-rc.1 <0.3.0-0`.
2. **A syntax error in `lib/client.js` fails silently**: the browser half simply registers nothing, with no error in the UI. Run `npm run verify` after editing it.

## License

MIT
