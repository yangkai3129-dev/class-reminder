---
phase: 01-data-foundation
plan: 01
subsystem: api
tags: [python, http.server, json, vanilla-js, apple-design, local-tool]

# Dependency graph
requires: []
provides:
  - Walking Skeleton：Python 3 标准库本地 HTTP 服务（ThreadingHTTPServer）+ JsonStore 原子写
  - 档案 CRUD API（GET/POST/PUT/DELETE /api/profiles）+ 静态白名单服务
  - Apple 风格单页界面（240px 羊皮纸侧边栏 + 白色内容区 + 档案编辑器/删除确认弹窗）
  - 前端 XSS 防护模式（templateToHtml 先全量转义再仅白名单 token 回插 chip）
affects: [01-02 教室名单, 02 每日填写, 03 生成与复制]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JsonStore：load 缺失/损坏回退空 schema，save 用 data.json.tmp + os.replace 原子写"
    - "静态路由白名单（STATIC_ROUTES）防路径穿越，绝不拼接用户路径读盘"
    - "模板渲染：escapeHtml 全量转义 + 仅 {时间}/{教室号}/{老师} 白名单 token 替换为 chip span"
    - "占位符常量 PLACEHOLDERS 单点定义，前后端一致"

key-files:
  created:
    - class_reminder.py
    - static/index.html
    - static/style.css
    - static/app.js
    - .gitignore
  modified: []

key-decisions:
  - "服务器只 bind 127.0.0.1（--host 默认 loopback），零第三方依赖、无签名无到期"
  - "新增 --no-browser 启动参数，供自动化验证/CI 避免弹出浏览器（不影响默认 webbrowser.open 行为）"
  - "name 校验失败用「学生/班级名称不能为空。」（计划只给了占位符错误文案，name 非空是计划要求的校验项）"

patterns-established:
  - "原子写持久化：JsonStore.save() 先写 .tmp 再 os.replace"
  - "前端 XSS 防护：先转义再白名单回插"
  - "零依赖部署：单脚本 + static/ 目录，可整目录拷贝给下一位同事"

requirements-completed: [PROF-01, PROF-02, PROF-03]

# Metrics
duration: 4min
completed: 2026-10-07
---

# Phase 1 Plan 1: 数据底座 — Walking Skeleton + 档案 CRUD Summary

**Python 3 标准库本地 HTTP 服务 + Apple 风格单页档案管理（建/改/删含 {时间}/{教室号}/{老师} 占位符模板），JSON 原子写持久化到 data.json**

## Performance

- **Duration:** 4 min
- **Started:** 2026-10-07T08:21:35Z
- **Completed:** 2026-10-07T08:25:48Z
- **Tasks:** 3
- **Files modified:** 5 (4 源码 + .gitignore)

## Accomplishments

- Walking Skeleton：`python3 class_reminder.py` 一条命令启动本地服务并自动打开浏览器
- 档案 CRUD 全链路：POST 创建、GET 列表、PUT 编辑、DELETE 删除，均持久化到 data.json，重启仍在
- 模板编辑器：contenteditable 编辑器 + 三个占位符 chip 插入按钮 + 实时预览（样例值替换）
- 校验与错误态：无占位符/空名称返回 400 中文文案；保存失败显示「保存失败：数据没有写进文件…」
- Apple 设计规范落地：240px 羊皮纸侧边栏、#0066cc 唯一强调色、8px 网格、无渐变无阴影、17px/1.47 正文

## Task Commits

Each task was committed atomically:

1. **Task 1: 搭建 stdlib 服务器 + JSON 存储 + 静态 shell** - `d2b7323` (feat)
2. **Task 2: 档案创建切片（POST + 编辑器弹窗 + 列表渲染）** - `e131fa5` (feat)
3. **Task 3: 档案编辑/删除 + 空状态 + 校验错误态** - `b010466` (feat)

**Plan metadata:** 见最终 docs commit（含 SUMMARY.md + STATE/ROADMAP/REQUIREMENTS）

## Files Created/Modified

- `class_reminder.py` - HTTP 服务 + JsonStore（原子写）+ ReminderHandler（GET/POST/PUT/DELETE /api/profiles + 静态白名单）
- `static/index.html` - SPA shell（侧边栏 + 档案视图 + 编辑器弹窗 + 删除确认弹窗）
- `static/style.css` - Apple 设计 tokens（#0066cc / #f5f5f7 / -apple-system，8px 网格，无渐变无阴影）
- `static/app.js` - fetch 封装 + 渲染 + 编辑器交互（renderProfiles/templateToHtml/serializeComposer/openProfileEditor/openDeleteConfirm）
- `.gitignore` - 忽略 data.json 与 __pycache__/

## Decisions Made

- 服务器默认 bind `127.0.0.1`（不绑 0.0.0.0），以 loopback 作为安全边界（无鉴权单用户本地工具）
- 新增 `--no-browser` 启动参数用于自动化验证/CI，默认仍自动打开浏览器
- name 校验失败返回「学生/班级名称不能为空。」，补齐计划要求但未给出文案的校验分支

## Deviations from Plan

### Auto-fixed Issues

无（计划原样执行，仅两处无实质偏离的补充，见下）。

**1. [决策 - 补充] 新增 `--no-browser` 启动参数**
- **Found during:** Task 1（服务器 main()）
- **Issue:** 计划要求 main() 无条件 `webbrowser.open`，自动化验证会反复弹出浏览器窗口干扰用户
- **Fix:** 增加 `--no-browser` 标志，验证脚本用它抑制弹窗；默认行为不变
- **Files modified:** class_reminder.py
- **Committed in:** d2b7323（Task 1）

**2. [决策 - 补充] name 空值校验文案**
- **Found during:** Task 2（validate_profile）
- **Issue:** 计划要求 `name.strip()` 非空但只给了占位符错误文案
- **Fix:** 补充「学生/班级名称不能为空。」，与占位符文案并列
- **Files modified:** class_reminder.py
- **Committed in:** e131fa5（Task 2）

---

**Total deviations:** 2 补充（非 bug 修复，属完善性）
**Impact on plan:** 无范围蔓延，均为使计划验收更完整/验证更无扰的必要补充。

## Issues Encountered

无

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 档案 CRUD 契约（JsonStore / API 路由 / Profile 数据模型 / PLACEHOLDERS / 静态白名单）已建立，01-02 教室名单 CRUD 可直接复用
- app.js 已预留 `renderRooms` / `openRoomEditor` / `openDeleteConfirm(kind, item)` 复用点（rooms-view 留空待填）
- 无阻塞项

---

*Phase: 01-data-foundation*
*Completed: 2026-10-07*

## Self-Check: PASSED

- All source files present (class_reminder.py, static/{index.html,style.css,app.js}, .gitignore)
- SUMMARY.md present
- Commits d2b7323 / e131fa5 / b010466 verified in git log

