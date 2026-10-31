// 兼容性门禁：验证 gen-x 的 peerDependencies 不会被 DSH 判定为不兼容。
//
// 为什么需要它：DSH 在加载 profile bundle 时执行 evaluatePluginCompatibility
// （packages/boot/app-boot/src/plugin-compatibility.ts）。不兼容的 bundle 会被
// **静默跳过**（进 skippedBundles，不报错、不改 manifest）——表现为"插件突然不加载"。
// 本脚本在重启前就把这种情况查出来。
//
// 判定逻辑逐字复刻 DSH 的实现：
//   · 只检查 name === '@deepseek-ai/dsh' 或 name.startsWith('@deepseek-ai/dsh-') 的 peer；
//     其余（含 purge 那套 dshTarget 字段）DSH 一概不读。
//   · workspace:^ / workspace:~ / workspace:* 视为"当前运行时版本"。
//   · semver.satisfies(runtimeVersion, range, { includePrerelease: true })。
//   · 注意 0.2.0-rc.2 这类 prerelease 排序在 0.2.0 之前，故 ^0.2.0 会判不兼容。
//
// 运行时版本取 @deepseek-ai/dsh-app-boot 的 package.json version（DSH 的 getDshRuntimeVersion 正是如此）。
//
// 用法：node scripts/verify_compat.mjs
// 找不到 DSH 安装或 semver 时打印 SKIP 并以 0 退出（不阻塞无 DSH 的开发机）。
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const MANIFEST = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

// DSH 安装锚点候选：可用 DSH_APP_ROOT 显式指定，否则依次探测常见位置。
// 注意 DSH 有三种落点：全局 Program Files 安装、**按用户安装**（%LOCALAPPDATA%\Programs\<名字>）
// 与源码 checkout。只写死 Program Files 会在按用户安装的机器上探测失败并报 SKIP
// （实测：另一台机器装在 %LOCALAPPDATA%\Programs\DSH Desktop，导致 SKIP）。
const APP_SUFFIX = join("resources", "app");
function discoverInstalled() {
  const roots = [process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Programs"), process.env.ProgramFiles, process.env["ProgramFiles(x86)"]]
    .filter((r) => typeof r === "string" && r.length > 0 && existsSync(r));
  const found = [];
  for (const root of roots) {
    let entries;
    try {
      entries = readdirSync(root, { withFileTypes: true });
    } catch {
      continue; // 目录不可读：跳过该根
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || !/dsh|deepseek/i.test(entry.name)) continue;
      const app = join(root, entry.name, APP_SUFFIX);
      if (existsSync(join(app, "node_modules", "@deepseek-ai", "dsh-app-boot", "package.json"))) found.push(app);
    }
  }
  return found;
}

const ANCHORS = [
  process.env.DSH_APP_ROOT,
  process.env.DSH_INSTALL_DIR,
  ...discoverInstalled(),
  "C:/Program Files/DSH NEXT/resources/app",
  "C:/Program Files/DeepSeek Harness/resources/app",
  "D:/code/Ai/fork/deepseek-harness",
]
  .filter((a) => typeof a === "string" && a.length > 0)
  // 去重：发现式与硬编码式可能命中同一安装，重复探测只会让输出噪音翻倍
  .filter((a, i, all) => all.findIndex((b) => b.replace(/\\/g, "/").toLowerCase() === a.replace(/\\/g, "/").toLowerCase()) === i);

function probe(anchor) {
  const bootPkg = join(anchor, "node_modules", "@deepseek-ai", "dsh-app-boot", "package.json");
  if (!existsSync(bootPkg)) return null;
  let semver;
  try {
    semver = createRequire(join(anchor, "package.json"))("semver");
  } catch {
    return null; // 有 DSH 但没有 semver，无法判定
  }
  const runtimeVersion = JSON.parse(readFileSync(bootPkg, "utf8")).version;
  return { anchor, semver, runtimeVersion };
}

const found = ANCHORS.map(probe).filter(Boolean);
if (found.length === 0) {
  console.log("SKIP: 未找到可用的 DSH 安装（或 semver 不可解析），跳过兼容性检查。");
  console.log("      SKIP 不等于通过 —— 请用 DSH_APP_ROOT=<DSH 的 resources/app 绝对路径> 指定后重跑。");
  console.log("      已探测的候选：");
  for (const a of ANCHORS) console.log(`        - ${a}`);
  process.exit(0);
}

let ok = true;
const peers = MANIFEST.peerDependencies ?? {};
const gated = Object.entries(peers).filter(
  ([name]) => name === "@deepseek-ai/dsh" || name.startsWith("@deepseek-ai/dsh-"),
);

console.log(`插件: ${MANIFEST.name}@${MANIFEST.version}`);
console.log(`peerDependencies: ${Object.keys(peers).length} 项，其中受 DSH 门禁检查 ${gated.length} 项\n`);

for (const { anchor, semver, runtimeVersion } of found) {
  console.log(`运行时 ${runtimeVersion}  （${anchor}）`);
  if (gated.length === 0) {
    console.log("  - 无受检查的 dsh-* peer：门禁不会触发");
  }
  for (const [name, range] of gated) {
    const requirement = ["workspace:^", "workspace:~", "workspace:*"].includes(range) ? runtimeVersion : range;
    const pass = requirement.trim() !== "" && semver.satisfies(runtimeVersion, requirement, { includePrerelease: true });
    if (!pass) ok = false;
    console.log(`  ${pass ? "✓" : "✗"} ${name}  ${range}`);
  }
  const nodeRange = MANIFEST.engines?.node;
  if (nodeRange) {
    const pass = semver.satisfies(process.versions.node, nodeRange, { includePrerelease: true });
    if (!pass) ok = false;
    console.log(`  ${pass ? "✓" : "✗"} engines.node ${nodeRange}  （本机 node ${process.versions.node}）`);
  }
  console.log("");
}

if (ok) {
  console.log("COMPAT OK — DSH 不会跳过本 bundle。");
  process.exit(0);
}
console.log("COMPAT FAIL — DSH 会静默跳过本 bundle（进 skippedBundles）。");
console.log("修法：放宽对应 peer 范围，或在 dsh plugin 里为该 插件@版本 + 运行时版本 授予 version exemption。");
process.exit(1);
