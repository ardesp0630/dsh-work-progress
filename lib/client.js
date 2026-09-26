/**
 * dsh-work-progress — web client half（浏览器侧）。
 *
 * 【中文】在输入框上方的 `conversation.input.dock` 插槽里常驻一行工作进度：
 * 折叠态显示完成计数、进度条与当前进行中的任务；展开态显示完整任务清单，
 * 以及轮次、步骤、模型耗时、工具耗时与上下文占用。
 *
 * (EN) A persistent work-progress row in the `conversation.input.dock` slot
 * above the composer: collapsed it shows the completion count, a progress bar,
 * and the task currently in progress; expanded it lists every task plus turns,
 * steps, model/tool time, and context pressure.
 *
 * 【中文】数据全部来自主机已内置并已 wire 的会话投影，通过插槽标准属性
 * `useProjection` 订阅、`useSession` 读取运行状态——没有自建 RPC，
 * 因此不存在轮询与陈旧数据。
 *
 * (EN) All data comes from shipped, wire-visible session projections, subscribed
 * through the slot's standard `useProjection` prop and read for running state
 * through `useSession` — no bespoke RPC, so no polling and no stale reads.
 */

window.__ModuleLoader__.load({
  id: "dsh-work-progress",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const react = require("react");

    //#region styles（样式：全部走主题 token，明暗主题自动跟随）
    const css =
      ".dshwp_root{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary);width:100%;}" +
      ".dshwp_row{display:flex;align-items:center;gap:8px;width:100%;background:transparent;border:0;padding:2px 4px;border-radius:5px;color:inherit;font:inherit;cursor:pointer;text-align:left;}" +
      ".dshwp_row:hover{background:var(--dsw-alias-bg-layer-2);}" +
      ".dshwp_caret{flex:0 0 10px;width:10px;opacity:.7;}" +
      ".dshwp_lead{color:var(--dsw-alias-brand-primary);}" +
      ".dshwp_dot{flex:0 0 6px;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-brand-primary);animation:dshwp_pulse 1.2s ease-in-out infinite;}" +
      ".dshwp_count{white-space:nowrap;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums;}" +
      ".dshwp_track{flex:1 1 auto;min-width:48px;height:4px;border-radius:2px;background:var(--dsw-alias-bg-layer-2);overflow:hidden;}" +
      ".dshwp_fill{display:block;height:100%;background:var(--dsw-alias-brand-primary);transition:width .2s ease;}" +
      ".dshwp_fill_done{background:var(--dsw-alias-state-success-primary);}" +
      ".dshwp_fill_run{background-image:linear-gradient(90deg,rgba(255,255,255,0) 0,rgba(255,255,255,.5) 50%,rgba(255,255,255,0) 100%);background-size:40px 100%;animation:dshwp_flow .9s linear infinite;}" +
      "@keyframes dshwp_pulse{0%,100%{opacity:.3}50%{opacity:1}}" +
      "@keyframes dshwp_flow{0%{background-position:-40px 0}100%{background-position:40px 0}}" +
      ".dshwp_current{flex:0 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:46%;}" +
      ".dshwp_panel{margin:6px 0 2px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-layer-1);display:flex;flex-direction:column;gap:4px;}" +
      ".dshwp_item{display:flex;gap:6px;align-items:flex-start;}" +
      ".dshwp_icon{flex:0 0 12px;width:12px;text-align:center;}" +
      ".dshwp_i_done{color:var(--dsw-alias-state-success-primary);}" +
      ".dshwp_i_active{color:var(--dsw-alias-brand-primary);}" +
      ".dshwp_i_pending{opacity:.55;}" +
      ".dshwp_t_done{text-decoration:line-through;opacity:.75;}" +
      ".dshwp_t_active{color:var(--dsw-alias-label-primary);font-weight:600;}" +
      ".dshwp_footer{margin-top:4px;padding-top:6px;border-top:1px solid var(--dsw-alias-border-l1);display:flex;flex-wrap:wrap;gap:4px 12px;}" +
      ".dshwp_stat{white-space:nowrap;}" +
      ".dshwp_stat b{color:var(--dsw-alias-label-primary);font-weight:600;font-variant-numeric:tabular-nums;}";

    const tagId = "dsh-work-progress/styles.module.css";
    if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
      const tag = document.createElement("style");
      tag.setAttribute("data-plugin-css", tagId);
      tag.textContent = css;
      document.head.appendChild(tag);
    }
    //#endregion

    //#region helpers
    /**
     * 【中文】投影视图可能是裸数组，也可能包在 { todos: [...] } 里，
     * 两种形状都接受，避免上游形状微调就让面板整块消失。
     * (EN) The projection view may be a bare array or wrapped in
     * `{ todos: [...] }`; accept both so an upstream shape tweak cannot blank
     * the panel.
     */
    function normalizeTodos(raw) {
      if (Array.isArray(raw)) return raw;
      if (raw !== null && typeof raw === "object" && Array.isArray(raw.todos)) return raw.todos;
      return [];
    }

    function seconds(ms) {
      if (typeof ms !== "number" || !isFinite(ms)) return null;
      return (ms / 1000).toFixed(1) + "s";
    }

    function stat(key, label, value) {
      return react.createElement("span", { key: key, className: "dshwp_stat" }, label, react.createElement("b", null, value));
    }

    /** 【中文】工具名的中文说法；未收录的显示原名。 (EN) Chinese wording for tool names; unknown ones show raw. */
    const TOOL_LABELS = {
      read: "读取文件",
      write: "写入文件",
      edit: "编辑文件",
      glob: "查找文件",
      grep: "搜索内容",
      pwsh: "执行命令",
      bash: "执行命令",
      todo_write: "更新任务清单",
      skill: "加载技能",
      web_search: "联网搜索",
      ask_user_question: "等待你的选择",
      subagent: "派发子代理",
      subagent_fork: "派发子代理",
      send_message: "通知子代理",
      interrupt_agent: "中断子代理",
      list_agents: "查看子代理",
      job_list: "查看后台作业",
      job_output: "读取作业输出",
      job_kill: "终止后台作业",
      workflow: "运行工作流",
      ralph: "运行迭代循环",
      create_goal: "创建目标",
      update_goal: "更新目标",
      get_goal: "读取目标",
      cordis_define: "定义插件",
      cordis_run: "运行插件",
      cordis_stop: "停止插件",
      cordis_undefine: "移除插件",
      xlsx_read: "读取表格",
      xlsx_write: "写入表格",
      docx_create: "生成 Word",
      pptx_create: "生成 PPT",
      pdf_create: "生成 PDF",
    };

    function toolLabel(name) {
      if (typeof name !== "string" || name === "") return "";
      return TOOL_LABELS[name] !== undefined ? TOOL_LABELS[name] : name;
    }

    /**
     * 【中文】把会话流最后一个节点翻译成一句“现在在干什么”。只读节点上的
     * 标量字段（kind、data.root.name、data.root.call.name），并返回字符串——
     * 这样 useSession 的选择器能用引用比较稳定判断，不会造成重渲染循环。
     * (EN) Turn the last chat node into one line of "what is happening now".
     * Reads only scalar fields and returns a string, so the useSession selector
     * compares stably instead of looping on a fresh object each render.
     */
    function describeActivity(node) {
      if (node === null || typeof node !== "object") return "";
      const kind = typeof node.kind === "string" ? node.kind : "";

      if (kind === "tool-call") {
        const data = node.data;
        const root = data !== null && typeof data === "object" ? data.root : null;
        if (root !== null && typeof root === "object") {
          // 运行中的调用直接带 name；已结算的包在 call 里。
          if (typeof root.name === "string" && root.name !== "") return "正在" + toolLabel(root.name);
          const call = root.call;
          if (call !== null && typeof call === "object" && typeof call.name === "string" && call.name !== "") {
            return "已完成" + toolLabel(call.name);
          }
        }
        return "正在进行工具调用";
      }

      if (kind === "assistant-step") return "正在生成回复";
      if (kind === "user") return "等待你的输入";
      if (kind === "steering") return "正在处理你的补充说明";
      if (kind === "compaction" || kind === "manual-compaction") return "正在压缩上下文";
      if (kind === "context") return "正在整理上下文";
      if (kind === "model-retry") return "正在重试模型请求";
      if (kind === "turn-error") return "本轮遇到错误";
      if (kind === "workflow-run") return "正在运行工作流";
      if (kind === "command" || kind === "command-input") return "正在执行命令";
      return "";
    }
    //#endregion

    //#region component
    function WorkProgressDock(props) {
      const todosRaw = props.useProjection("todos");
      const statsRaw = props.useProjection("sessionStats");
      const pressureRaw = props.useProjection("contextPressure");
      const running = props.useSession((s) => s !== null && typeof s === "object" && s.running === true);
      // 【中文】会话流最后一个节点 = 此刻正在做的事。选择器返回字符串，
      // 引用稳定，不会引起重渲染循环。
      //
      // 两个选择器都做了形状防御：它们跑在 render 阶段，一旦在里面抛出
      // TypeError，坏掉的是整个 dock 区域而不只是这一个面板。快照的顶层
      // 字段（chat / nodes 的形态）并不属于 slot 的契约，值得多一层检查。
      //
      // (EN) The last chat node is what is happening right now. The selector
      // returns a string, so it stays referentially stable. Both selectors
      // guard their own shape: they run during render, and a TypeError thrown
      // here takes down the whole dock rather than just this panel. Snapshot
      // fields like `chat` / `nodes` are not part of the slot contract.
      const activity = props.useSession((s) => {
        if (s === null || typeof s !== "object") return "";
        const chat = s.chat;
        if (chat === null || typeof chat !== "object") return "";
        const order = chat.order;
        if (!Array.isArray(order) || order.length === 0) return "";
        const nodes = chat.nodes;
        if (nodes === null || typeof nodes !== "object" || typeof nodes.get !== "function") return "";
        return describeActivity(nodes.get(order[order.length - 1]));
      });

      const openState = react.useState(false);
      const open = openState[0];
      const setOpen = openState[1];

      const todos = normalizeTodos(todosRaw);
      const stats = statsRaw !== null && typeof statsRaw === "object" ? statsRaw : null;
      const pressure = pressureRaw !== null && typeof pressureRaw === "object" ? pressureRaw : null;
      const total = todos.length;

      // 【中文】没有清单也不在运行时整块不渲染，不占位。
      // (EN) Nothing to show: render nothing rather than an empty row.
      if (total === 0 && !running) return null;

      let done = 0;
      let current = "";
      for (let i = 0; i < todos.length; i++) {
        const item = todos[i];
        if (item === null || typeof item !== "object") continue;
        if (item.status === "completed") done++;
        else if (item.status === "in_progress" && current === "") current = typeof item.content === "string" ? item.content : "";
      }
      const percent = total === 0 ? 0 : Math.round((done / total) * 100);

      let countText;
      if (running) countText = total > 0 ? "进行中 · " + done + "/" + total : "进行中";
      else countText = total > 0 ? "任务 " + done + "/" + total : "无任务清单";

      const row = [
        react.createElement("span", { key: "caret", className: "dshwp_caret" }, open ? "\u25BE" : "\u25B8"),
        react.createElement("span", { key: "lead", className: "dshwp_lead" }, "\u25A4")
      ];
      if (running) row.push(react.createElement("span", { key: "dot", className: "dshwp_dot" }));
      row.push(react.createElement("span", { key: "count", className: "dshwp_count" }, countText));

      if (total > 0 || running) {
        let inner;
        if (total > 0) {
          const fill = (percent === 100 && !running ? "dshwp_fill dshwp_fill_done" : "dshwp_fill") + (running ? " dshwp_fill_run" : "");
          inner = react.createElement("span", { className: fill, style: { width: percent + "%" } });
        } else {
          inner = react.createElement("span", { className: "dshwp_fill dshwp_fill_run", style: { width: "30%" } });
        }
        row.push(react.createElement("span", { key: "track", className: "dshwp_track" }, inner));
      }

      // 【中文】运行中优先显示“正在干什么”，这是最想知道的；空闲时回落到
      // 当前任务名或完成状态。
      // (EN) While running, show what is happening now; when idle, fall back to
      // the current task name or the completion state.
      let info = "";
      if (running) info = activity !== "" ? activity : current;
      else if (current !== "") info = current;
      else if (total > 0 && done === total) info = "全部完成";
      if (info !== "") {
        row.push(react.createElement("span", { key: "now", className: "dshwp_current" }, info));
      }

      const children = [
        react.createElement("button", {
          key: "row",
          type: "button",
          className: "dshwp_row",
          onClick: () => setOpen(!open)
        }, row)
      ];

      if (open) {
        const panel = [];

        for (let i = 0; i < todos.length; i++) {
          const item = todos[i];
          const status = item !== null && typeof item === "object" && typeof item.status === "string" ? item.status : "pending";
          const glyph = status === "completed" ? "\u2713" : status === "in_progress" ? "\u25B8" : "\u25CB";
          const iconClass = status === "completed" ? "dshwp_i_done" : status === "in_progress" ? "dshwp_i_active" : "dshwp_i_pending";
          const textClass = status === "in_progress" ? "dshwp_t_active" : status === "completed" ? "dshwp_t_done" : "";
          const text = item !== null && typeof item === "object" && typeof item.content === "string" ? item.content : "";
          panel.push(react.createElement("div", { key: "todo-" + i, className: "dshwp_item" }, [
            react.createElement("span", { key: "i", className: "dshwp_icon " + iconClass }, glyph),
            react.createElement("span", { key: "x", className: textClass }, text)
          ]));
        }

        const footer = [];
        if (running) footer.push(stat("state", "状态 ", "运行中"));
        else if (total > 0) footer.push(stat("state", "状态 ", "空闲"));
        if (stats !== null && typeof stats.turns === "number") footer.push(stat("turns", "轮次 ", String(stats.turns)));
        if (stats !== null && typeof stats.steps === "number") footer.push(stat("steps", "步骤 ", String(stats.steps)));
        const llm = stats !== null ? seconds(stats.llmMs) : null;
        if (llm !== null) footer.push(stat("llm", "模型 ", llm));
        const tool = stats !== null ? seconds(stats.toolMs) : null;
        if (tool !== null) footer.push(stat("tool", "工具 ", tool));
        if (pressure !== null && typeof pressure.pressureTokens === "number" && typeof pressure.contextWindow === "number" && pressure.contextWindow > 0) {
          const used = Math.round((pressure.pressureTokens / pressure.contextWindow) * 1000) / 10;
          footer.push(stat("ctx", "上下文 ", used + "%"));
        }

        if (footer.length > 0) panel.push(react.createElement("div", { key: "footer", className: "dshwp_footer" }, footer));

        children.push(react.createElement("div", { key: "panel", className: "dshwp_panel" }, panel));
      }

      return react.createElement("div", { className: "dshwp_root" }, children);
    }
    //#endregion

    //#region plugin body
    /** 本插件在客户端依赖的服务。 (EN) Client services this plugin depends on. */
    const inject = ["slots", "sessions", "locale"];

    function apply(ctx) {
      // 【中文】挂进输入框上方的 dock；order 5 让它贴在内置任务条（order 0）
      // 之后、目标条（order 10）之前，不与任何内置条目争用同一个 id。
      // (EN) Take a seat in the dock above the composer. order 5 places it right
      // after the shipped todo strip (order 0) and before the goal bar (order
      // 10); the id is ours, so no shipped entry is replaced.
      ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
        name: "conversation.input.dock",
        id: "work-progress",
        order: 5
      }, WorkProgressDock));
    }
    //#endregion

    exports.WorkProgressDock = WorkProgressDock;
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
