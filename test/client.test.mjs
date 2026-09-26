/**
 * 客户端半的健壮性测试 —— 用 node 内置 test runner，无第三方依赖。
 *
 *   node --test test/
 *
 * 为什么要测这个：组件的 useSession 选择器跑在 React 的 render 阶段。
 * 一旦选择器里抛出 TypeError，坏掉的不是这一个面板，而是整个 dock 区域
 * （React 会把该子树整个卸载）。会话快照的顶层字段形态并不属于 slot 的
 * 契约，所以它们必须被防御，而且这种防御必须被证明有效。
 *
 * 做法是加载真实的 lib/client.js：在 vm 里 mock 掉 window.__ModuleLoader__
 * 捕获插件定义，再用 mock 的 react 取出注册到插槽的那个组件，喂各种畸形
 * 快照，断言它一律不抛错。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** 执行真实的 client.js，取出它导出的插件（apply / inject）。 */
function loadPlugin() {
  let captured = null;
  const sandbox = {
    window: { __ModuleLoader__: { load: (definition) => { captured = definition; } } },
    document: undefined,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(root, "lib/client.js"), "utf8"), sandbox, {
    filename: "lib/client.js",
  });

  assert.ok(captured, "客户端半没有调用 window.__ModuleLoader__.load");
  assert.equal(captured.id, "dsh-work-progress", "模块 id 与包名不一致");

  const reactMock = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}],
    useEffect: () => {},
  };

  return captured.factory((name) => {
    if (name === "react") return reactMock;
    throw new Error(`客户端半 require 了未预期的模块: ${name}`);
  });
}

/**
 * 造一个 mock 的 Cordis ctx。
 *
 * 注意：插件在 `inject: ["slots", ...]` 里声明了依赖，因此源码用的是
 * `ctx.slots` 属性访问（合法且推荐），而不是 `ctx.get("slots")`。
 * mock 必须提供 `slots` 属性，只给 get() 会让 apply 在第一步就抛错。
 */
function makeCtx(onRegister) {
  const slots = {
    inject: (_slotKey, callback) => callback(),
    register: (options, component) => {
      onRegister(options, component);
      return () => {};
    },
  };
  return {
    slots,
    get: (name) => (name === "slots" ? slots : undefined),
    effect: (fn) => fn(),
  };
}

/** 把组件注册到 mock 插槽上并渲染一次，返回它。 */
function renderWith(moduleExports, snapshot, projections = {}) {
  let component = null;
  moduleExports.apply(makeCtx((_options, registered) => { component = registered; }));
  assert.ok(component, "组件没有注册到 conversation.input.dock");

  return component({
    useProjection: (key) => projections[key],
    useSession: (selector) => selector(snapshot),
  });
}

test("插槽注册的 id 与 order 符合设计", () => {
  let options = null;
  const moduleExports = loadPlugin();
  moduleExports.apply(makeCtx((registeredOptions) => { options = registeredOptions; }));

  assert.equal(options.name, "conversation.input.dock");
  assert.equal(options.id, "work-progress", "必须用自己的 id，否则会顶掉内置任务条");
  assert.equal(options.order, 5);
});

test("畸形会话快照一律不抛错（选择器必须在 render 阶段保持沉默）", () => {
  const moduleExports = loadPlugin();

  const snapshots = [
    ["snapshot 为 null", null],
    ["snapshot 非对象", "nonsense"],
    ["chat 缺失", { running: true }],
    ["chat 为 null", { running: true, chat: null }],
    ["order 非数组", { running: true, chat: { order: "x" } }],
    ["order 为空数组", { running: true, chat: { order: [] } }],
    ["nodes 缺失", { running: true, chat: { order: ["k"] } }],
    ["nodes 为 null", { running: true, chat: { order: ["k"], nodes: null } }],
    ["nodes 没有 get 方法", { running: true, chat: { order: ["k"], nodes: {} } }],
    ["节点为 null", { running: true, chat: { order: ["k"], nodes: new Map([["k", null]]) } }],
    ["节点缺 kind", { running: true, chat: { order: ["k"], nodes: new Map([["k", {}]]) } }],
    ["tool-call 但 data 非法", { running: true, chat: { order: ["k"], nodes: new Map([["k", { kind: "tool-call", data: null }]]) } }],
    ["tool-call 但 root 非法", { running: true, chat: { order: ["k"], nodes: new Map([["k", { kind: "tool-call", data: { root: 42 } }]]) } }],
    ["running 非布尔", { running: "yes", chat: {} }],
  ];

  for (const [label, snapshot] of snapshots) {
    assert.doesNotThrow(
      () => renderWith(moduleExports, snapshot),
      `快照形态「${label}」让组件抛错了`,
    );
  }
});

test("正常快照能读出当前动作", () => {
  const moduleExports = loadPlugin();
  const node = { kind: "tool-call", data: { root: { name: "pwsh" } } };
  const snapshot = {
    running: true,
    chat: { order: ["a"], nodes: new Map([["a", node]]) },
  };

  const tree = renderWith(moduleExports, snapshot);
  assert.ok(tree, "有 running 时应当渲染而不是返回 null");

  // 组件是嵌套结构，直接把整棵树序列化出来找那句活动文案。
  const text = JSON.stringify(tree);
  assert.ok(
    text.includes("正在执行命令"),
    `期望渲染出「正在执行命令」，实际树为 ${text.slice(0, 400)}`,
  );
});

test("没有任务清单且不在运行时整块不渲染", () => {
  const moduleExports = loadPlugin();
  const tree = renderWith(moduleExports, { running: false, chat: {} }, { todos: null });
  assert.equal(tree, null, "无内容时应当返回 null，不占位");
});

test("任务清单正常时显示完成计数", () => {
  const moduleExports = loadPlugin();
  const tree = renderWith(
    moduleExports,
    { running: false, chat: {} },
    {
      todos: [
        { content: "甲", status: "completed" },
        { content: "乙", status: "in_progress" },
        { content: "丙", status: "pending" },
      ],
    },
  );
  const text = JSON.stringify(tree);
  assert.ok(text.includes("任务 1/3"), `期望「任务 1/3」，实际为 ${text.slice(0, 400)}`);
});
