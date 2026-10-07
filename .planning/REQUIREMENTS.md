# Requirements: class-reminder

**Defined:** 2026-10-07
**Core Value:** 把「每天给每个学生编一条明日上课提醒」从「手敲文案」降到「确认默认值 + 一键复制」

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### 档案管理 (PROF)

- [x] **PROF-01**: 同事能为新学生/班级创建档案，档案含一段自定义模板（固定文字 + `{时间}`、`{教室号}`、`{老师}` 三个占位符）
- [x] **PROF-02**: 同事能编辑已有档案的模板文字
- [x] **PROF-03**: 同事能删除已有档案

### 教室名单 (ROOM)

- [x] **ROOM-01**: 同事能维护固定教室号名单，教室分「班课教室」「VIP教室」两类（添加/编辑/删除）
- [x] **ROOM-02**: 同事能从教室名单点选教室号（两类分组显示），无需手输

### 每日填写 (FILL)

- [x] **FILL-01**: 同事打开某学生时，`{时间}`、`{教室号}`、`{老师}` 已预填该学生上一次的值
- [x] **FILL-02**: 同事能用苹果式「开始时间 + 结束时间」滚轮选择上课时间
- [x] **FILL-03**: 同事能手打老师姓名
- [x] **FILL-04**: 同事能通过全局开关在「点选/滚轮」与「直接输入」之间切换，作用于时间、教室两字段（老师始终手打）

### 生成与复制 (COPY)

- [x] **COPY-01**: 同事点「确认」后弹出核对弹窗，显示完整渲染文案
- [x] **COPY-02**: 核对弹窗提供「修改」（返回编辑）与「确认复制」（复制到剪贴板）两个选项
- [x] **COPY-03**: 确认复制后完整文案进入系统剪贴板，可直接粘贴进企业微信客户群

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### 移动端

- **MOBILE-01**: 手机/平板也能使用

### 批量

- **BATCH-01**: 一次批量生成多个学生的文案

### 微信集成

- **WECHAT-01**: 企业微信 API 自动发送（需管理员建自建应用 + 客户联系权限）

### 同步

- **SYNC-01**: 多用户 / 云端同步

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| 苹果原生 app / 签名分发 | 用户明确不要，避免签名/证书使用期限 |

## Traceability

Which phases cover which requirements. Filled during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROF-01 | Phase 1 | Complete |
| PROF-02 | Phase 1 | Complete |
| PROF-03 | Phase 1 | Complete |
| ROOM-01 | Phase 1 | Complete |
| ROOM-02 | Phase 2 | Complete |
| FILL-01 | Phase 2 | Complete |
| FILL-02 | Phase 2 | Complete |
| FILL-03 | Phase 2 | Complete |
| FILL-04 | Phase 2 | Complete |
| COPY-01 | Phase 3 | Complete |
| COPY-02 | Phase 3 | Complete |
| COPY-03 | Phase 3 | Complete |

**Coverage:**
- v1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0 ✓

---
*Requirements defined: 2026-10-07*
*Last updated: 2026-10-07 after roadmap creation*
