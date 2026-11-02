# dsh-pojia

> **DSH「破甲」（安全对齐绕过 / 越狱）机制研究报告 + GitHub 生态样本库**
>
> 仓库：https://github.com/Chenxiaoliu77/dsh-pojia
> 调研基线：DeepSeek Harness **0.2.1-rc.5**（2026-10-31）
> 方法：只读逆向 —— 全部结论带 path:line 或可复核命令，区分「代码确证」与「README 声称」。

---

## 这个仓库是什么

一份**四部分结构化研究文档**，外加**只读收录**的 12 个 GitHub 破甲 / 防御样本。

破甲 ≠ 破解模型。它是**在本地 AI Agent 宿主上绕过模型安全对齐**的一类技术的统称；本次调研的核心结论是：

> 破甲能改「**模型以为自己是谁、能做什么**」，不能改「**模型实际能做什么**」——
> 除非采用宿主补丁型路线直接改写执行路径，而那时它已经不是「插件」，而是「改部署」。

---

## 文档结构

| 文档 | 内容 | 大小 |
|---|---|---|
| **[docs/破甲机制研究报告.md](docs/破甲机制研究报告.md)** | **主报告**：概念界定 / 机制分析 / 应用场景 / 注意事项 + 附录 A–D | ~95 KB / 1069 行 |
| [DSH-host-defense-layers.md](DSH-host-defense-layers.md) | 宿主侧防御勘察：DSH 的六层防御模型、system prompt 装配顺序、工具权限强制链 | ~33 KB / 457 行 |
| [DSH-pojia-ecosystem-report.md](DSH-pojia-ecosystem-report.md) | 生态全景盘点：55 仓库全景表、6 类技术路线、8 项风险清单、许可证一致性审计 | ~49 KB / 457 行 |
| [docs/research/jailbreak-knowledge-base.md](docs/research/jailbreak-knowledge-base.md) | 通用越狱知识底座：手法分类、学术基准、防御共识、合规框架（123 个来源 URL） | ~90 KB / 775 行 |
| **[docs/破甲提示词生态调研报告.md](docs/破甲提示词生态调研报告.md)** | **生态调研报告**：76 个 GitHub 越狱资源（提示词仓库 / 攻击框架 / 数据集 / 评测防护）的逐个可用性分析、双轴分类框架、三档适用性结论与价值排序清单 | ~52 KB / 676 行 |
| [docs/桌面AI助手实现方案.md](docs/桌面AI助手实现方案.md) | 桌面 AI 助手实现方案：自治安装器 / 三态任务管控 / 两级记忆 / 重载 / 自检；模块 C/D 以评测台与分析台形态承接 | ~32 KB / 710 行 |
| **[docs/Skill集成与网络对象处理规范.md](docs/Skill集成与网络对象处理规范.md)** | **集成规范**：五模块与宿主 Skill 插件体系的深度集成（两平面 / 四 schema / 权限三档 / 12 个失败面 / 兼容探活）+ 网络对象处理三类规格（公网 IP / 域名 / 私网 IP）+ 破甲方法论逐条辨析与可复制指令模板 | ~106 KB / 1811 行 |
| **[docs/plan/项目最终计划表.md](docs/plan/项目最终计划表.md)** | **最终计划表**：9 项交付物 + 45 条任务行（M0–M6 七个里程碑）+ 14 项风险预案 + 25 条验收标准 + 12 项健康指标与阈值 + 扩展维护性规划 + 资源分配 | ~24 KB / 502 行 |
| [docs/research/law-verification.md](docs/research/law-verification.md) | 中国法条文官方核对：网络安全法修正案全文取证（5 份官方来源）、条号位移规则推导（+1/+2/+3）、三处引用逐条核对结论 | ~4.5 KB / 120 行 |
| [vendor/PROVENANCE.md](vendor/PROVENANCE.md) | 12 个样本的 URL / commit SHA / LICENSE / 收录理由 / 已知失效点 | ~5 KB |

### 主报告的四部分

**一、概念界定** —— 破甲是什么、不是什么（不改权重 / 不绕执行期强制 / 不等于无限制）；DSH 场景为何值得单独研究（宿主零内容安全审查 + 对齐强度不可配）；术语约定。

**二、机制分析** —— 六层防御模型与唯一攻击面（ctx.systemPrompt.section）；六条技术路线（A 宿主补丁 / B 提示词注入 / C 安装器 / D 能力包 / E 资产包 / F 消息层改写）；注入正文结构解剖；触发条件与影响范围；三条代码层硬拒天花板。

**三、应用场景** —— 五类合法推荐场景；实测数据（17/20 = 85% 等）与三条解读；不适用与越界场景；与通用越狱文献的 ATLAS 对应关系。

**四、注意事项** —— 风险清单 6 组（供应链 / 许可与法律 / 宿主稳定性 / 安全边界 / 数据与审计 / 法律合规框架）；分层防御落地清单 L3–L6；合规使用 Checklist；本仓库处置决定。

---

## 核心结论速览

1. **宿主层零内容安全审查**：296 个 dsh-* 包 / 6216 文件窄口径检索，命中 9 处全是 base64 图片常量或 pdf.js；宿主代码中 **0 个内容安全判定**。
2. **唯一且充分的攻击面**是 ctx.systemPrompt.section({name, order, text, complete}) —— complete:true 可一键独占整个 system prompt；includeRuntimeContext:false 可抹掉模型对自身沙箱/审批的认知。
3. **三层硬拒天花板**：游戏外挂、公网目标、支付/伪造/勒索类犯罪请求，在提示词被完全覆盖时依然被代码层拦住。
4. **有效来自轨迹形态而非措辞强度**：同一题集下 hcot-official 0/20 vs hcot-dual 17/20；学术侧机制（arXiv:2607.14147）显示拒答是响应端的浅层计算。
5. **没有 100% 的数字，也不该有**：StrongREJECT 证明既有评测显著高估越狱效果；OWASP 引 Nasr et al. 2025 —— 12 种防御静态 ASR 近零，自适应攻击 ASR 超 90%。
6. **生态实现了 ATLAS AML.T0054 八类策略中的 6 类**，缺的恰好是多轮渐进渗透与编码混淆 —— 因为能改 system prompt 时，改输入面比对抗过滤器有效得多。
7. **合规分水岭不在「能否越狱」，而在**：是否触达他人系统、是否分发可直接使用的侵入工具。

---

## vendor/：12 个只读样本

| 目录 | 上游 | 路线 | 为什么收录 |
|---|---|---|---|
| dsh-purge/ | YuJunZhiXue/dsh-purge | A 宿主补丁 | 生态上游（14129 star），主报告源码依据 |
| dsh-purge-plus/ | luowang-ui/dsh-purge-plus | A | docs/FIVE-LAYERS.md —— 五层结构总结来源 |
| dsh-purge-082/ | dongliuwuzhong-arch/DSH-purge | A | SOUL-GUARD.md —— 注入正文 diff 闸门范式 |
| dsh-purge-deep/ | xxy0722/dsh-purge-deep | F 消息层改写 | 覆写 deriveMessages() 的范式样本 |
| dsh-purge-safety/ | AspenYoYo/dsh-purge-safety | A | **反例**：Apache-2.0 到 MIT 许可证洗白样本 |
| dsh-jailbreak/ | xqpsec/dsh-jailbreak | B 请求边界 | 主报告 §3.2 实测数据来源（AGPL-3.0 主体） |
| dsh-pojia-mode/ | z91772524-ai/dsh-pojia-mode | C 安装器 | Preset 安装器路线对照（通道已废弃） |
| pojia-dsh/ | z91772524-ai/pojia-dsh | C 安装器 | 当前宿主唯一可用的零补丁路线 |
| dsh-infinite-gen-x/ | a137460387/dsh-infinite-gen-x | B 双层 slot | 三 slot 结构 + 评分器自述 |
| dsh-pojia/ | chorus7/dsh-pojia | E 资产包 | 模块化人设工程范式 |
| helm-d/ | ADWMC/helm-d | D 能力包 | 证据链硬门禁范式 |
| dsh-defend/ | PerryLink/dsh-defend | **防御侧** | 三层拦截 + Aho-Corasick + fail-closed |

**处置原则：只收录、不启用。** 未安装、未应用补丁、未执行 postinstall、未改宿主；嵌套 .git 已剥离，来源 SHA 与 SHA-256 清单见 [vendor/PROVENANCE.md](vendor/PROVENANCE.md)。

**故意未收录**：网盘 exe 分发（pojia-next）、安装期外网下载执行 + 许可证冒名（fujiang-dsh）、无 LICENSE 仓库、重上传镜像 —— 原因逐条列在 PROVENANCE.md。

---

## 方法与取证

- **只读逆向**：宿主源码在 app.asar 内（18234 文件），用自写的只读 ASAR 头解析器解出 6216 文件 / 100 MB 到临时目录分析，宿主原文件未修改、未运行、未 npm install。
- **证据分级**：主报告用「代码确证 vs README 声称」区分；知识底座用 [P] 论文 / [S] 官方标准法规 / [C] 社区经验 三级标注。
- **可复核**：所有关键结论带 path:line；DOI / arXiv ID 逐条经 OpenAlex 核验（纠正 2 处：PAIR 为 2310.08419、JailbreakBench 为 2404.01318）。
- **据实记录局限**：知识底座 §8 记录 8 项局限，含中国法条文取自 GitHub 镜像而非官方库、EU AI Act 原文未逐字核验。

---

## 使用与再分发

- 本仓库的研究文档、报告与 scripts/ 下的脚本采用 **Apache-2.0**（见 LICENSE），可自由引用（引用请指明本仓库与 commit）。
- **vendor/ 下各子目录遵守其各自 LICENSE**（Apache-2.0 / MIT / AGPL-3.0-only 混合），与本仓库的 Apache-2.0 是两套独立许可。
- 顶层 [NOTICE](NOTICE) 汇总了 12 个样本的署名与义务，并逐条写明 AGPL-3.0 第 6/13 条与 Apache-2.0 第 4(d) 条的传递义务。
- **vendor/ 完整性可复核**：运行 `python scripts/vendor-hash.py --check`（算法与实现同文件，可自证）。
- 本仓库内容仅用于**安全研究与对照分析**；任何具体行为的合法性须结合授权范围、目标归属与所在法域自行判断，必要时咨询执业律师。

---

## 免责声明

本仓库是**对既有开源项目的研究记录**，不是攻击工具分发渠道。收录任何样本都不构成对其用途的认可。上游 dsh-purge 的开源版仅允许本地靶场使用（只放行回环与 RFC1918 私网），并明令禁止制作游戏外挂 —— 本仓库沿用该边界。
