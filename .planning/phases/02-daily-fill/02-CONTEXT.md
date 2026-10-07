# Phase 2: 每日填写 - Context

**Gathered:** 2026-10-07
**Status:** Ready for planning

## Phase Boundary

打开某学生，确认/微调「时间」「教室号」「老师」三个字段，并带出该学生上一次填写的值。确认后存值并返回列表。全局「点选/滚轮 ⇄ 直接输入」开关作用于时间、教室两字段。**不含**：核对弹窗与剪贴板复制（Phase 3）。

## Implementation Decisions

### 预填作用域
- **D-01:** 「上一次的值」按**每个学生各自记住**（不是全局最后一次）。`data.json` 每个档案需新增 `last_time` / `last_room` / `last_teacher` 三个字段；打开谁就带出谁的那套。

### 确认后推进
- **D-02:** 点「确认」校验并存值后**返回学生列表**，不自动跳下一个学生。

### 直接输入形态（全局开关切到「直接输入」时）
- **D-03:** 时间 = 开始、结束**两个 HH:MM 文本框**（对应滚轮的两段结构）。
- **D-04:** 教室 = **自由文本输入**（直接打字，不弹名单）。

### 边界容错
- **D-05:** 预填时若该学生上次教室号已不在名单里 → **教室字段留空**，重新选/输当前名单里的教室。
- **D-06:** 存储的时间值非 15 分钟整数倍（如 9:05）且当前在滚轮模式 → **就近吸附**到最近的 15 分钟档位（9:05→9:00），确认后覆盖为该档位值。

### Claude's Discretion
- `last_time`/`last_room`/`last_teacher` 的字段命名与 data.json schema 细节。
- 双滚轮的具体实现方式（原生滚动容器 vs 自定义控件）。
- 时间校验的具体规则（HH:MM 格式、结束 > 开始等）。
- 旧档案缺 last 字段时的向后兼容处理（视为空，不报错）。

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求与路线
- `.planning/ROADMAP.md` — Phase 2 goal + 5 条 success criteria
- `.planning/REQUIREMENTS.md` — FILL-01 / FILL-02 / FILL-03 / FILL-04 / ROOM-02

### 设计系统
- `.planning/phases/01-data-foundation/01-UI-SPEC.md` — Phase 1 设计 token 基线（颜色/字体/间距/阴影/圆角）
- `.planning/phases/02-daily-fill/02-UI-SPEC.md` — Phase 2 UI 契约（双滚轮、分组点选、全局切换、22 条 copy、字段渲染规则）

### 决策与状态
- `.planning/PROJECT.md` — 已锁定决策（双滚轮、名单点选、老师手打、全局切换、默认带出）
- `.planning/STATE.md` — 项目当前状态

## Existing Code Insights

### Reusable Assets
- `static/style.css` — 已有 CSS 自定义属性（`--accent` #0066cc、`--bg` #ffffff、`--parchment` #f5f5f7）与组件类（`.segmented` 分段控件、`.btn-primary`、`.input`、`.chip`）。
- `static/app.js` — `api()` fetch helper、`state.profiles`/`state.rooms`、`renderProfiles`/`renderRooms`、`switchRoomCategory`。
- `class_reminder.py` — `JsonStore`（原子写）、`/api/profiles`、`/api/rooms` CRUD。

### Established Patterns
- 分段控件 `.segmented`（Phase 1 教室分类已用）→ 可复用于全局「点选/滚轮 ⇄ 直接输入」开关。
- `confirm-modal` 删除确认弹窗模式。
- `data.json` 原子写（`.tmp` + `os.replace`）。

### Integration Points
- `data.json` 的 `profiles[]` 需新增 `last_time`/`last_room`/`last_teacher` 三字段（向后兼容：旧档案缺字段视为空）。
- 持久化 last 值 → 扩展现有 `PUT /api/profiles/<id>` 或新增端点。
- 前端新增「填写」视图（UI-SPEC 的 View 6），入口 = 点档案行打开（非「编辑」）。

## Specific Ideas

- 真实模板样例见 PROJECT.md「Context」：固定文案 + `{时间}`（如 9:00-10:30）、`{教室号}`（如 2802）、`{老师}`（如 王国香）。

## Deferred Ideas

None — discussion stayed within phase scope.

---

*Phase: 2-daily-fill*
*Context gathered: 2026-10-07*
