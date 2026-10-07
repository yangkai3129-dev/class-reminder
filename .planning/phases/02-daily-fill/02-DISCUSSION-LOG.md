# Phase 2: 每日填写 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-07
**Phase:** 02-daily-fill
**Areas discussed:** 预填作用域, 确认后推进, 直接输入形态, 边界容错

---

## 预填作用域

| Option | Description | Selected |
|--------|-------------|----------|
| 每学生各自记住 | 每个学生自己的一套时间/教室/老师，打开谁带出谁的上一套；data.json 每档案加 last 字段 | ✓ |
| 全局最后一次 | 全局只存一套最近填写的值，打开谁都预填这套 | |

**User's choice:** 每学生各自记住（用户明确纠正：不是全局上一次，是每个学生各自的上一次填写记录）
**Notes:** 符合「课表大多不变」的初衷；需要给每个档案加 `last_time`/`last_room`/`last_teacher` 字段。

---

## 确认后推进

| Option | Description | Selected |
|--------|-------------|----------|
| 自动跳下一个 | 确认存值后自动打开下一个学生 | |
| 返回列表 | 确认存值后回列表，由用户自己选下一个 | ✓ |

**User's choice:** 返回列表
**Notes:** 更可控，每天几十个学生时用户自己掌握节奏。

---

## 直接输入形态

### 时间
| Option | Description | Selected |
|--------|-------------|----------|
| 两个 HH:MM 框 | 开始、结束各一个文本框，对应滚轮两段结构 | ✓ |
| 一个自由文本 | 一个框自由输如「9:00-10:30」 | |

### 教室
| Option | Description | Selected |
|--------|-------------|----------|
| 自由文本输入 | 直接打字输教室号，不弹名单 | ✓ |
| 输入即过滤 | 从名单选但输入文字即过滤 | |

**User's choice:** 时间 = 两个 HH:MM 框；教室 = 自由文本输入
**Notes:** 无。

---

## 边界容错

### 教室号被删
| Option | Description | Selected |
|--------|-------------|----------|
| 留空重选 | 上次教室号已不在名单 → 字段留空重选 | ✓ |
| 保留旧号 | 仍带出旧号 | |

### 非整点时间
| Option | Description | Selected |
|--------|-------------|----------|
| 就近吸附 | 滚轮就近吸附到 15 分钟档（9:05→9:00），确认覆盖 | ✓ |
| 该字段例外用文本框 | 非整点值自动用文本框保留精确值 | |

**User's choice:** 留空重选；就近吸附
**Notes:** 无。

---

## Claude's Discretion

- last 字段命名与 schema 细节
- 双滚轮实现方式
- 时间校验规则
- 旧档案缺 last 字段的向后兼容

## Deferred Ideas

None.
