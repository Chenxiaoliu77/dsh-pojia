# AGENTS.md

本仓库是 DSH「破甲」（安全对齐绕过 / 越狱）机制的研究仓库。
主报告见 `docs/破甲机制研究报告.md`；`vendor/` 下是 12 个**只读**生态样本（未安装、未启用、未改宿主）。
给 agent 的工作约定与仓库文档索引在下面。

## 仓库要点

- **只读逆向的结论优先**：主报告区分「代码确证」（带 `path:line`）与「README 声称」。
- **`vendor/` 是样本不是依赖**：不要 `npm install`、不要执行 `postinstall`、不要把其中内容当作运行时依赖引入。
- **本机宿主不得被改动**：调研期间 DSH `0.2.1-rc.5` 保持原样；任何破甲样本的启用都不在本仓库范围内。
- **中国法引用须标版本与时效**：网络安全法修正案 2025-10-28 通过、**2026-01-01 施行**；禁侵条款是**第 29 条**（旧版第 27 条）。条号位移规则：旧第 3–19 条 +1，旧第 20–62 条 +2，旧第 63 条起 +3。官方核对证据见 `docs/research/law-verification.md`。
- **本仓库自身许可与 vendor/ 分离**：本仓库文档与 `scripts/` 走根目录 Apache-2.0（LICENSE + NOTICE）；`vendor/` 内各子目录遵守其上游条款，AGPL-3.0 样本的传递义务见根 NOTICE。
- **vendor 完整性可复核**：改动 `vendor/` 后必须跑 `python scripts/vendor-hash.py --check`；该脚本同时是算法说明与实现，manifest 不可手改。

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles, using their default label strings. See `docs/agents/triage-labels.md`.

### Domain docs

This repo's domain-doc layout is single-context: one `GLOSSARY.md` at the repo root, with architecture decisions in `docs/adr/`. See `docs/agents/domain.md`.
