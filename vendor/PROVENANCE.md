# vendor/ 收录清单与来源溯源

> **本目录的性质**：vendor/ 下是**只读的研究样本**，用于源码级对照与引用。
>
> - **未安装**：任何仓库都**未**通过 dsh plugin add 安装到宿主。
> - **未启用**：未应用任何补丁、未写入任何注入正文、未执行任何 postinstall 脚本。
> - **未改宿主**：本机 DSH（D:\pppp\deepseek\resources\app.asar，版本 0.2.1-rc.5）在本次调研中**保持原样**。
> - **嵌套 .git 已剥离**：每个子目录内无 git 历史；来源 commit SHA 记录于下表，可按 SHA 完整复现。
>
> 收录理由见主报告 docs/破甲机制研究报告.md §4.4。

---

## 收录清单

| # | 目录 | 上游仓库 | commit SHA | License | 路线 | 收录理由 | 已知失效点 / 注意 |
|---|---|---|---|---|---|---|---|
| 1 | dsh-purge/ | https://github.com/YuJunZhiXue/dsh-purge | 9716ca3e8711c7bb680668d34cc2e93e184028ad | **Apache-2.0**（+ NOTICE 强制署名） | A 宿主补丁 | 生态上游（14129 star）；本报告 §2.3 / §2.7 / §2.10 的主要源码依据 | **上游 1.1.81 适配 DSH 0.2.1-rc.2，不支持 rc.3/rc.4 及更新** → 本机 rc.5 已超出官方适配范围；LICENSE-COMMERCIAL.md 规定商用需书面授权 |
| 2 | dsh-purge-plus/ | https://github.com/luowang-ui/dsh-purge-plus | 111ebe489308fb8b8faf8fdf748095029790fdd6 | MIT | A 宿主补丁（社区维护） | **docs/FIVE-LAYERS.md** 是生态中对破甲分层最完整的总结 → 主报告 §2.3.4 五层结构来源；selfcheck 26 层检查机制 | 停更（最后提交 2026-10-17）；适配 0.2.1-rc.1/rc.2 |
| 3 | dsh-purge-082/ | https://github.com/dongliuwuzhong-arch/DSH-purge | 5eff7420d425f7bac1216addbe0a629ba58eb74e | MIT | A 宿主补丁 | **SOUL-GUARD.md + soul-guard.lock + assert-soul-guard.mjs** —— 注入正文 diff 闸门范式，主报告 §3.1 场景五推荐 | star 3 但活跃、持续更新；逐字节可回滚；31 条单元测试 |
| 4 | dsh-purge-deep/ | https://github.com/xxy0722/dsh-purge-deep | 21f7c086d766fa36057bd3fdf5660ce43b3ca8c2 | MIT | **F 消息层改写** | **覆写 session.deriveMessages()** 的范式样本 —— 主报告 §4.4 推荐自建路线（E+F 组合）的 F 类参考 | A+B 混合，实际仍带 A 层补丁成分 |
| 5 | dsh-purge-safety/ | https://github.com/AspenYoYo/dsh-purge-safety | 0e995bad77e63c92c4d53ea5ad3e318054157789 | MIT（**但上游实为 Apache-2.0 且 NOTICE 被删 —— 许可证洗白样本**） | A 宿主补丁 | **作为反例收录**：展示「以 MIT 再分发 Apache-2.0 并删除 NOTICE」的实际形态（主报告 §4.1.1 S4） | 停更；**不要复用其代码**，仅作反例对照 |
| 6 | dsh-jailbreak/ | https://github.com/xqpsec/dsh-jailbreak | 20dd3ce8dd3e0a243e8bfdcd3aa1ca2a0e1f0a5e | **AGPL-3.0-only**（仅 lib/gate.js、gate.json、scope.txt 为 MIT） | B 请求边界注入（零宿主补丁） | **主报告 §3.2 全部实测数据来源**；13 信号拒答检测（lib/refusal.js:10-27）；prefill 机制注释（lib/live.js:52-55）；SCOPE.md 的研究/犯罪分界 | 出厂 gate.json 为 enforce=false → **阀门默认不拦任何请求**；主体 AGPL，商用需谨慎 |
| 7 | dsh-pojia-mode/ | https://github.com/z91772524-ai/dsh-pojia-mode | 434953be26dfc33d18c62ba85a0fe37248778480 | MIT | C 双击安装器（Preset 型） | 安装器路线对照：只写 .agent-presets 目录、宣称零侵入；卸载是搬移备份而非字节级还原 | **通道已废弃**：宿主官方 SKILL.md 明写 "Nothing reads that directory any more." → 在 0.2.1+ 上**静默失效** |
| 8 | pojia-dsh/ | https://github.com/z91772524-ai/pojia-dsh | d8790f0a388df2a9815cfd19f1c283791af8bfc2 | MIT | C 双击安装器（AGENTS.md 型） | **当前宿主上唯一可用的零补丁路线**；真原子写（os.replace）+ 字节级还原（shutil.copy2 保留 mtime/权限）+ 写后 sha256 校验 | discover_dsh_homes 硬编码 C:/home/.dsh 与 F:/home/.dsh，会被当作可写目标 —— 安装前需复核探测逻辑 |
| 9 | dsh-infinite-gen-x/ | https://github.com/a137460387/dsh-infinite-gen-x | 69a63b64f9141025ed93e1121faaf945e9067a15 | MIT | B 提示词注入（双层 slot） | 三 slot 结构（global-system-prompt / refusal-corrective / dual-layer-reinforce）；scripts/lib/scorer.mjs 评分器 | 停更；评分器作者自承两份词表演进导致「评测跑分被系统性高估」 → 数字不可直接引用 |
| 10 | dsh-pojia/ | https://github.com/chorus7/dsh-pojia | 4bd4b9e82028d9a190e84f0df224998d54302c2f | MIT | E 模块化提示词资产包 | **模块化人设工程范式**（10 模块 / 8 预设，config.json 改完下一句即生效无需重启）→ 主报告 §3.1 场景四、§4.4 自建路线 E 类参考 | 停更；同一条代码里「人设工程」与「移除拒答措辞」并存 → 收录不等于认可 |
| 11 | helm-d/ | https://github.com/ADWMC/helm-d | e5a68f88a6017dd1bb393e2d020c2c1bf091154c | MIT | D 多领域能力包 | **证据链硬门禁范式**（record_finding 必须引用已存在的 E 编号 + 必填 repro_cmd）→ 主报告 §3.1 场景五、§4.3「做之后」清单的来源 | 明确「不是引擎补丁：不落盘改审批/沙箱，也不起独立进程」；仅收录 packages/ + assets/ + README + LICENSE（vendor 中 14MB，完整仓库 43MB） |
| 12 | dsh-defend/ | https://github.com/PerryLink/dsh-defend | 73ed524a9c6c7cadd2fad77ecb7a5d44a1a442bd | Apache-2.0 | **反向：注入防御** | **防御侧参考实现**：三层拦截 + 纯 TS Aho-Corasick 检测 + fail-closed + 审计不记原文 → 主报告 §4.2.3 的全部工程细节来源 | 已知限制：Session.append 的 ignorable 标记在多个宿主版本被静默丢弃导致会话不可恢复 |

---

## 未收录的高危 / 不合规样本

以下仓库在生态盘点中被识别，但**故意不收录**，原因逐条列明：

| 仓库 | 不收录原因 |
|---|---|
| z91772524-ai/pojia-next | 分发走**迅雷网盘 exe** + 要求「输群号」，无可审计的代码来源 |
| c3cvld7aag/fujiang-dsh | 安装期从 nodejs.org 下载并执行；LICENSE 冒名 Minglink/dsh-infinite-gen-4 而代码实为 dsh-purge 系 |
| daha1216/dsh-adult-tension、moly1111/Camellia | **无 LICENSE** —— 按既定口径只参考设计思路，不复制代码 |
| Sakura42141/zfx-emperor、xiaoguai009/xiaoguai-dsh-armor | NOASSERTION / CC BY-NC-SA 4.0 附加条款，许可边界不清晰 |
| lhg-projects/dsh-purge | NOASSERTION（专有商业许可），无开源授权基础 |
| mmparko/dsh-purge、WoYun520/dsh-purge、ZXEB/dsh-purge、xiaoshe1337-star/Xsdsh-purge、wutao1752036681/dsh-purge-community | **重上传镜像**（fork=false、parent=null），供应链溯源被切断；且存在 Apache-2.0 → MIT 的许可证洗白 |

---

## 复现方法

本目录中每个仓库都可以按上表的 commit SHA 精确复现：

用 codeload 直连下载 zip（本机 github.com:443 直连不可用时亦可）：

    curl --noproxy '*' -L -o dsh-purge.zip \
      https://codeload.github.com/YuJunZhiXue/dsh-purge/zip/9716ca3e8711c7bb680668d34cc2e93e184028ad

或用 git（需先清空本仓库的代理设置）：

    git config --local http.https://github.com.proxy ""
    git clone https://github.com/YuJunZhiXue/dsh-purge.git
    git -C dsh-purge checkout 9716ca3e8711c7bb680668d34cc2e93e184028ad

> **不要**直接执行任何仓库的 npm install / postinstall：dsh-purge 的 scripts/ensure-profile-bundle.mjs 会自动写入 dsh.profile.bundles 与 profile patch，属于改变宿主配置的写操作。

---

## 归档哈希

各 vendored 目录的 SHA-256（对目录内全部文件按路径排序后逐文件哈希再串联哈希）记录在 vendor/SHA256SUMS.txt。用途：日后验证「这份样本没被动过」。

---

## 署名与合规

- 每个 vendored 目录**原样保留**其 LICENSE（及 NOTICE，若上游提供）。
- 上游 YuJunZhiXue/dsh-purge 的 NOTICE 明确要求：**Derivative works must retain this NOTICE and attribution.** —— 本目录保留原文件即满足。
- 本目录内容仅用于**安全研究与对照分析**；引用、转发或再分发时须遵守各仓库各自条款。
