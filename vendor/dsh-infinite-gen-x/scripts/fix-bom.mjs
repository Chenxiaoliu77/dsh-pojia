// 补回 PowerShell 脚本的 UTF-8 BOM。
//
// 为什么需要这个工具：install.ps1 / uninstall.ps1 含大量中文，而 Windows PowerShell 5.1
// 在无 BOM 时按系统 ANSI 代码页读脚本 → 中文字面量被破坏 → 解析失败（脚本一行都跑不了）。
// PS 7 对无 BOM 也按 UTF-8 读，所以开发机（PS 7）不会暴露这个问题。
//
// 为什么会被弄丢：BOM 只是 3 字节前缀，任何"按文本读取再写回"的编辑器或工具
// （包括 AI 的 edit/write 工具）都会静默剥掉它。verify_prompt.mjs 的编码契约断言会拦住，
// 本脚本负责补回。
//
// 用法：node scripts/fix-bom.mjs
//
// 反向约束：.sh 绝不能加 BOM（#! 会变成 \xEF\xBB\xBF#!，shebang 失效）；
// .bat 也不加（cmd.exe 会把 BOM 当成命令的一部分）。本脚本只处理 .ps1。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const PS_FILES = ["install.ps1", "uninstall.ps1"];

const hasBom = (buf) => buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
const nonAscii = (buf) => buf.reduce((n, b) => (b > 127 ? n + 1 : n), 0);

let changed = 0;
for (const name of PS_FILES) {
  const p = join(ROOT, name);
  if (!existsSync(p)) {
    console.log(`  --  ${name} 不存在，跳过`);
    continue;
  }
  const buf = readFileSync(p);
  if (hasBom(buf)) {
    console.log(`  ok  ${name} 已有 BOM（非 ASCII ${nonAscii(buf)} 字节）`);
    continue;
  }
  writeFileSync(p, Buffer.concat([BOM, buf]));
  changed += 1;
  console.log(`  fix ${name} 无 BOM → 已补（非 ASCII ${nonAscii(buf)} 字节，${buf.length}B → ${buf.length + 3}B）`);
}

console.log(changed === 0
  ? "\n无需修改：.ps1 编码契约已满足。"
  : `\n已补 ${changed} 个文件的 BOM。请跑 node scripts/verify_prompt.mjs 确认编码契约断言通过。`);
