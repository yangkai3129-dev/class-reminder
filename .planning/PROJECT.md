# class-reminder

## What This Is

给教培机构全职同事用的本地小工具：为每个学生/班级建一份自定义文案的上课提醒模板，每天只需确认或微调「上课时间」「教室号」「老师姓名」三个空，点确认即把完整文案复制到剪贴板，同事手动粘贴进企业微信客户群。形态是"排课脚本式"的本地程序——Python 脚本 + 浏览器界面，不碰微信 API、不是苹果原生 app、无签名无到期。

## Core Value

把「每天给每个学生编一条明日上课提醒」从「手敲文案」降到「确认默认值 + 一键复制」——每天几十个学生，每人少花几秒钟、少错一个字。

## Requirements

### Validated

- ✓ 同事能为新学生/班级建档案，档案含一段自定义模板（固定文字 + `{时间}`、`{教室号}`、`{老师}` 三个占位符）— Phase 1
- ✓ 同事能编辑、删除已有档案 — Phase 1
- ✓ 同事能维护教室号名单，教室分「班课教室」「VIP教室」两类（增/删/改）— Phase 1

### Active

- [ ] 同事打开某学生时，`{时间}`、`{教室号}`、`{老师}` 已预填该学生上一次的值
- [ ] 同事用苹果式「开始时间 + 结束时间」滚轮修改时间；教室号从名单点选
- [ ] 同事能手打老师姓名
- [ ] 同事能通过全局开关在「点选/滚轮」与「直接输入」间切换（作用于时间、教室两字段）
- [ ] 同事点确认后弹出核对弹窗，显示完整渲染文案
- [ ] 核对弹窗提供「修改」（返回编辑）和「确认」（复制到剪贴板）两个选项
- [ ] 确认后完整文案进入系统剪贴板，可直接粘贴进企业微信

### Out of Scope

- 企业微信 API 自动发送 — 客户群需管理员建自建应用+权限，且用户明确要手动粘贴
- 多用户/云端同步 — v1 单机单人使用
- 手机版 — 二期
- 苹果原生 app / 签名分发 — 用户明确不要（避免使用期限）
- 一次批量生成多个学生的文案 — v1 一次一个学生

## Context

- 用户在新航道兼职，同事是教培机构全职，每天要在企业微信客户群发「明日上课提醒」
- 真实模板样例（用户提供）：固定文案为「📮 【明日上课提醒】… 📮 上课地点：合生汇28楼{教室号} … 🗒 上课时间&课程： 【{时间}】海生2册@{老师} … 收到回复哈[玫瑰]明天见呀[爱心]」，每天变 `{教室号}`（如 2802）、`{时间}`（如 9:00-10:30）、`{老师}`（如 王国香）
- 每个学生的固定文案不同（课程名那行各异），但建档后不变
- 兄弟项目 kebiao-tools 同为「Python 脚本 + 浏览器界面」式，是形态参照
- UI 须遵守用户全局 Apple 设计规范（白色/羊皮纸底、#0066cc 唯一强调色、SF 字体、8px 网格、无渐变、整页单一阴影、正文 17px/1.47 行高）

## Constraints

- **Tech stack**: Python 3 标准库 + 本地 HTTP 服务 + HTML/CSS/JS + JSON 文件存储 — 零第三方依赖、无签名、无到期（像 kebiao-tools）
- **平台**: Mac 优先；数据存本地 JSON 文件，可直接复制给下一位同事
- **UI**: 遵守全局 Apple 设计规范
- **无微信集成**: 不接企业微信/微信任何 API，发送靠手动粘贴

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 形态 = Python 脚本 + 本地网页，而非苹果原生 app | 用户要求"不是苹果 app、无使用期限" | — Pending |
| 时间字段 = 「起-止」两段，苹果事件式双滚轮 | 真实文案为 9:00-10:30，且用户确认总是两段 | — Pending |
| 教室号 = 固定名单点选，分「班课教室」「VIP教室」两类 | 用户确认；名单细节做到时再给 | — Pending |
| 新增 `{老师}` 占位符，手打、无名单 | 用户确认；老师姓名是第三个每日字段 | — Pending |
| 全局「点选/滚轮 ⇄ 直接输入」切换 | 用户确认；作用于时间、教室，老师始终手打 | — Pending |
| 时间/教室/老师默认带出上一次的值 | 用户确认；课表大多不变，加快每日流程 | — Pending |
| 服务器只 bind 127.0.0.1 | 零第三方依赖、无鉴权的单用户本地工具，本机回环即安全边界 | ✓ 落地 Phase 1 |
| 教室分类内部值存 `class`/`vip`（不存中文） | 数据层稳定，中文「班课教室」「VIP教室」仅前端映射 | ✓ 落地 Phase 1 |
| 新增 `--no-browser` 启动参数 | 供自动化验证/CI 抑制浏览器弹窗，默认仍自动打开 | ✓ 落地 Phase 1 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-07 after Phase 1*
