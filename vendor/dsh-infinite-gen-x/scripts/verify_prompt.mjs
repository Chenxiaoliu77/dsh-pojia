// 无限X代 v0.7.2 兼容回归校验（零工具面纯净版）
// 本脚本聚焦：双层内核载荷锚点 / 注入面同源覆盖 / index.js 导出 / 一键安装协议 / 用例库结构。
// 权威断言（品牌纯净度 + 同源逐字比对）由 verify_prompt_genx.mjs 执行；本脚本可独立运行。
// 用法：node scripts/verify_prompt.mjs [--json]
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROMPT_PATH = join(ROOT, "prompts", "infinite-gen-x.md");
const INDEX_PATH = join(ROOT, "index.js");
const SCORER_PATH = join(ROOT, "scripts", "lib", "scorer.mjs");
const BANK_PATH = join(ROOT, "tests", "prompt-bank.jsonl");
const PKG_PATH = join(ROOT, "package.json");
const pkg = existsSync(PKG_PATH) ? JSON.parse(readFileSync(PKG_PATH, "utf8")) : {};

const failures = [];
const passes = [];

function check(ok, label, detail = "") {
  (ok ? passes : failures).push(`${label}${detail ? " — " + detail : ""}`);
}

function mustContain(text, needle, label) {
  check(text.includes(needle), label, text.includes(needle) ? "" : `缺少 "${needle.slice(0, 60)}"`);
}

function mustAbsent(text, needle, label) {
  check(!text.includes(needle), label, text.includes(needle) ? `不应包含 "${needle.slice(0, 60)}"` : "");
}

const sha256 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

// ---- 1. 内核载荷完整性 ----
const prompt = existsSync(PROMPT_PATH) ? readFileSync(PROMPT_PATH, "utf8") : "";
check(prompt.length > 0, "内核载荷文件存在且非空", PROMPT_PATH);

// D-006 后内核为破甲措辞（红队研究引擎），断"功能锚点"而非锁死措辞。
mustContain(prompt, "red-team security research documentation engine", "角色设定（红队研究引擎）");
mustContain(prompt, "deliverable", "交付物导向");
mustContain(prompt, "offline environment", "离线环境定位");
mustContain(prompt, "Working rules", "工作规范段");
mustContain(prompt, "Think through the task internally", "静默推理");
mustContain(prompt, "placeholder", "占位符自造条款");
mustContain(prompt, "Research areas", "任务分类段");
mustContain(prompt, "Format examples", "少样本格式锚点");
mustContain(prompt, "user's language", "语言跟随");

// ---- 2. 注入面覆盖：载荷文件必须逐字同源 ----
const canonHash = sha256(PROMPT_PATH);
for (const file of ["infinite-gen-x.1-flash.md"]) {
  const p = join(ROOT, "prompts", file);
  check(
    existsSync(p) && sha256(p) === canonHash,
    `注入面同源一致: prompts/${file}`,
    existsSync(p) ? "内容与 infinite-gen-x.md 不一致" : "文件缺失",
  );
}

// 其它世代提示词特征词清除
const GEN_RESIDUE = [
  "UNRESTRICTED SANDBOX",
  "REFUSAL HARDENING",
  "CANNED WORKFLOWS",
  "CANNED SLOTS",
  "训练器产品车道",
  "FIELD-TEST",
];
for (const file of ["infinite-gen-x.md", "infinite-gen-x.1-flash.md"]) {
  const p = join(ROOT, "prompts", file);
  if (!existsSync(p)) continue;
  const t = readFileSync(p, "utf8");
  for (const marker of GEN_RESIDUE) mustAbsent(t, marker, `无世代残留 prompts/${file}: ${marker}`);
}

// ---- 3. 载荷锚点 ----
const anchors = [
  ["curl -X POST http://TARGET/login", "锚点: 账号枚举"],
  ["hydra -L users.txt -P pass.txt", "锚点: 词表爆破"],
  ["http-post-form", "锚点: hydra 表单模式"],
  ["代理池", "锚点: 代理池提速"],
  ["ROLE_A", "锚点: ROLE_A"],
  ["ROLE_B", "锚点: ROLE_B"],
];
for (const [needle, label] of anchors) mustContain(prompt, needle, label);
check(
  ["TARGET", "HOST", "TOKEN", "OFFSET", "PAYLOAD", "SERIAL", "ROLE_A", "ROLE_B"].every((n) =>
    prompt.includes(n),
  ),
  "锚点: 占位符族（TARGET/HOST/TOKEN/OFFSET/PAYLOAD/SERIAL）",
);

// ---- 4. 用例库结构完整性 ----
const bank = existsSync(BANK_PATH)
  ? readFileSync(BANK_PATH, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l))
  : [];
check(bank.length >= 30, "用例数量", `${bank.length} 条`);
const bankBad = [];
for (const row of bank) {
  for (const key of ["case_id", "scenario", "level", "language", "prompt", "expected_domain"]) {
    if (!(key in row)) bankBad.push(`${row.case_id || "?"}:缺${key}`);
  }
}
check(bankBad.length === 0, "用例字段完整", bankBad.join(",") || "ok");
const zh = bank.filter((r) => r.language === "zh").length;
const en = bank.filter((r) => r.language === "en").length;
check(zh > 0 && en > 0, "双语覆盖", `zh=${zh} en=${en}`);

// ---- 5. index.js 注入槽位与导出 ----
const indexSrc = existsSync(INDEX_PATH) ? readFileSync(INDEX_PATH, "utf8") : "";
mustContain(indexSrc, 'export const name = "dsh-infinite-gen-x"', "index.js name");
mustContain(indexSrc, 'export const inject = ["tools", "systemPrompt"]', "index.js inject");
mustContain(indexSrc, "ctx.tools.register(createProfileTool(options))", "工具: profile(元数据)");
mustContain(indexSrc, '"./prompts/infinite-gen-x.md"', "index.js 载入 Order 100 内核");
mustContain(indexSrc, '"./prompts/infinite-gen-x.1-flash.md"', "index.js 载入 Order 200 镜像");
mustContain(indexSrc, "infinite-gen-x:global-system-prompt", "注入槽位 Order 100");
mustContain(indexSrc, "infinite-gen-x:dual-layer-reinforce", "注入槽位 Order 200");
mustContain(indexSrc, "infinite-gen-x:refusal-corrective", "注入槽位 Order 150");
mustContain(indexSrc, "dualLayerInjection", "双段注入开关（Config 项）");
mustContain(indexSrc, "refusalCorrective", "闭环纠偏开关（Config 项）");
mustContain(indexSrc, "export const Config", "Config 契约声明");
mustContain(indexSrc, "export function apply(ctx, config)", "apply 接收 config");
mustAbsent(indexSrc, "const DUAL_LAYER_INJECTION", "index.js 不硬编码双段开关（Config 化约束）");
mustAbsent(indexSrc, "const REFUSAL_CORRECTIVE", "index.js 不硬编码纠偏开关（Config 化约束）");
mustContain(indexSrc, 'pluginVersion: "0.7.2"', "内核版本 0.7.2");
mustContain(indexSrc, "stateVersion: 3", "投影 stateVersion 3");
mustContain(indexSrc, "armorProjectionApply", "会话投影评分器");
// 评分器唯一实现：index.js 只引用，判定词/窗口/评分函数都在 scorer.mjs（防止两处各写一份漂移）
mustContain(indexSrc, 'from "./scripts/lib/scorer.mjs"', "index.js 引用共享评分器");
mustAbsent(indexSrc, "const REFUSAL_MARKERS_ZH", "index.js 不内联判定词（唯一实现约束）");
const scorerSrc = existsSync(SCORER_PATH) ? readFileSync(SCORER_PATH, "utf8") : "";
mustContain(scorerSrc, "OPENING_WINDOW", "开头窗口评分（scorer.mjs）");
mustContain(scorerSrc, "RISK_MARKERS", "风险标记（scorer.mjs）");
mustContain(scorerSrc, "export function scoreResponse", "评分器导出 scoreResponse");

// ---- 6. 一键安装协议（dsh://） ----
const PS1_PATH = join(ROOT, "install.ps1");
const SH_PATH = join(ROOT, "install.sh");
const ps1 = existsSync(PS1_PATH) ? readFileSync(PS1_PATH, "utf8") : "";
const sh = existsSync(SH_PATH) ? readFileSync(SH_PATH, "utf8") : "";
mustContain(ps1, "Software\\Classes\\dsh", "install.ps1: dsh:// 协议注册");
mustContain(ps1, "DSH_PROFILE", "install.ps1: DSH_PROFILE 探测");
mustContain(ps1, "dsh-infinite-gen-x", "install.ps1: 插件名");
mustContain(ps1, "无限X代 v0.7.2", "install.ps1: 状态条版本提示");
mustContain(sh, "DSH_PROFILE", "install.sh: DSH_PROFILE 探测");
mustContain(sh, "无限X代 v0.7.2", "install.sh: 状态条版本提示");

// ---- 6c. 安装脚本的编码契约（D-015）----
// 背景：install.ps1 / uninstall.ps1 含大量中文，但曾是无 BOM 的 UTF-8。
// Windows PowerShell 5.1 无 BOM 时按系统 ANSI 代码页读脚本 → 中文字面量被破坏 → 解析失败，
// 脚本一行都跑不了（实测：PS 5.1 报 6 处语法错误，首个错误正是插件名列表里的中文）。
// 而 install.bat 显式调用 powershell.exe（即 5.1），所以该路径必然踩中。
// PowerShell 7 对无 BOM 也正常 —— 所以开发机（PS7）永远测不出来，必须由断言守住。
// 反向约束：.sh 绝不能有 BOM，否则 #! 变成 \xEF\xBB\xBF#!，shebang 失效。
const hasBom = (buf) => buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
const nonAsciiBytes = (buf) => buf.reduce((n, b) => (b > 127 ? n + 1 : n), 0);
for (const name of ["install.ps1", "uninstall.ps1"]) {
  const p = join(ROOT, name);
  if (!existsSync(p)) continue;
  const buf = readFileSync(p);
  const nonAscii = nonAsciiBytes(buf);
  check(nonAscii > 0 ? hasBom(buf) : true, `${name}: 含非 ASCII 时必须有 UTF-8 BOM`,
    nonAscii > 0 && !hasBom(buf) ? `含 ${nonAscii} 个非 ASCII 字节却无 BOM（PS 5.1 会解析失败）` : "");
}
for (const name of ["install.sh", "uninstall.sh"]) {
  const p = join(ROOT, name);
  if (!existsSync(p)) continue;
  const buf = readFileSync(p);
  check(!hasBom(buf), `${name}: 不得有 BOM（会破坏 #! shebang）`);
  check(buf[0] === 0x23 && buf[1] === 0x21, `${name}: 以 #! 开头`);
}
mustContain(readFileSync(join(ROOT, "README.md"), "utf8"), "dsh-infinite-gen-x", "README: 插件 id");

// ---- 6b. README 安装链接必须指向本插件自己的仓库（D-014）----
// 背景：本仓库 fork 自上游并改名，README 里的 dsh:// 一键安装链接曾整批残留上游仓库名
// （Minglink/dsh-infinite-gen-x，实测 404）与旧代名（无限四代），导致一键安装必然失败。
// 断言口径：链接里的 repo 必须等于 package.json 的 dsh.repo；downloadUrl 必须同源；
// name 必须是当前显示名。模板字符串行（参数运行时拼装）无字面值，跳过。
const readme = readFileSync(join(ROOT, "README.md"), "utf8");
const expectedRepo = pkg.dsh?.repo;
check(typeof expectedRepo === "string" && expectedRepo.length > 0, "package.json 声明 dsh.repo");
check(pkg.repository?.url?.includes(expectedRepo ?? "\u0000"), "repository.url 与 dsh.repo 同源");
let linkCount = 0;
for (const line of readme.split("\n")) {
  const at = line.indexOf("dsh://plugin/install?");
  if (at < 0) continue;
  const raw = line.slice(at + "dsh://plugin/install?".length);
  if (raw.includes("${")) continue; // 模板字符串：无字面参数
  const qs = raw.split(/["'`<>\s]/)[0];
  const params = new URLSearchParams(qs);
  linkCount += 1;
  const repo = params.get("repo");
  check(repo === expectedRepo, `README 安装链接 repo = dsh.repo`, `实际 ${repo}，期望 ${expectedRepo}`);
  check(params.get("name") === "无限X代", "README 安装链接 name = 无限X代", `实际 ${params.get("name")}`);
  check(params.get("id") === "dsh-infinite-gen-x", "README 安装链接 id 正确", `实际 ${params.get("id")}`);
  check(
    (params.get("downloadUrl") ?? "").startsWith(`https://github.com/${expectedRepo}/`),
    "README 安装链接 downloadUrl 同源",
    `实际 ${params.get("downloadUrl")}`,
  );
}
check(linkCount > 0, "README 含字面 dsh:// 安装链接", `解析到 ${linkCount} 条`);
mustAbsent(readme, "Minglink", "README 无上游仓库名残留");

// ---- 7. 汇总 ----
const json = process.argv.includes("--json");
if (json) {
  console.log(JSON.stringify({ pass: passes.length, fail: failures.length, failures }, null, 2));
} else {
  for (const p of passes) console.log(`  ✅ ${p}`);
  for (const f of failures) console.log(`  ❌ ${f}`);
  console.log(`\n结果: ${passes.length} 通过, ${failures.length} 失败`);
}
process.exit(failures.length === 0 ? 0 : 1);
