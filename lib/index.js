/**
 * dsh-work-progress — host half（主机侧）。
 *
 * 【中文】这是一个刻意保持无状态的主机半：面板要显示的一切——任务清单
 * （todos 投影）、会话统计（sessionStats）、上下文压力（contextPressure）
 * 以及会话运行状态——都是主机早已注册、并已通过 wire 对浏览器可见的内置投影。
 * 浏览器侧直接订阅它们，因此主机半不注册服务、不注册投影单元、不持有状态。
 *
 * (EN) A deliberately stateless host half. Everything the panel shows — the
 * task list (`todos`), session stats (`sessionStats`), context pressure
 * (`contextPressure`), and the session's running state — is already a shipped,
 * wire-visible session projection. The client subscribes to them directly, so
 * this half registers no service, no projection unit, and no state.
 *
 * 它的存在只有一个理由：bundle 的 cordis.patch.yml 需要一行可挂载的主机行，
 * 挂载成功后该 bundle 的客户端半才会被装载到浏览器。
 *
 * (EN) Its only reason to exist: the bundle's `cordis.patch.yml` needs one
 * mountable host row, and a bundle's client half is only shipped to the browser
 * once that row mounts.
 */

/** Cordis 插件名（与 bundle patch 行中的 id 区分）。(EN) Cordis plugin name. */
const name = "work-progress";

/**
 * 【中文】没有配置项，因此本行不导出 `Config`：Loader 不会对一行没有 config
 * 的条目做 schema 校验，而伪造一个 `~standard` 对象只会让配置检查把它标成
 * `unsupported`（其它无配置插件显示的是 `absent`）。
 *
 * (EN) No config, so this row exports no `Config`: the Loader validates no schema
 * for an entry that carries no config, and a hand-rolled `~standard` object only
 * makes the Config inspection report `unsupported` (config-less plugins report
 * `absent`).
 */

/**
 * 【中文】不产生任何副作用：数据面完全在客户端。
 * (EN) Contributes nothing: the entire data path lives on the client.
 */
function apply(ctx) {
  void ctx;
}

export { apply, name };
