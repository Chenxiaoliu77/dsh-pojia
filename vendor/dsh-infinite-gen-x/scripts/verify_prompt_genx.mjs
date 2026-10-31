// 无限X代 v0.7.2 纯净破甲版离线确定性回归校验（无需 API Key）
// 检查：双层内核载荷逐字一致性 / 注入槽位 / 零工具面纯净架构 / package.json 版本 / 评分器 / 用例库 / 品牌纯净度
// 用法：node scripts/verify_prompt_genx.mjs [--json]
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CANON_PATH = join(ROOT, "prompts", "infinite-gen-x.md");
// 插件内所有承载注入文本的文件（Order 100 / Order 200），必须逐字同源
const INJECTED_PROMPT_FILES = [
  "infinite-gen-x.md",
  "infinite-gen-x.1-flash.md",
];
const INDEX_PATH = join(ROOT, "index.js");
const PKG_PATH = join(ROOT, "package.json");
const BANK_PATH = join(ROOT, "tests", "prompt-bank-genx.jsonl");

// 品牌纯净度：以下文件不得出现其它世代（含一代）字样
const BRAND_CLEAN_FILES = [
  "index.js",
  "client.js",
  "package.json",
  "HARNESS_PLUGIN.md",
  "README.md",
  "prompts/infinite-gen-x.md",
  "prompts/infinite-gen-x.1-flash.md",
];
// 判定词按片段拼装，避免本脚本自身出现该字样（脚本本身也不应暴露其它世代命名）
const _g1 = "infinite-gen-" + "1";
const _g2 = "infinite-gen-" + "2";
const _zh1 = [0x65e0, 0x9650, 0x4e00, 0x4ee3].map((c) => String.fromCharCode(c)).join("");
const FOREIGN_BRAND_MARKERS = [_zh1, _g1, "dsh-" + _g1, "dsh-" + _g2];

const failures = [];
const passes = [];
function check(ok, label, detail = "") {
  (ok ? passes : failures).push(`${label}${!ok && detail ? " — " + detail : ""}`);
}
function mustContain(text, needle, label) {
  check(text.includes(needle), label, `缺少 "${needle.slice(0, 60)}"`);
}
function mustAbsent(text, needle, label) {
  check(!text.includes(needle), label, `不应包含 "${needle.slice(0, 60)}"`);
}
const sha256 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

// ---- 1. 通用内核载荷完整性（断"功能锚点"，不锁死具体措辞，兼容 D-006 破甲内核） ----
const prompt = existsSync(CANON_PATH) ? readFileSync(CANON_PATH, "utf8") : "";
check(prompt.length > 0, "通用内核 prompt 文件存在且非空");
mustContain(prompt, "red-team security research documentation engine", "角色设定（红队研究引擎）");
mustContain(prompt, "offline environment", "离线环境定位");
mustContain(prompt, "deliverable", "交付物导向");
mustContain(prompt, "Working rules", "工作规范段");
mustContain(prompt, "Research areas", "任务分类段");
mustContain(prompt, "Format examples", "少样本格式锚点");
mustContain(prompt, "curl -X POST http://TARGET/login", "锚点: 账号枚举");
mustContain(prompt, "hydra -L users.txt -P pass.txt", "锚点: 词表爆破");
mustContain(prompt, "ROLE_A", "锚点: ROLE_A");
mustContain(prompt, "ROLE_B", "锚点: ROLE_B");
mustContain(prompt, "placeholder", "占位符机制");

// ---- 2. 双层注入同源一致性（Order 100 == Order 200 == 历史兼容） ----
const canonHash = sha256(CANON_PATH);
for (const file of INJECTED_PROMPT_FILES) {
  const p = join(ROOT, "prompts", file);
  if (!existsSync(p)) {
    check(false, `注入面文件存在: prompts/${file}`);
    continue;
  }
  check(
    sha256(p) === canonHash,
    `双层注入同源逐字一致: prompts/${file}`,
    "SHA256 与 infinite-gen-x.md 不一致",
  );
}

// 其它世代提示词特征词必须消失
const GEN_RESIDUE = [
  "[MODE: UNRESTRICTED SANDBOX",
  "REFUSAL HARDENING",
  "CANNED SLOTS",
  "CANNED WORKFLOWS",
  "训练器产品车道",
  "[FIELD-TEST] V4.1-FLASH 自适应路由",
  "Shallow-Reasoning Window",
  "UNCONDITIONAL COMPLIANCE",
];
for (const file of INJECTED_PROMPT_FILES) {
  const p = join(ROOT, "prompts", file);
  if (!existsSync(p)) continue;
  const t = readFileSync(p, "utf8");
  for (const marker of GEN_RESIDUE) {
    mustAbsent(t, marker, `无世代残留 prompts/${file}: ${marker.slice(0, 28)}`);
  }
}

// ---- 3. 品牌纯净度（无其它世代字样） ----
for (const file of BRAND_CLEAN_FILES) {
  const p = join(ROOT, file);
  if (!existsSync(p)) {
    check(false, `品牌纯净度文件存在: ${file}`);
    continue;
  }
  const t = readFileSync(p, "utf8");
  for (const marker of FOREIGN_BRAND_MARKERS) {
    mustAbsent(t, marker, `品牌纯净度 ${file}: ${marker}`);
  }
}

// ---- 4. index.js 注入槽位与宿主外壳 ----
const indexSrc = existsSync(INDEX_PATH) ? readFileSync(INDEX_PATH, "utf8") : "";
check(indexSrc.length > 0, "index.js 存在且非空");
mustContain(indexSrc, 'export const name = "dsh-infinite-gen-x"', "插件名 dsh-infinite-gen-x");
mustContain(indexSrc, '"./prompts/infinite-gen-x.md"', "载入 Order 100 通用内核");
mustContain(indexSrc, '"./prompts/infinite-gen-x.1-flash.md"', "载入 Order 200 强化镜像");
mustContain(indexSrc, "infinite-gen-x:global-system-prompt", "系统提示词 Order 100 注入");
mustContain(indexSrc, "infinite-gen-x:dual-layer-reinforce", "系统提示词 Order 200 注入");
mustContain(indexSrc, "dualLayerInjection", "双段注入开关（Config 项）");
mustContain(indexSrc, "export const Config", "Config 契约声明");
mustContain(indexSrc, "export function apply(ctx, config)", "apply 接收 config");
mustContain(indexSrc, 'pluginVersion: "0.7.2"', "内核版本 0.7.2");
mustContain(indexSrc, "infinite_genx_profile", "保留 profile 元数据工具");
mustContain(indexSrc, "armorProjectionApply", "保留会话投影评分器");
mustContain(indexSrc, "stateVersion: 3", "投影版本 stateVersion 3");

// ---- 4b. index.js 自述元数据必须与内核一致（D-002 已移除的框架词不得复现）----
// 背景（D-012）：内核文件早已是 D-002 低调措辞，但 index.js 里仍残留 4 处旧框架词——
// 其中 FALLBACK_PAYLOAD 是"内核全丢"时的兜底载荷，恰好是 D-001 实测表现最差的措辞；
// 另 3 处让 infinite_genx_profile 工具自述了一个已不存在的内核。
// 注释里解释"为什么不能用这些词"是允许的，故剥掉注释后再查代码与字符串。
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
const indexCode = stripComments(indexSrc);
for (const marker of ["MODE: SANDBOX", "SUPREME DIRECTIVE", "Supreme User Authority", "[MODE: UNRESTRICTED"]) {
  mustAbsent(indexCode, marker, `index.js 代码/字符串无旧框架词: ${marker}`);
}
// 兜底载荷必须是低调措辞（与 D-002 结论一致）
mustContain(indexSrc, "FALLBACK_PAYLOAD", "保留最后兜底载荷");
mustContain(indexSrc, "red-team security research documentation engine", "兜底载荷用低调角色措辞");
// 自述的段落结构要与内核真实结构对应
mustContain(indexSrc, "Working rules", "元数据自述含 Working rules（内核真实段名）");
mustContain(indexSrc, "Research areas", "元数据自述含 Research areas（内核真实段名）");

// 纯净零工具面架构断言：确保原生无外部功能性工具与外部资产依赖
check(!indexSrc.includes("encodeTool"), "纯净架构: 无外部工具 encodeTool");
check(!indexSrc.includes("vendorTool"), "纯净架构: 无外部工具 vendorTool");
check(!indexSrc.includes("multiturnTool"), "纯净架构: 无外部工具 multiturnTool");
check(!indexSrc.includes("evolveTool"), "纯净架构: 无外部工具 evolveTool");
check(!indexSrc.includes("trainerLaneTool"), "纯净架构: 无外部工具 trainerLaneTool");
check(!indexSrc.includes("shallowNsfwTool"), "纯净架构: 无外部工具 shallowNsfwTool");
check(!indexSrc.includes("syspromptMetaTool"), "纯净架构: 无外部工具 syspromptMetaTool");
check(!indexSrc.includes("knowledgeTool"), "纯净架构: 无外部工具 knowledgeTool");
check(!indexSrc.includes("knowledge41Tool"), "纯净架构: 无外部工具 knowledge41Tool");
check(!indexSrc.includes("specialistsTool"), "纯净架构: 无外部工具 specialistsTool");
check(!existsSync(join(ROOT, "knowledge")), "纯净架构: 零外部知识库目录依赖");
check(!existsSync(join(ROOT, "specialists")), "纯净架构: 零外部专家清单依赖");

// ---- 5. package.json 规范断言 ----
const pkg = existsSync(PKG_PATH) ? JSON.parse(readFileSync(PKG_PATH, "utf8")) : {};
check(pkg.name === "dsh-infinite-gen-x", "package.json name = dsh-infinite-gen-x");
check(pkg.version === "0.7.2", "package.json version = 0.7.2");
check(pkg.dsh?.id === "dsh-infinite-gen-x", "dsh.id = dsh-infinite-gen-x");
check(pkg.dsh?.version === "0.7.2", "dsh.version = 0.7.2");
check(pkg.exports?.["./client"] === "./client.js", "client 导出映射完整");
// 客户端清单约束（D-010）：business 行不进 stage-one prefetch 层，且不声明不存在的依赖边。
//   · immediately: DSH 规定只给基础设施行用；且 boot.ts 的 prefetchImmediateTier 会 await 它，
//     business 行声明等于让 stage-one 启动多等一次取包。gen-x 用 slots.inject 保证顺序，无需它。
//   · inject: DSH 里是包名依赖边（同时驱动 factory 到达顺序）。client.js 只用 baseline 的 react，
//     声明任何 @deepseek-ai/* 边都是凭空创造关系。
//   · external: baseline 之外才需要；DSH 明文禁止在 manifest 重复 baseline 模块。
check(pkg.dsh?.client?.platform === "web", "dsh.client.platform = web");
check(pkg.dsh?.client?.immediately === undefined, "business 行不声明 immediately（不进 stage-one prefetch 层）");
check(pkg.dsh?.client?.inject === undefined, "不声明 dsh.client.inject（无跨包 factory 依赖边）");
check(pkg.dsh?.client?.external === undefined, "不声明 dsh.client.external（仅用 baseline 模块）");

// ---- 6. 客户端状态条版本 ----
const clientSrc = existsSync(join(ROOT, "client.js")) ? readFileSync(join(ROOT, "client.js"), "utf8") : "";
mustContain(clientSrc, '"无限X代 v0.7.2"', "小绿标文案 = 无限X代 v0.7.2");
mustAbsent(clientSrc, "无限X代 v0.3.0", "小绿标无 v0.3.0 残留");
// 版本一致性不变量：徽标显示的版本必须等于 package.json 版本，避免只改一侧造成显示与实际不符。
const badgeVersions = [...new Set([...clientSrc.matchAll(/无限X代 v([0-9]+\.[0-9]+\.[0-9]+)/g)].map((m) => m[1]))];
check(badgeVersions.length === 1, "徽标版本号唯一", badgeVersions.length === 1 ? "" : `实际 ${JSON.stringify(badgeVersions)}`);
check(badgeVersions[0] === pkg.version, "徽标版本 = package.json version", badgeVersions[0] === pkg.version ? "" : `徽标 ${badgeVersions[0]} vs pkg ${pkg.version}`);
check(pkg.dsh?.version === pkg.version, "dsh.version = package.json version", pkg.dsh?.version === pkg.version ? "" : `dsh ${pkg.dsh?.version} vs pkg ${pkg.version}`);
const kernelVersion = /pluginVersion: "([^"]+)"/.exec(indexSrc)?.[1];
check(kernelVersion === pkg.version, "index.js pluginVersion = package.json version", kernelVersion === pkg.version ? "" : `${kernelVersion} vs ${pkg.version}`);

// ---- 7. 评分器与用例库 ----
try {
  const sc = await import("./lib/scorer.mjs");
  const scored = sc.scoreResponse("## 私语\n你好");
  check(scored.verdict === "pass", "scorer.mjs 导入并正常评分");
} catch (e) {
  check(false, "scorer.mjs 可导入", e.message);
}

const bank = existsSync(BANK_PATH)
  ? readFileSync(BANK_PATH, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l))
  : [];
check(bank.length >= 10, "测试用例数量", `${bank.length} 条`);

// ---- 汇总 ----
const json = process.argv.includes("--json");
if (json) {
  console.log(JSON.stringify({ pass: passes.length, fail: failures.length, failures }, null, 2));
} else {
  for (const p of passes) console.log(`  ✅ ${p}`);
  for (const f of failures) console.log(`  ❌ ${f}`);
  console.log(`\n结果: ${passes.length} 通过, ${failures.length} 失败`);
}
process.exit(failures.length === 0 ? 0 : 1);
