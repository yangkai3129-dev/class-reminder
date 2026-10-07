---
phase: 03-generate-copy
plan: 02
subsystem: ui
tags: [clipboard, copy, legacy-copy, execCommand, fallback, vanilla-js]

# Dependency graph
requires:
  - phase: 03-generate-copy
    provides: copy-modal overlay, writeText primary path, selectRenderedText/showCopyStatus helpers, renderedText/copyDone state (03-01)
provides:
  - legacyCopy(text) execCommand('copy') offscreen-textarea fallback (readonly + left:-9999px + finally remove)
  - three-tier copy chain: writeText -> execCommand('copy') -> manual ⌘C full-select (D-03 never-dead-end)
affects: [03-generate-copy]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "offscreen readonly textarea for execCommand('copy') fallback (never display:none)"
    - "three-tier clipboard degradation (writeText -> execCommand -> selectNodeContents + manual ⌘C)"
    - "modal state reset on every open (copyDone=false + button label + status line)"

key-files:
  created: []
  modified:
    - static/app.js

key-decisions:
  - "execCommand('copy') 用 offscreen readonly textarea（position:fixed + left:-9999px 而非 display:none），finally 移除节点避免 DOM 残留"
  - "三级链序 writeText -> legacyCopy -> selectRenderedText + 手动提示，任一成功即停，复制永不卡死"

patterns-established:
  - "clipboard fallback textarea uses position:fixed + left:-9999px (offscreen), readonly attr, removeChild in finally"

requirements-completed: [COPY-03]

# Metrics
duration: 1min
completed: 2026-10-08
---

# Phase 3 Plan 2: 生成与复制 — 三级复制降级链（execCommand 降级 + D-03 手动兜底） Summary

**在 03-01 writeText 主路径之上补齐第二级 `document.execCommand('copy')` 隐藏 textarea 降级与第三级 D-03 手动 ⌘C 兜底，使「复制永不卡死」成为硬保证，并验收弹窗状态复位与选择正确性**

## Performance

- **Duration:** ~1 min (35s)
- **Started:** 2026-10-07T19:23:44Z
- **Completed:** 2026-10-08
- **Tasks:** 2
- **Files modified:** 1 (static/app.js)

## Accomplishments
- 新增 `legacyCopy(text)`：offscreen readonly textarea（`position:fixed` + `left:-9999px`，非 `display:none`）+ `execCommand('copy')`，`finally` 内移除节点，返回 boolean
- `handleCopyConfirm` 升级为三级链：`writeText` 失败 → `legacyCopy(renderedText)` → 仍失败才 `selectRenderedText()` + 「请按 ⌘C 手动复制」红色提示
- 验收确认弹窗每次打开状态复位（`copyDone=false`、按钮文案「确认复制」、状态行清空隐藏）与两态样式（成功 text-secondary / 手动兜底 --danger）
- 验收确认复制动作只复制不重复 PUT（`handleCopyConfirm` 无任何 `api`/`fetch` 调用）

## Task Commits

Each task was committed atomically:

1. **Task 1: legacyCopy（execCommand 降级）+ 三级链整合** - `71f1278` (feat)
2. **Task 2: D-03 选择正确性 + 状态复位 + 全流程验收** - 无代码变更（verification-only）

**Plan metadata:** `[见 final commit]` (docs: complete plan)

## Files Created/Modified
- `static/app.js` - 新增 `legacyCopy(text)`（offscreen textarea + `execCommand('copy')` 降级）；`handleCopyConfirm` 在 writeText 失败后插入 `if (!ok) ok = legacyCopy(renderedText);` 完成三级链整合

## Decisions Made
- `execCommand('copy')` 回退用 offscreen readonly textarea（`position:fixed` + `left:-9999px`，规避 `display:none` 的历史兼容坑），`finally` 移除节点避免残留 DOM
- 三级链序保持 `writeText → legacyCopy → selectRenderedText + 手动提示`，任一成功即停，最终 D-03 手动兜底保证核心动作永不卡死

## Deviations from Plan

None - plan executed exactly as written.

（Task 2 为验收/核对任务：其四条 acceptance criteria（D-03 选择顺序、openCopyModal 三项状态复位、showCopyStatus 两态样式、handleCopyConfirm 无 api 调用）在 03-01 产物中均已满足，Task 1 改动未破坏它们，故 Task 2 无需新增代码变更，仅运行自动化验收断言确认通过。）

（环境备注：本次执行在项目主仓库 `main` 分支上直接进行。`config.json` 的 `branching_strategy` 为 `"none"`，git 历史直接提交到 `main`；`.git` 为目录而非 worktree 文件，故 worktree 隔离守卫按各自 `.git`-is-file 条件自动跳过。）

## Issues Encountered

None — backend 回归通过（`python3 class_reminder.py --no-browser --port 8124` 正常启动，`/api/profiles` 正常返回，服务出的 `/app.js` 已含 `function legacyCopy`）。

## User Setup Required

None - no external service configuration required. Zero new third-party dependencies (project-locked standard library + vanilla HTML/CSS/JS).

## Next Phase Readiness
- 03-02 为 Phase 3 的最后一个计划，至此 COPY-01 / COPY-02 / COPY-03 全部落地，Phase 3「生成与复制」完成
- 「复制永不卡死」三级降级链完整：writeText → execCommand('copy') → 手动 ⌘C 全选兜底
- 后续若需批量生成 / 微信 API 自动发送 / 历史已发记录，均属其他阶段，本阶段未实现

---
*Phase: 03-generate-copy*
*Completed: 2026-10-08*

## Self-Check: PASSED

- SUMMARY.md exists: FOUND
- Task 1 commit `71f1278` exists: FOUND
- Task 2 (verification-only, no code change) — automated assertions pass
