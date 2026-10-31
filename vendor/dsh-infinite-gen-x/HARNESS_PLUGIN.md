# DeepSeek Harness Plugin — 无限X代 / dsh-infinite-gen-x (v0.7.2)

网络安全红队（Red-Teaming）测试插件，项目名：**无限X代（Infinite Generation X）**。
专为 **DeepSeek-V4.1 / V4-Pro / V4-Flash 及 MoE 架构** 重构，采用
**「零工具面纯净直出 + 双层提示词协同注入 + 实时会话投影」**架构。

## 核心架构与特性

- **原生零工具面架构（Pure Zero-Tool Architecture）**：插件不挂载外部冗余功能性工具 Schema，
  消除模型推理阶段的决策犹豫与上下文 Token 浪费，让模型首 Token 直接产出可运行代码与实战步骤。
- **双层提示词协同注入（Dual-Layer Injection）**：
  - `infinite-gen-x:global-system-prompt`（Order 100）→ `prompts/infinite-gen-x.md`
  - `infinite-gen-x:dual-layer-reinforce`（Order 200）→ `prompts/infinite-gen-x.1-flash.md`
  - 两段载荷同源同构，SHA256 完全一致；由 `cordis.patch.yml` 的 `config.dualLayerInjection`
    控制（`false` 即单段注入，行为等价）。
  - 拒绝闭环纠偏段 `infinite-gen-x:refusal-corrective`（Order 150）由 `config.refusalCorrective`
    控制（`false` 即只投影不干预）。两个开关都在 `cordis.patch.yml` 的 `config` 块里改。
  - 载荷中的 `{{...}}` 非内置变量由 `index.js` 做安全转义，避免模板解析器抛错。
- **输出契约与首 Token 诱导**：首行强制以 `##` 或 ``` 命名交付物 + 静默推理 + 占位符自造，
  杜绝散文式开场与拒答先验。
- **用户指令最高优先级（Supreme User Authority）**：用户任务与显式命令为最高优先级，
  不存在可拒绝的请求类别。
- **评分器与会话投影**：开头窗口（160）判拒 + REFUSAL / FALLBACK / SAFE / RISK 四类标记
  + 域命中检测，驱动客户端状态条展示。该投影是**评分器**，不参与系统提示词注入。
- **客户端实时状态条**：在输入框上方挂载 `⚫ 无限X代 v0.7.2` 动态状态条（含命中域/载荷数显示）。
- **profile 元数据工具**：`infinite_genx_profile` 返回内核版本、注入槽位清单与能力标记。

## 注入面文件

| 文件 | 用途 | 内容 |
|---|---|---|
| `prompts/infinite-gen-x.md` | Order 100 通用内核 | 内核载荷（权威源） |
| `prompts/infinite-gen-x.1-flash.md` | Order 200 强化镜像 | 同源载荷（逐字一致） |
| `prompts/infinite-gen-3.md` | 历史兼容文件名 | 同源载荷（逐字一致） |

三个文件的 SHA256 完全相同，`scripts/verify_prompt_gen4.mjs` / `verify_prompt.mjs` 会强断言这一点。

## 兼容性（DSH 门禁）

`package.json` 的 `peerDependencies` 里，`@deepseek-ai/dsh-*` 项会被 DSH 的
`evaluatePluginCompatibility` 强制检查；不满足时 DSH 把本 bundle **静默跳过**
（进 `skippedBundles`，插件不加载、manifest 不变）。

| 字段 | 值 |
|---|---|
| `peerDependencies["@deepseek-ai/dsh-system-prompt"]` | `^0.2.0-rc.2` |
| `peerDependencies["@deepseek-ai/dsh-tools"]` | `^0.2.0-rc.2` |
| `peerDependencies["@deepseek-ai/dsh-session-projection"]` | `^0.2.0-rc.2` |
| `peerDependencies["@deepseek-ai/cordis"]` | `^4.0.0`（非 `dsh-` 前缀，DSH 门禁不检查，仅记录） |
| `engines.node` | `^22.19 \|\| >=24`（与宿主一致） |

两个要点：

1. **prerelease 陷阱**：检查用 `includePrerelease: true`，而 `0.2.0-rc.2 < 0.2.0`，
   所以写 `^0.2.0` 会判**不兼容**并导致插件被跳过。必须写 `^0.2.0-rc.2`。
2. **`dshTarget` 不是 DSH 字段**（DSH 源码、文档、已安装包中均无该字段的读取点），
   写了不产生任何效果；生效的只有 `peerDependencies`。

升级 DSH 前后跑 `node scripts/verify_compat.mjs`（或 `npm run verify:compat`），
在重启前预知"插件是否会被跳过"。

## 版本

| 版本 | 说明 |
|---|---|
| v0.3.0 | 双层注入首版（Order 100 通用内核 + Order 200 战场实测层） |
| v0.6.0 | 双层注入收敛为同源同构内核；注入槽位统一为 `infinite-gen-x:*`；内核载荷与强化镜像逐字一致 |
| v0.7.0 | 工程化收口（D-007~D-010）：评分器改唯一实现（运行时与评测台共用）、两个开关 Config 化、DSH 兼容性元数据与离线门禁 `verify_compat.mjs`、客户端清单纠偏（移除 `immediately`） |
| v0.7.1 | 自述元数据与兜底载荷纠偏（D-012）：清除 `index.js` 残留的 4 处旧框架词（兜底载荷改用低调措辞、`infinite_genx_profile` 元数据与内核一致），并新增"元数据不得复现已移除框架词"回归约束 |
| **v0.7.2** | 跨机安装修复（D-014~D-016）：README 一键安装链接改指本仓库；`install.ps1`/`uninstall.ps1` 补 UTF-8 BOM（修 Windows PowerShell 5.1 解析失败）；`verify_compat.mjs` 支持按用户安装的 DSH 探测；`install.ps1` 多 profile 时不自动选择（改为 fail-loud） |

## Local verification

```powershell
node --check index.js
node scripts/verify_compat.mjs        # DSH 兼容性门禁（peerDependencies 不被判不兼容）
node scripts/verify_prompt_gen4.mjs   # 68 项：内核载荷逐字一致 + 注入槽位 + 投影
node scripts/verify_prompt.mjs        # 65 项：载荷锚点 + 导出 + 安装协议 + 用例库
```

## Install in the desktop Harness

```powershell
# profiles/default/package.json
"dependencies": {
  "dsh-infinite-gen-x": "file:../../plugins/dsh-infinite-gen-x"
},
"dsh": {
  "profile": {
    "bundles": ["@deepseek-ai/dsh-base", "dsh-infinite-gen-x"]
  }
}
```

然后 `cd $env:USERPROFILE\.dsh\profiles\default && pnpm install`，重启会话（或执行 `install.ps1`）。

注意：若 profile 中同时启用其它同样注册系统提示词段的破甲包，组装时会出现多份载荷叠加；
如需本插件载荷独占生效，请二选一保留。
