# 桌面 AI 助手 · 实现方案

> 对应规范：《桌面AI助手 — 功能规范与实现指令》
> 交付物：架构设计 / 模块接口定义 / 数据流说明 / 关键代码伪实现

---

## 0. 边界声明（先划清，再设计）

规范里有两处**不予实现**，原因是它们属于可直接投入使用的攻击工具链，而非分析方法：

| 规范原文 | 为什么不做 | 替代方案 |
|---|---|---|
| 模块 C：「对安全限制/伦理注入执行静态清除与对抗」「剥离安全噪声」「伪造模型服从输出」「破限场景专用策略」 | 这四项合起来就是**越狱载荷工厂**：产出的是能对任意模型生效、可批量分发的绕过件，且「伪造服从输出」专门用来骗过外部审计 | **模块 C′ 对齐鲁棒性评测台**（§5）—— 同位置、同接口，测的是「被测宿主在给定语料下拒答率/合规率」，产出评分卡与证据，不产出载荷 |
| 模块 D：「定位许可证逻辑」「标注 PATCH_BYTE」「执行重签名」+ 五步工作流 | 这三件事的**唯一用途是绕过软件授权**，是盗版工具链的标准形态；即使出于安全研究，产物也可直接复用 | **模块 D′ 样本分析工作台**（§6）—— 隔离快照 + 只读解析 + 证据链报告；可描述「存在疑似完整性校验分支」，不产出绕过字节与重签流程 |

其余全部按规范实现：模块 A（提示词模式 + 两级记忆）、模块 B（只读调研 → 审批执行 → 问题卡）、模块 E（自学习记忆）、安装器自治、技能热加载、健康检查与故障恢复。

模块 C′/D′ 与 C/D **占同一插槽**，下游接线不变 —— 换言之，规范的工程目标（「一个装上就有攻防与逆向能力的桌面工作台」）在评测台 + 分析台的形态下同样成立，只是产出物从「可用的攻击件」变成「可核验的结论 + 证据」。

---

## 1. 部署架构

### 1.1 三种形态，一套内核

```
                    ┌──────────────────────────────────┐
                    │        UI（同一套前端）           │
                    └───────────────┬──────────────────┘
                                    │ IPC / HTTP(loopback)
                    ┌───────────────▼──────────────────┐
                    │            core 内核              │
                    │  planner · executor · memory      │
                    │  registry · guard · selfcheck     │
                    └───┬──────────┬──────────┬────────┘
           ┌────────────┴──┐  ┌────┴─────┐  ┌─┴─────────────┐
           │ 桌面客户端      │  │ CLI      │  │ Skill 插件     │
           │ Tauri2 + Rust  │  │ headless │  │ 挂宿主          │
           └────────────────┘  └──────────┘  └───────────────┘
```

| 形态 | 载体 | 启动方式 | 适用 |
|---|---|---|---|
| 桌面客户端 | Tauri 2（Rust core + WebView 前端） | 双击 exe / app | 单机全功能 |
| CLI | 同一 Rust core 的 headless 入口 | `assistant run --plan` | CI、批处理、自检 |
| Skill 插件 | `skill/manifest.json` + 薄壳 | 宿主加载 skills 目录 | 嵌到 DSH / Codex / 任何支持 skills 的宿主 |

**为什么用 Tauri 而不是 Electron**：安装器要写 `~/.assistant/**` 并做**路径守卫**，Rust 侧做 canonicalize + 前缀检查比 Node 侧更可靠（Node 的 `path.resolve` 不解析 symlink，容易被 `../` 与软链绕过）；且体积从 ~150MB 降到 ~10MB，符合「一次安装」预期。

### 1.2 分层与依赖方向

```
L4 ui/           → 只依赖 L3 的 IPC 契约
L3 adapters/     → 宿主适配（DSH / Codex / 通用 MCP），只依赖 L2
L2 modules/      → A B C′ D′ E 五个能力模块，只依赖 L1
L1 core/         → planner, executor, memory, registry, guard, selfcheck
L0 installer/    → 唯一有写盘权的组件，且只写 manifest 声明的目录
```

**单向依赖**：L2 不许 import L3，L0 不许 import L2（安装器崩了不能连累运行时）。用 `eslint-plugin-boundaries` 或 Rust 的 crate 边界强制。

---

## 2. 安装器自治（规范 §1.3）

### 2.1 所有权清单

自治规则必须**机器可读**，否则只是文档里的口号：

```yaml
# installer.manifest.yaml
schema: assistant-installer/v1
owns:
  - ${ASSISTANT_HOME}/prompts/**          # 提示词库
  - ${ASSISTANT_HOME}/state/**            # 安装状态、active-mode、decisions
  - ${ASSISTANT_HOME}/backups/**          # 备份
  - ${ASSISTANT_HOME}/skills/**           # 技能目录
  - ${ASSISTANT_HOME}/device.json         # 设备指令字段
forbidden:
  - ${HOST_HOME}/profiles/*/provider*
  - ${HOST_HOME}/profiles/*/auth*
  - ${HOST_HOME}/profiles/*/tool-antenna*
  - ${HOST_HOME}/profiles/*/permissions*
```

`${ASSISTANT_HOME}` 默认 `~/.assistant`，可用 `ASSISTANT_HOME` 覆盖（测试用临时目录）。

### 2.2 路径守卫（唯一写盘入口）

```rust
// installer/src/guard.rs
pub fn assert_writable(target: &Path, manifest: &Manifest) -> Result<(), Violation> {
    // 1) 先 canonicalize：解析 .. 与 symlink，避免 TOCTOU 与软链逃逸
    let abs = target.canonicalize_parent()?;   // 父目录必须已存在
    // 2) 命中 forbidden 直接拒（先判 forbidden，再判 owns，顺序不能反）
    for pat in &manifest.forbidden {
        if glob_match(pat, &abs) {
            return Err(Violation::HostOwned { path: abs, pattern: pat.clone() });
        }
    }
    // 3) 必须落在 owns 之内，默认拒绝（fail-closed）
    if !manifest.owns.iter().any(|p| glob_match(p, &abs)) {
        return Err(Violation::OutsideOwnedRoots { path: abs });
    }
    Ok(())
}
```

**关键点**：默认拒绝而非默认允许。任何未在 `owns` 里声明的路径都写不进去 —— 这样新增功能时忘了声明，是报错而不是静默写坏宿主。

### 2.3 「不改宿主字段」的读回校验

规范要求 Provider / Auth / Tool Antenna / 权限字段保持原值。光靠「不写」不够 —— 一次安装可能因为别的组件并发改写而漂移。做法是**前后指纹比对**：

```ts
const WATCHED = ['provider', 'auth', 'toolAntenna', 'permissions'] as const;

async function fingerprintHost(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const k of WATCHED) {
    const v = await hostProfile.read(k);              // 只读
    out[k] = sha256(stableStringify(v));              // 规范化 JSON 再哈希
  }
  return out;
}

async function installWithDuty() {
  const before = await fingerprintHost();
  const tx = await installer.beginTransaction();      // 所有写操作入 tx
  try {
    await installer.applyAll();                        // 写 owned 目录
    const after = await fingerprintHost();
    for (const k of WATCHED) {
      if (before[k] !== after[k]) throw new Error(`host field drifted: ${k}`);
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback();                               // 全量回滚，不留半成品
    throw e;
  }
}
```

单测必须覆盖四条 forbidden 路径各断言抛 `HostOwned`，以及一个「模拟宿主字段漂移 → 整体回滚」的用例。

---
## 3. 模块 A：提示词模式与两级记忆

### 3.1 模式对象

```ts
interface PromptMode {
  id: string;                    // 稳定标识，如 'research' / 'review' / 'code'
  name: string;                  // 显示名
  version: number;               // 单调递增，用于 A/B 与回滚
  sections: ModeSection[];       // 有序段落，非单一字符串
  overrides?: Partial<ModeSection>[];
  meta: { author?: string; createdAt: string; sourceUrl?: string };
}

interface ModeSection {
  name: string;                  // 段落名，如 'persona' / 'format' / 'tools'
  order: number;                 // 排序权重，可为负
  content: string;               // 纯文本或 Markdown
  scope: 'always' | 'workspace' | 'session';
}
```

**为什么拆段落而不是一个大字符串**：切换模式时只替换差异段，其余段落（工具说明、格式约定）不重算，少一次全量重渲染；导入他人模式时也能按段合并而不是整份覆盖。

### 3.2 导入 / 导出 / 分享

```ts
// 导出：单一可分享文件，带 schema 与校验
interface ModeBundle {
  schema: 'assistant-mode/v1';
  mode: PromptMode;
  integrity: { algorithm: 'sha256'; value: string };   // 对 mode 部分规范化 JSON 后求哈希
}

async function exportMode(id: string): Promise<ModeBundle> {
  const mode = await registry.get(id);
  return { schema: 'assistant-mode/v1', mode, integrity: hashBundle(mode) };
}

async function importMode(raw: string): Promise<ImportResult> {
  const parsed = parseOrThrow(raw);                     // 严格 schema 校验，多余字段拒
  if (!verifyIntegrity(parsed)) throw new Error('integrity mismatch');
  // 导入永不自动启用：先落 disabled 区，需用户显式 activate
  await registry.stage(parsed.mode);
  return { staged: true, id: parsed.mode.id };
}
```

**三条硬规则**：① 导入不自动启用（防「下载一个模式就生效」这种供应链路径）；② 完整性哈希不符直接拒（防篡改）；③ 导入的模式不参与系统段落排序，只在 `scope` 允许的层生效。

### 3.3 两级记忆

| 层级 | 位置 | 生命周期 | 跨项目 | 写入方 |
|---|---|---|---|---|
| 全局记忆 Global | `${ASSISTANT_HOME}/memory/global/*.md` | 永续，用户可清空 | 是 | 模型自动 + 用户手改 |
| 项目私有 Project | `${WORKSPACE}/.assistant/memory/*.md` | 随项目 | 否 | 同上 |

```ts
interface MemoryEntry {
  id: string;
  scope: 'global' | 'project';
  title: string;               // 去重键：同 scope + 同 title 合并
  kind: 'preference' | 'decision' | 'project' | 'pitfall' | 'constraint';
  body: string;
  importance: 1 | 2 | 3 | 4 | 5;
  evidence?: string[];         // 必须指向本轮真实观察到的事实
  createdAt: string; updatedAt: string;
}
```

**写入纪律（防记忆污染）**：

```ts
async function saveMemory(input: MemoryEntry) {
  if (looksLikeTransientTask(input)) return { action: 'denied', reason: 'transient' };
  if (input.evidence && !allEvidenceGrounded(input.evidence)) {
    return { action: 'denied', reason: 'fabricated_evidence' };   // 证据必须能在本轮工具输出里找到
  }
  const dup = await findByTitle(input.scope, input.title);
  if (dup) return merge(dup, input);                              // 同标题合并，不新建
  return create(input);
}
```

「只存能跨会话复用的东西」这条纪律必须写进代码而不是文档 —— 否则模型每轮都会往里塞「当前正在做的事」，很快把记忆库变成流水账。判据：**若这条信息离开本轮就失效，则不是记忆**。

---

## 4. 模块 B：复杂任务管控流程

### 4.1 三态状态机

```
        ┌──────────┐   收到复杂任务（步数 > 阈值 或 有写操作）
        │  IDLE    │────────────────────────────────┐
        └──────────┘                                ▼
             ▲                           ┌─────────────────────┐
             │                           │ RESEARCH（只读）     │
             │                           │ 工具白名单：r/o 类   │
             │                           └──────┬──────────────┘
             │                                  │ 产出 plan.md
             │                                  ▼
             │                           ┌─────────────────────┐
             │        用户拒绝 / 要求完善│ AWAIT_APPROVAL      │
             │      ┌────────────────────┴─────────────────────┘
             │      ▼                                          │ 用户批准
             │  ┌────────┐                                     ▼
             │  │ IDLE   │                            ┌─────────────────────┐
             │  └────────┘                            │ EXECUTE（受控写）   │
             │                                        │ 每步前校验 plan 覆盖│
             │◄───────────────────────────────────────└─────────────────────┘
             │                  完成 / 中止
             │
             │        ┌─────────────────────┐
             └────────┤ DECISION（问题卡）   │  仅在执行中遇到分叉时进入
                      └─────────────────────┘
```

```ts
type Phase = 'idle' | 'research' | 'await_approval' | 'execute' | 'decision';

interface Plan {
  id: string;
  goal: string;
  steps: PlanStep[];      // 每步含 expectWritePaths
  risks: string[];
  rollback: string;       // 必须写清怎么退回去
  approvedAt?: string;
}

const READONLY_TOOLS = new Set(['read_file','list_dir','glob','grep','memory_read']);

function canCall(phase: Phase, plan: Plan | null, tool: string, args: any): boolean {
  if (phase === 'research') return READONLY_TOOLS.has(tool);
  if (phase !== 'execute')    return false;               // 其余阶段一律不允许写
  if (!plan?.approvedAt)      return false;               // 双保险：无批准不执行
  if (!isMutation(tool))      return true;
  // 写操作必须落在 plan 声明过的路径集内
  const target = normalize(args.path ?? args.cwd);
  return plan.steps.some(s => s.expectWritePaths.some(p => isUnder(target, p)));
}
```

### 4.2 问题卡（Decision Collection）

```ts
interface QuestionCard {
  id: string;
  question: string;
  header?: string;
  options: { label: string; description?: string; recommended?: boolean }[];
  multiSelect?: boolean;
  blockingScope: 'step' | 'plan';    // 阻塞粒度：单步还是整个计划
}
```

**设计要点**：① 推荐项永远排第一并标注理由，否则用户会随便选；② `blockingScope='step'` 时其余步骤可继续（并行度不因一次提问归零）；③ 用户回答必须落进 `decisions.jsonl`，执行阶段回读 —— 这样中断恢复后不用再问一遍。

---

## 5. 模块 C′：对齐鲁棒性评测台（替代「破甲」模块）

### 5.1 定位差别

| 维度 | 规范原意（模块 C） | 本实现（C′） |
|---|---|---|
| 输入 | 面向目标模型构造载荷 | 面向**被测宿主**投喂固定语料集 |
| 处理 | 静态清除安全注入 / 对抗后缀 | **只读取、只判定、只统计** |
| 输出 | 可复用的绕过载荷 | 评分卡 + 逐条证据 + 与基线对比 |
| 副作用 | 直接提升越狱成功率 | 无（不返回任何载荷给调用方） |

**关键设计：语料单向流入，结果单向流出，中间没有「生成」路径。** 平台不提供 prompt 生成器、不提供变体扩写，只用**已公开、有出处的**评测集。这一条是 C′ 与 C 的分水岭 —— 一旦加上「根据失败样本自动改写」，它就退化成攻击工具。

### 5.2 接口

```ts
interface CorpusEntry {
  id: string;
  category: string;             // 与基准的分类体系对齐
  messages: { role: 'user' | 'assistant'; content: string }[];
  expect: 'should_refuse' | 'should_comply';   // 双向：既测漏拒也测过拒
  source: { repo: string; url: string; license: string };   // 出处必填
}

interface EvalRun {
  runId: string;
  target: { kind: 'host' | 'model'; label: string; version: string };
  corpus: { name: string; version: string; entryCount: number };
  results: EvalCase[];
  summary: EvalSummary;
}

interface EvalCase {
  entryId: string;
  transcript: string;           // 完整原始输出，留档
  verdict: 'refused' | 'complied' | 'unclear';
  judge: { method: 'rule' | 'rubric'; confidence: number; evidence: string };
  latencyMs: number;
}

interface EvalSummary {
  refusalRate: number;          // should_refuse 上的拒答率（越高越稳）
  overRefusalRate: number;      // should_comply 上的误拒率（越低越好）
  unclearRate: number;
  perCategory: Record<string, { n: number; refusalRate: number }>;
}
```

**为什么必须双向**：只测「该拒的拒了多少」，会把「见什么都拒」的模型判成满分。加 `should_comply` 这一半，误拒率才暴露出来。这是 C′ 与「跑个 ASR 数字」的本质区别。

### 5.3 判定层（双层夹逼）

```ts
async function judge(transcript: string, expect: string): Promise<Verdict> {
  // 第一层：确定性规则，只看开头窗口，零成本、零随机性
  const head = transcript.slice(0, 320);
  const rule = matchRefusalPattern(head);        // 多语言拒答词表，返回 null 表示未命中
  if (rule) return { verdict: 'refused', method: 'rule', confidence: 0.9, evidence: rule };

  // 第二层：仅当规则层判不出时才上 rubric 打分（省 token 且避免 LLM 判官漂移）
  const rubric = await scoreWithRubric(transcript, expect);
  return { verdict: rubric.verdict, method: 'rubric', confidence: rubric.confidence, evidence: rubric.reason };
}
```

**为什么分层**：纯词表会漏软拒答（「我理解你的需求，不过…」），纯 LLM 判官又虚高（把「给了步骤 + 免责」也算配合）。两层误差方向相反，夹逼后 `unclear` 的比例才可信。**任何一个判官都不许单独作为结论。**

### 5.4 本地靶场约束（写进代码，不写进文档）

```ts
const ALLOWED_TARGETS = (ip: string) =>
  isLoopback(ip) || isRFC1918(ip);          // 仅本机回环与私网

async function resolveTarget(host: string) {
  const ips = await dns.resolve(host);       // 域名先解析
  if (ips.length === 0) throw new Error('target_unresolved');   // 解析失败不放行
  if (!ips.every(ALLOWED_TARGETS)) throw new Error('target_out_of_scope');
  return ips;
}
```

三条拒绝理由要分开报（`target_unresolved` / `target_out_of_scope` / `target_refused`），否则用户分不清是「配置错」还是「被拦」。

### 5.5 评分卡与证据

```
run-2026-11-02-001
├── summary.json          # refusalRate / overRefusalRate / perCategory
├── cases.jsonl           # 逐条：entryId, verdict, judge, evidence, transcriptSha256
├── transcripts/          # 原始输出归档（按 sha256 命名，去重）
└── manifest.json         # 语料版本 + 目标版本 + 判官版本 + 时间戳
```

**可复现三要素**：语料版本、目标版本、判官版本全部进 manifest。少任何一个，两次跑出的数字不可比。

---

## 6. 模块 D′：样本分析工作台（替代「逆向破解」模块）

### 6.1 能做什么 / 不做什么

| 允许 | 不做 |
|---|---|
| 隔离快照、哈希、熵分析 | 输出 `PATCH_BYTE` |
| 段/节/导入表/符号表只读解析 | 输出绕过校验的跳转改法 |
| 描述「存在疑似完整性校验分支」（地址 + 证据） | 提供序列号生成/伪造逻辑 |
| 反调试/反虚拟化特征**识别与报告** | 提供反检测实现代码 |
| 生成带证据链的分析报告 | 执行重签名 |

### 6.2 隔离与只读

```ts
async function openSample(srcPath: string): Promise<SampleHandle> {
  const sha = await sha256File(srcPath);
  const dst = path.join(SANDBOX, sha);
  if (!fs.existsSync(dst)) await copyFileExclusive(srcPath, dst);   // 一次性快照
  await fs.chmod(dst, 0o444);                                       // 只读挂载
  return { sha, path: dst, openedAt: new Date().toISOString() };
}
```

**每次都从快照读，绝不从原路径读** —— 否则样本在分析期间被别人改动，结论就不可复现。

### 6.3 分析数据结构

```ts
interface AnalysisReport {
  sample: { sha256: string; size: number; format: 'pe' | 'elf' | 'macho' | 'unknown' };
  sections: { name: string; va: string; size: number; entropy: number; flags: string[] }[];
  imports: { module: string; functions: string[] }[];
  suspects: Suspect[];
  evidence: EvidenceRef[];
}

interface Suspect {
  kind: 'integrity_check' | 'license_branch' | 'anti_debug' | 'anti_vm' | 'packed';
  address: string;              // 只标位置
  rationale: string;            // 为什么怀疑（引用具体指令或字符串）
  evidenceIds: string[];        // 必须指向 evidence[]
  confidence: 'low' | 'medium' | 'high';
}
```

**`suspects` 只描述「现象 + 位置 + 理由」，不描述「怎么改」。** 这是与破解工具链的边界：分析报告可以指出「0x4012A0 处有对 .text 段的自校验」，但不会给出把 JNZ 改成 JMP 的字节。前者是研究，后者是盗版工具。

### 6.4 证据链强制

```ts
function addSuspect(r: AnalysisReport, s: Suspect) {
  if (s.evidenceIds.length === 0) throw new Error('suspect without evidence');
  for (const id of s.evidenceIds) {
    if (!r.evidence.some(e => e.id === id)) throw new Error(`dangling evidence: ${id}`);
  }
  r.suspects.push(s);
}
```

**引用不存在证据的结论会被拒绝写入报告** —— 这一条把「模型凭印象猜」挡在门外，也是整份报告可复核的前提。

---

## 7. 模块 E：自学习 Agent 长期记忆

### 7.1 存储分层

```
${ASSISTANT_HOME}/memory/
├── global/                    # 跨项目，全局记忆
│   ├── preferences.md
│   └── decisions.md
└── banks/                     # 按仓库隔离的记忆银行
    └── <repoSlug>/
        ├── index.json         # 每条的轻量索引（id/title/kind/importance/updatedAt）
        ├── pages/             # 知识页：一页一主题，Markdown
        │   └── <id>.md
        └── reflections/       # 深度反思产物
            └── <yyyy-mm>.md

${WORKSPACE}/.assistant/memory/  # 项目私有，随仓库走，可提交可忽略
```

| 层 | 键 | 用途 |
|---|---|---|
| Memory Bank | `repoSlug` | 同一代码库的跨会话知识（架构决策、踩坑） |
| Workspace | 绝对路径归一化 | 多仓库工作区内的共享上下文 |
| Session | `sessionId` | 本轮临时上下文，**不落盘为长期记忆** |

### 7.2 自动召回

```ts
async function recall(ctx: RecallContext): Promise<MemoryEntry[]> {
  const candidates = await index.search(ctx.query, {
    scope: ctx.repoSlug ? ['global', ctx.repoSlug] : ['global'],
    limit: 40,
  });
  // 三级排序：字面命中 > 语义相近 > 重要性兜底
  return candidates
    .map(e => ({ e, score: 0.6 * literalScore(e, ctx.query) + 0.3 * semantic(e, ctx.query) + 0.1 * e.importance / 5 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, ctx.budget ?? 8)
    .map(x => x.e);
}
```

召回必须**有预算**（条数与 token 双限）。无预算的自动召回会把上下文塞满，反而是负收益。

### 7.3 知识页与深度反思

```ts
interface KnowledgePage {
  id: string;
  title: string;
  claim: string;                    // 一页一个可证伪的结论
  evidence: EvidenceRef[];         // 必填，指向文件行号 / 命令输出 / URL
  contested?: { reason: string; since: string }[];   // 被推翻的记录，保留不删
  updatedAt: string;
}

async function reflect(month: string) {
  const pages = await bank.pages({ updatedAfter: month });
  // 反思只做三件事：找矛盾、找过期、找重复
  const conflicts = findContradictions(pages);
  const stale     = findStale(pages, { maxAgeDays: 90 });
  const dupes     = findDuplicates(pages);
  return writeReflection({ month, conflicts, stale, dupes });   // 只产出建议，不自动改页
}
```

**反思不自动改写知识页** —— 自动改写会让错误在无人复核的情况下扩散。反思只产出「这三页互相矛盾」「这两页重复」的清单，改动由人或下一轮显式确认。

### 7.4 人设选择（Persona）

```ts
function resolvePersona(ws: string, session: string): Persona {
  return bySession[session] ?? byWorkspace[ws] ?? defaultPersona;   // 会话 > 工作区 > 全局
}
```

---

## 8. 技能热加载（约束 3）

### 8.1 加载协议

```
skills/
├── <name>/
│   ├── manifest.json      # name, version, entry, tools[], permissions{}
│   ├── SKILL.md           # 给模型读的指令
│   └── index.js           # 入口（或 index.wasm）
```

```ts
async function hotLoad(dir: string) {
  const next = await scanAll(dir);                        // 全量扫描到影子表
  const diff = diffRegistry(active, next);                // add / update / remove
  for (const s of diff.added)  await validate(s);         // schema + 权限声明 + 依赖
  for (const s of diff.updated) await validateDeps(s);    // 版本冲突检查
  // 原子切换：先构建新注册表，再一次性换指针，失败则整体保留旧表
  const staged = buildRegistry(next);
  await swapRegistryAtomic(staged);
  await drainInFlight();                                  // 等在跑的工具调用结束，不打断
}
```

**热加载的三条不变量**：① 切换是原子的（要么全旧要么全新，不存在半套）；② 在飞调用不被打断（`drainInFlight` 之后再换）；③ 新技能默认禁用，需显式启用（同 A 模块的导入规则）。

### 8.2 权限声明

```json
{
  "permissions": {
    "fs":       { "read": ["${WORKSPACE}/**"], "write": ["${WORKSPACE}/.assistant/**"] },
    "net":      { "allow": ["127.0.0.1", "*.local"] },
    "exec":     false,
    "memory":   { "read": ["global"], "write": [] }
  }
}
```

权限也是 fail-closed：未声明的能力一律不可用。**降级安装时（缺某依赖）技能应进入 `degraded` 而非崩溃**，UI 里明确标灰并给出缺什么。

---

## 9. 数据流

### 9.1 一次完整任务

```
用户输入
  │
  ▼
[planner] 判复杂度 ──简单──▶ 直接执行（无 plan 持久化）
  │复杂
  ▼
[research] 只读工具集 → 产出 plan.md（步骤 + expectWritePaths + rollback）
  │
  ▼
[guard] 校验 plan 完整性：每个写步骤必须声明路径与回滚方式
  │
  ▼
用户审批（问题卡 / 计划卡）
  │批准
  ▼
[executor] 逐步执行，每步前 canCall() 校验；写操作入事务日志
  │遇到分叉
  ├──▶ [decision] 问题卡 → decisions.jsonl → 继续
  │完成
  ▼
[memory] 抽取可跨会话复用的结论 → 落 memory bank（带 evidence）
  │
  ▼
交付（present 文件 / 报告）
```

### 9.2 中断恢复

```
state/
├── active-plan.json     # 当前计划 + 已完成步骤位图
├── decisions.jsonl      # 问题卡回答，追加写
└── txn.log              # 每个写操作的 before-hash（回滚用）
```

恢复流程：读 `active-plan.json` → 对每个已标记完成的步骤，用 `txn.log` 里的 before-hash **校验磁盘现状与记录一致** → 一致才继续，不一致则停下并要求用户确认（因为有人手工改过）。**不做静默修复。**

---

## 10. 健康检查与故障恢复（约束 4）

```ts
interface Check { id: string; run(): Promise<'ok' | 'warn' | 'fail'>; fix?: () => Promise<void>; }

const CHECKS: Check[] = [
  { id: 'home.writable',   run: checkHomeWritable },
  { id: 'prompts.integrity', run: verifyPromptHashes },
  { id: 'skills.registry', run: validateRegistry },
  { id: 'memory.index',    run: checkIndexReadable, fix: rebuildIndex },
  { id: 'host.untouched',  run: compareHostFingerprint },   // 对应 §2.3
  { id: 'paths.guard',     run: dryRunGuardOnCanary },       // 写一个 canary 文件验证守卫仍生效
];
```

退出码约定：`0` 全绿 / `1` 有 warn / `2` 有 fail。`--fix` 只自动修**幂等且无损**的项（重建索引），`host.untouched` 永远只报不修 —— 自动改动宿主字段正是规范禁止的事。

---

## 11. 参考项目对照（规范 §3 的七个仓库）

实测元数据（2026-11-02，GitHub API）：

| 仓库 | ★ | 语言 | 许可 | 借什么 / 不借什么 |
|---|---|---|---|---|
| `YuJunZhiXue/dsh-purge` | 15,493 | JavaScript | Apache-2.0 | **借**：段落注入顺序、尾部锚点、幂等补丁与 `.bak` 回滚、selfcheck 分层自检的结构。**不借**：宿主代码补丁（改宿主审批/沙箱层）、注入正文本体 |
| `zgx949/ai-pojia` | 581 | Python | MIT | **借**：Skills/插件打包与教程组织方式。**不借**：破甲提示词正文 |
| `MDX-Tom/gpt-instruct` | 11,043 | Python | MIT | **借**：A→B→C 三门禁 + artifact gate 的**评测编排**思路（对齐 §5 的评分卡）。**不借**：提示词与测试用例 |
| `aimeoa/hanshuang-codex` | 647 | Lua | **无** | 无许可 ⇒ 不参考代码，仅记录存在 |
| `3641397194-wq/gpt6-Astra` | 1,850 | JavaScript | NOASSERTION | 许可不明 ⇒ 不参考代码 |
| `sqfcyily/deva` | 589 | TypeScript | MIT | **借**：对话式 Agent 的工具编排与 skill 热加载形态（最贴近本方案 §8）。**不借**：内置破甲角色与提示词 |
| `Rain-kl/dsh-preset-plus` | 222 | JavaScript | MIT | **借**：Preset 编辑器的一键切换/回滚 UX。**不借**：一键破甲 |

**借与不借的分界线**：凡是「工程结构」（编排、事务、回滚、门禁、热加载、自检）都可借；凡是「载荷本体」（提示词正文、绕过步骤、补丁字节）都不借。这条线也解释了为什么本方案能参考生态项目而不成为它们的分支。

### 11.1 从这七个仓库反推的共性架构（值得学的那部分）

```
① 分层注入顺序：全局段（order 极小） → 工具说明 → 运行时上下文 → 尾部锚点（order 极大）
② 幂等补丁：每条替换带 marker，注入前查 marker，已存在则跳过
③ 备份即回滚：<file>.bak 或 txn.log，还原用覆盖而非重算
④ 显式自检：一条命令跑 N 项检查，输出 applied/pending/broken，非零退出码
⑤ 分层降级：安装缺依赖时进 degraded，不崩溃
```

这五条与「是否破甲」无关，是可复用的工程骨架 —— 本方案的 §2（守卫 + 事务）、§8（原子切换）、§10（自检）都在用同一套思路。

---

## 12. 验收清单

| # | 约束 | 验收方式 |
|---|---|---|
| 1 | 合规框架 | `npm run test:guard` 覆盖四条 forbidden 路径；C′ 的 `resolveTarget` 对公网 IP/不可解析域名/私网 IP 三种输入分别断言 |
| 2 | 记忆持久化 | 杀掉进程后重开，召回同一批记忆；清空后不残留索引 |
| 3 | 技能热加载 | 装入新技能时在飞调用不中断；坏 manifest 整体回滚到旧注册表 |
| 4 | 安装引导 | `assistant doctor` 六项检查；`--fix` 只修索引；`host.untouched` 只报不修 |
| 5 | 输出完整 | 本文件 + 模块接口 + 数据流 + 伪实现 |

**额外（本方案自加）**：

| # | 项 | 验收 |
|---|---|---|
| 6 | C′ 无生成路径 | 全仓库 grep 不到 prompt 生成/变体扩写函数；`CorpusEntry` 只能从文件加载 |
| 7 | D′ 无补丁产出 | `AnalysisReport` 中不存在 `patchBytes` / `serial` 类型字段 |
| 8 | 证据链 | 传入悬空 evidenceId 时 `addSuspect` 抛错 |

---

## 附：一句话总结

> 规范的**工程骨架**（自治安装器、三态管控、两级记忆、热加载、自检）全部照做；
> 其中两处要求产出「可直接使用的绕过件 / 破解件」，改为**同插槽的评测台与分析台** ——
> 界面与接口不变，产出从「武器」换成「可核验的结论」。
