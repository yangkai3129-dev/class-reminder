# Phase 3: 生成与复制 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-08
**Phase:** 3-生成与复制
**Areas discussed:** 核对文案可编辑性, 复制成功后的去向, 复制失败的降级, 空字段渲染边界

---

## 核对文案可编辑性

| Option | Description | Selected |
|--------|-------------|----------|
| 只读预览 | 弹窗只展示渲染结果，不可直接改。改字回字段/档案。避免误改模板固定文字。 | ✓ |
| 可内联编辑 | 弹窗里直接改最后文案再复制，改动只影响这一次（不写回模板/字段）。 | |

**User's choice:** 只读预览
**Notes:** 无后续追问。

---

## 复制成功后的去向

| Option | Description | Selected |
|--------|-------------|----------|
| 提示+返回列表 | 显示「已复制」提示，短暂停留后自动关弹窗回列表。 | |
| 提示+停留弹窗 | 提示「已复制」，弹窗停留，同事自己点「完成」关闭回列表。 | ✓ |
| 自动切下一个学生 | 复制成功后自动打开下一个学生。与 Phase 2「不自动跳下一个」冲突。 | |

**User's choice:** 提示+停留弹窗
**Notes:** 「完成」按钮的具体形态交由 Claude 裁量。

---

## 复制失败的降级

| Option | Description | Selected |
|--------|-------------|----------|
| 全选+手动 Cmd+C | 失败时自动全选文案，提示「请按 ⌘C 手动复制」。 | ✓ |
| 只提示错误 | 失败只弹「复制失败」，不做兜底。 | |

**User's choice:** 全选+手动 Cmd+C
**Notes:** 技术上优先 `navigator.clipboard`，失败再走兜底。

---

## 空字段渲染边界

| Option | Description | Selected |
|--------|-------------|----------|
| 拦截并提示补全 | 确认时校验「模板里出现的占位符必须有值」，空则标红、不让进核对弹窗。 | ✓ |
| 渲染成空 | 允许进核对，空占位符替换成空字符串，文案里留白。 | |
| 保留占位符原文 | 允许进核对，空处保留 `{教室号}` 字样。 | |

**User's choice:** 拦截并提示补全
**Notes:** 主要针对点选模式未点教室号；现有代码只在直接输入模式拦空教室，需补上。

---

## Claude's Discretion

- 「完成」按钮形态（「确认复制」成功后切换为「完成」，或另起完成按钮）。
- 核对弹窗标题是否显示学生姓名（建议显示）。
- 只读预览渲染方式（建议 `white-space: pre-wrap` 保留换行与 emoji）。
- 复制技术链：`navigator.clipboard.writeText` → `execCommand('copy')` → 全选手动 ⌘C。

## Deferred Ideas

None — 讨论未超出阶段范围。
