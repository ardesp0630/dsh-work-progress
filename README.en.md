# dsh-work-progress

A persistent work-progress row for DeepSeek Harness, docked above the composer. Collapsed, it shows how far along the task list is, a progress bar, and **what the agent is doing right now**; expanded, it lists every task plus turns, steps, model/tool time, and context pressure.

## What it shows

| Situation | Collapsed row |
| --- | --- |
| Session running | pulsing dot + `进行中 · 2/5` + shimmering bar + **current action** (`正在读取文件`) |
| Running, no task list | `进行中` + indeterminate shimmer bar |
| Idle, list complete | `任务 5/5` + full green bar + `全部完成` |
| Idle, no list | renders nothing at all — takes no space |

The **current action** is read from the last chat node in the conversation flow: `正在生成回复` while the model streams, `正在执行命令` / `正在读取文件` / `正在搜索内容` while a tool runs. Tool names are localised to Chinese; unknown tools show their raw name.

Expanded, you also get: per-task status (`✓` done / `▸` in progress / `○` pending), run state, turns, steps, model time, tool time, and context usage percentage.

## Data source

The panel opens **no RPC of its own and never polls**. It subscribes directly to session projections that the host already computes and exposes over the wire:

- `todos` — the task list
- `sessionStats` — turns, steps, timings
- `contextPressure` — context usage
- the conversation snapshot's `chat.order` / `chat.nodes` / `running` — current activity and run state

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

## Relationship to the built-in task strip

DSH already ships a task strip (id `todo`, order 0) in `conversation.input.dock`. This plugin takes its own id `work-progress` at order 5, so it sits **beside** the shipped row rather than replacing it. To keep only one, change this plugin's id to `todo`.

## License

MIT
