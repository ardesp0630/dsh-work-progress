/**
 * 包完整性自检 —— 只依赖 node 内置模块，CI 与本地都能直接跑。
 *
 *   node scripts/verify.mjs
 *
 * 检查的是「这个包能不能被 dsh plugin add 正确装上」这件事本身：
 * bundle patch 指向的文件在不在、patch 行里的包名与 package.json 是否一致、
 * 客户端入口是否真的存在、所有 JS 能否通过语法编译。
 *
 * 它不启动 DSH，也不检查运行期行为 —— 那是真实会话才回答得了的问题。
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const passes = [];

function check(label, ok, detail = "") {
  if (ok) passes.push(label);
  else failures.push(detail === "" ? label : `${label} — ${detail}`);
}

function readJson(rel) {
  const abs = join(root, rel);
  if (!existsSync(abs)) return { error: `缺少文件 ${rel}` };
  try {
    return { value: JSON.parse(readFileSync(abs, "utf8")) };
  } catch (e) {
    return { error: `${rel} 不是合法 JSON: ${e.message}` };
  }
}

// ---- package.json ----------------------------------------------------------
const pkgResult = readJson("package.json");
if (pkgResult.error) {
  failures.push(pkgResult.error);
} else {
  const pkg = pkgResult.value;
  passes.push(`package.json 合法（${pkg.name}@${pkg.version}）`);

  // dsh.bundle.patch —— 市场收录的硬性条件，缺了就无法 dsh plugin add
  const patchRel = pkg.dsh?.bundle?.patch;
  check("声明了 dsh.bundle.patch", typeof patchRel === "string", "缺失：这是安装能力的来源，只声明 dsh.client 不足以安装");

  if (typeof patchRel === "string") {
    const patchAbs = join(root, patchRel);
    check(`patch 文件存在（${patchRel}）`, existsSync(patchAbs));

    if (existsSync(patchAbs)) {
      const text = readFileSync(patchAbs, "utf8");
      check("patch 含 insert 块", /^\s*-\s*insert:/m.test(text));
      // 形如 `      name: dsh-work-progress`
      const nameMatch = text.match(/^\s*name:\s*(\S+)\s*$/m);
      check(
        "patch 行的 name 与包名一致",
        nameMatch !== null && nameMatch[1] === pkg.name,
        nameMatch === null ? "patch 里找不到 name:" : `patch 是 ${nameMatch[1]}，包名是 ${pkg.name}`,
      );
    }
  }

  // 客户端半
  if (pkg.dsh?.client) {
    check("dsh.client.platform 为 web", pkg.dsh.client.platform === "web", `实际是 ${pkg.dsh.client.platform}`);
    const clientExport = pkg.exports?.["./client"];
    const clientRel = typeof clientExport === "string" ? clientExport : clientExport?.default;
    check("exports 暴露 ./client", typeof clientRel === "string");
    if (typeof clientRel === "string") {
      check(`客户端入口存在（${clientRel}）`, existsSync(join(root, clientRel)));
    }
  }

  // 主入口
  if (typeof pkg.main === "string") {
    check(`主入口存在（${pkg.main}）`, existsSync(join(root, pkg.main)));
  }

  check("声明了 license", typeof pkg.license === "string");
  check("声明了 dsh-plugin 关键词", Array.isArray(pkg.keywords) && pkg.keywords.includes("dsh-plugin"));
}

// ---- 必需文件 --------------------------------------------------------------
for (const f of ["LICENSE", "README.md"]) {
  check(`存在 ${f}`, existsSync(join(root, f)));
}

// ---- 主机半：作为真正的 ESM 加载一次 ---------------------------------------
// 它顶层无副作用（只定义 name / Config / apply），所以可以安全 import。
// 这样验证的是「node 能加载它 + 导出契约完整」，比单纯语法检查更强。
// （注意：不能用 vm.Script —— 那个按脚本解析，遇到 ESM 的 export 一律报错。）
const hostAbs = join(root, "lib/index.js");
if (existsSync(hostAbs)) {
  try {
    const mod = await import(pathToFileURL(hostAbs).href);
    passes.push("lib/index.js 可作为 ESM 加载");
    check("导出 name", typeof mod.name === "string" && mod.name !== "");
    check("导出 apply 函数", typeof mod.apply === "function");
    check("导出 Config", mod.Config !== undefined);
  } catch (e) {
    failures.push(`lib/index.js 加载失败: ${e.message}`);
  }
} else {
  failures.push("缺少 lib/index.js");
}

// ---- 客户端半：浏览器格式，只编译不执行 ------------------------------------
// 它一加载就调用 window.__ModuleLoader__，import 会立刻抛错，所以只做语法编译。
const clientAbs = join(root, "lib/client.js");
if (existsSync(clientAbs)) {
  try {
    new vm.Script(readFileSync(clientAbs, "utf8"), { filename: "lib/client.js" });
    passes.push("lib/client.js 语法通过");
  } catch (e) {
    failures.push(`lib/client.js 语法错误: ${e.message}`);
  }
} else {
  failures.push("缺少 lib/client.js");
}

// ---- 报告 ------------------------------------------------------------------
for (const p of passes) console.log(`  ok    ${p}`);
for (const f of failures) console.log(`  FAIL  ${f}`);
console.log("");
if (failures.length === 0) {
  console.log(`全部通过（${passes.length} 项）`);
  process.exit(0);
} else {
  console.log(`${failures.length} 项失败 / 共 ${passes.length + failures.length} 项`);
  process.exit(1);
}
