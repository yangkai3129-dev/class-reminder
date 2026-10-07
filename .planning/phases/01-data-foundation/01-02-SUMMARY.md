---
phase: 01-data-foundation
plan: 02
subsystem: api
tags: [python, http.server, json, vanilla-js, apple-design, local-tool, rooms-crud]
requires:
  - phase: 01-data-foundation
    provides: "Walking Skeleton（JsonStore 原子写 / ReminderHandler 路由 / 静态白名单）+ 档案 CRUD API + Apple 单页 shell"
provides:
  - 教室名单 CRUD API（GET/POST/PUT/DELETE /api/rooms）+ validate_room 分类白名单校验
  - 教室视图（班课教室/VIP教室 分段控件 + 列表 + 空状态）+ 教室编辑器弹窗 + 教室删除确认
  - 教室号 textContent 渲染（XSS 安全），教室数据与档案同存 data.json
affects: [02 每日填写（ROOM-02 教室点选）, 03 生成与复制]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "validate_room 白名单校验 category ∈ {class,vip}，内部值固定英文 class/vip，UI 文案中文映射"
    - "教室号用 textContent 渲染，杜绝 innerHTML 注入（比 escapeHtml+innerHTML 更彻底）"
    - "分段控件样式：active #0066cc + 2px underline（::after），inactive #1d1d1f"

key-files:
  created: []
  modified:
    - class_reminder.py
    - static/index.html
    - static/app.js
    - static/style.css

key-decisions:
  - "category 内部值固定 class/vip（不存中文），中文文案「班课教室」「VIP教室」仅存在于前端映射，与 01-01 的 PLACEHOLDERS 前后端一致原则对齐"
  - "分段控件样式落地到 style.css（计划 files_modified 未列 style.css，但无此样式分段控件无法渲染，属必要补充）"

patterns-established:
  - "room 渲染用 textContent 而非 innerHTML，从源头防 XSS"
  - "分段控件 Apple 样式（active #0066cc + 2px underline）"

requirements-completed: [ROOM-01]

# Metrics
duration: 2min
completed: 2026-10-07
---

# Phase 1 Plan 2: 教室名单 CRUD Summary

**教室名单 CRUD：班课教室/VIP教室 两类教室号的增/删/改 API 与 Apple 分段控件界面，与档案同存 data.json 原子写持久化**

## Performance

- **Duration:** 2 min
- **Started:** 2026-10-07T08:29:37Z
- **Completed:** 2026-10-07T08:31:43Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- 教室名单 API 全链路：`GET/POST/PUT/DELETE /api/rooms`，`validate_room` 校验 number 非空 + category 白名单（class/vip），复用 JsonStore 原子写
- 教室视图：分段控件「班课教室」「VIP教室」（active #0066cc + 2px 蓝下划线）、按分类过滤的教室号列表、每类空状态
- 教室编辑器弹窗：添加/编辑两种模式，教室号 + 类型分段控件（可跨分类移动教室号），内联校验「教室号不能为空。」
- 教室删除确认：复用 confirm-modal，「删除教室」+「确定删除教室号「{号码}」吗？」
- 教室号用 `textContent` 渲染（XSS 安全），数据与档案同存 data.json，重启后仍在（已实测跨重启持久化）

## Task Commits

Each task was committed atomically:

1. **Task 1: 教室 API —— GET/POST/PUT/DELETE /api/rooms + 分类校验** - `426f370` (feat)
2. **Task 2: 教室视图 + 编辑器 + 删除确认（分段控件 / 空状态 / 校验）** - `2e8d7c5` (feat)

**Plan metadata:** 见最终 docs commit（含 SUMMARY.md + STATE/ROADMAP/REQUIREMENTS）

## Files Created/Modified

- `class_reminder.py` - 新增 `new_room` / `validate_room` + `do_POST/PUT/DELETE` 的 `/api/rooms` 路由
- `static/index.html` - 填充 `rooms-view`（header + 分段控件 + 列表 + 空状态）+ 新增 `room-editor` 模态弹窗
- `static/app.js` - `renderRooms` / `renderRoomRow` / `openRoomEditor` / `switchRoomCategory` + 教室删除确认分支 + 事件绑定
- `static/style.css` - 分段控件样式（.segmented/.seg-tab）+ `.room-number`

## Decisions Made

- `category` 内部值固定 `class`/`vip`（不存中文），中文文案「班课教室」「VIP教室」只存在于前端映射层
- 分段控件样式落地到 `style.css`（计划 files_modified 未列此文件，但无样式分段控件无法按 Apple 规范渲染）

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] 新增分段控件 + 教室号样式到 style.css**
- **Found during:** Task 2（教室视图 + 编辑器）
- **Issue:** 计划的 `files_modified` 与 task `<files>` 只列了 index.html 和 app.js，但分段控件「班课教室/VIP教室」的 Apple 样式（active #0066cc + 2px 蓝下划线）在现有 style.css 中不存在；不补样式分段控件无法渲染，UI 契约无法落地
- **Fix:** 在 static/style.css 新增 `.segmented` / `.seg-tab`（active 态用 ::after 画 2px 蓝下划线）与 `.room-number`
- **Files modified:** static/style.css
- **Verification:** 浏览器静态资源断言通过（`/style.css` 正常服务，分段控件样式类存在）
- **Committed in:** `2e8d7c5`（Task 2 commit）

---

**Total deviations:** 1 auto-fixed（1 missing critical）
**Impact on plan:** 纯样式补充，无范围蔓延，是 UI 契约落地所必需。

## Issues Encountered

无

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 教室名单 CRUD 契约（`validate_room` / Room 数据模型 `{id, number, category}` / `/api/rooms` 路由）已建立，Phase 2 的 ROOM-02（教室点选）可直接复用 `GET /api/rooms` 按 category 分组
- app.js 已提供 `renderRooms` / `switchRoomCategory` 复用点
- data.json 已含 `rooms` 数组，与 `profiles` 同文件持久化
- 无阻塞项

---

*Phase: 01-data-foundation*
*Completed: 2026-10-07*

## Self-Check: PASSED

- Source files present: class_reminder.py, static/index.html, static/app.js, static/style.css
- SUMMARY.md present
- Commits 426f370 / 2e8d7c5 verified in git log
