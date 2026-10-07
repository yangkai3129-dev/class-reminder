# Phase 3: 生成与复制 - Context

**Gathered:** 2026-10-08
**Status:** Ready for planning

## Phase Boundary

点「确认」→ 弹出核对弹窗，把模板里的 `{时间}`/`{教室号}`/`{老师}` 占位符替换成当前值渲染出完整文案；弹窗提供「修改」（回填写视图）与「确认复制」（复制进系统剪贴板）。同事随后手动粘贴进企业微信客户群。**不含**：微信 API 自动发送、批量生成、历史已发记录（均属其他阶段）。

## Implementation Decisions

### 核对文案形态
- **D-01:** 核对弹窗里的完整文案是**只读预览**，不可直接改字。要改字走「修改」回填写视图改三个字段，或回「编辑档案」改模板固定文字。避免误改模板固定文字，符合「确认默认值」定位。

### 复制成功后的去向
- **D-02:** 复制成功后**弹窗停留**，显示「已复制到剪贴板」提示；同事点「完成」关闭弹窗并返回学生列表（**不**自动跳下一个学生，延续 Phase 2 D-02）。

### 复制失败的降级
- **D-03:** 剪贴板复制失败时，**自动全选渲染文案并提示「请按 ⌘C 手动复制」**，确保核心动作「复制」永不卡死。

### 空字段渲染边界
- **D-04:** 点「确认」时校验「模板里出现的每个占位符都必须有非空值」，空则标红提示、**不让进核对弹窗**。现有代码只在「直接输入」模式拦空教室，点选模式未拦——需补上。发出去的文案不能缺字段（核心价值「少错一个字」）。

### 确认按钮行为变化
- **D-05:** Phase 2 的「确认 → 校验+存值 → 回列表」改为「确认 → 校验+存值 → 打开核对弹窗」。「修改」关弹窗回填写视图（已填值保留、不丢）；「确认复制」只复制进剪贴板（存值已在确认时完成，不再重复存）。

### Claude's Discretion
- 「完成」按钮的具体形态（「确认复制」成功后按钮切换为「完成」，或另起一个完成按钮）。
- 核对弹窗标题是否显示学生姓名（建议显示，帮助同事确认在给谁发）。
- 只读预览的渲染方式（建议 `white-space: pre-wrap` 原样保留换行与 emoji）。
- 复制技术链：优先 `navigator.clipboard.writeText`，失败回退 `document.execCommand('copy')`，再失败走 D-03 的全选手动 ⌘C 兜底。

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求与路线
- `.planning/ROADMAP.md` — Phase 3 goal + 3 条 success criteria + COPY-01/02/03
- `.planning/REQUIREMENTS.md` — COPY-01 / COPY-02 / COPY-03

### 决策与状态
- `.planning/PROJECT.md` — 已锁定决策（形态、占位符、无微信集成）+ Context 里的真实模板样例
- `.planning/STATE.md` — 项目当前状态

### 设计系统与前置契约
- `.planning/phases/01-data-foundation/01-UI-SPEC.md` — Phase 1 设计 token 基线（颜色/字体/间距/阴影/圆角）
- `.planning/phases/02-daily-fill/02-UI-SPEC.md` — Phase 2 UI 契约（填写视图、双滚轮、分组点选、全局切换、字段渲染规则）
- `.planning/phases/02-daily-fill/02-CONTEXT.md` — Phase 2 实现决定（D-01~D-06，其中 D-02「确认后返回列表」、D-05/D-06 边界容错与本阶段衔接）

## Existing Code Insights

### Reusable Assets
- `static/app.js` — `escapeHtml()`、`renderPreview()`（占位符→值替换逻辑，当前用硬编码 `SAMPLE_VALUES`，本阶段改用真实 `last_*` 值）、`api()` fetch helper、`handleFillConfirm()`（现有确认入口）、`showView()`。
- `static/app.js` — 现有 `confirm-modal`（删除确认）弹窗模式，可复用/仿建核对弹窗。
- `static/style.css` — `.modal` / `.modal-backdrop` / `.modal-actions` 弹窗样式、`.btn-primary`、设计 token（`--accent` #0066cc 等）。
- `class_reminder.py` — `JsonStore`（原子写）、`/api/profiles/<id>/fill` 存值端点、`PLACEHOLDERS` 常量。

### Established Patterns
- `renderPreview()` 的 `template.split(token).join(value)` 替换模式可直接用于「占位符替换成当前值」。
- 数据原子写（`.tmp` + `os.replace`）、`profiles[]` 的 `last_time`/`last_room`/`last_teacher` 三字段。
- 无第三方依赖、单文件服务器 bind 127.0.0.1（localhost 属 secure context，`navigator.clipboard` 可用）。

### Integration Points
- `handleFillConfirm()` 是入口：Phase 3 把它从「存值+回列表」改为「校验+存值+打开核对弹窗」，并补上点选模式空教室校验（D-04）。
- 核对弹窗渲染文本 = `profile.template` 用当前 `last_time`/`last_room`/`last_teacher` 替换 `{时间}`/`{教室号}`/`{老师}`。
- 复制动作：`navigator.clipboard.writeText(renderedText)`，失败按 D-03 兜底。
- 「修改」= 关弹窗、`showView("fill")`（填写视图 DOM 里的值保留，无需重渲染）。

## Specific Ideas

- 真实模板样例（PROJECT.md「Context」）：固定文案 + `{时间}`（如 9:00-10:30）、`{教室号}`（如 2802）、`{老师}`（如 王国香），含 emoji 与换行。核对预览须原样保留换行与 emoji。

## Deferred Ideas

None — 讨论未超出阶段范围。

---

*Phase: 3-generate-copy*
*Context gathered: 2026-10-08*
