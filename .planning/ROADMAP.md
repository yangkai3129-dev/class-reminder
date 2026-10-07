# Roadmap: class-reminder

## Overview

一个给教培机构同事用的本地小工具，把「每天给每个学生编一条明日上课提醒」从手敲文案降到「确认默认值 + 一键复制」。分三个阶段交付：先搭起本地程序并让同事能维护学生档案与教室名单，再实现每日填写（预填 + 滚轮/点选 + 老师手打 + 全局切换），最后交付一键核对与复制进剪贴板。

## Phases

- [x] **Phase 1: 数据底座 — 档案与教室管理** - 本地程序 + 学生档案增删改 + 两类教室名单维护 (completed 2026-10-07)
- [ ] **Phase 2: 每日填写** - 打开学生即预填，滚轮/点选时间与教室、手打老师、全局切换
- [ ] **Phase 3: 生成与复制** - 核对弹窗渲染完整文案，一键复制进剪贴板

## Phase Details

### Phase 1: 数据底座 — 档案与教室管理

**Goal**: 同事能用本地程序建/改/删学生档案，并维护分「班课教室」「VIP教室」两类的教室号名单
**Mode**: mvp
**Depends on**: Nothing (first phase)
**Requirements**: PROF-01, PROF-02, PROF-03, ROOM-01
**Success Criteria** (what must be TRUE):

  1. 同事启动本地程序后能在浏览器打开界面，界面遵守 Apple 设计规范
  2. 同事能创建新学生/班级档案，输入含 `{时间}`、`{教室号}`、`{老师}` 三个占位符的自定义模板
  3. 同事能编辑已有档案的模板文字、删除已有档案
  4. 同事能维护教室号名单，按「班课教室」「VIP教室」两类增/删/改
  5. 档案与教室数据持久化到本地 JSON 文件，重启程序后仍在

**Plans**: 2 plans
**UI hint**: yes

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Walking Skeleton + 档案 CRUD（建/改/删档案，含 `{时间}`/`{教室号}`/`{老师}` 占位符模板）

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — 教室名单 CRUD（班课教室/VIP教室 两类增/删/改）

### Phase 2: 每日填写

**Goal**: 同事打开学生档案即可确认或微调时间、教室、老师三个字段
**Mode**: mvp
**Depends on**: Phase 1
**Requirements**: FILL-01, FILL-02, FILL-03, FILL-04, ROOM-02
**Success Criteria** (what must be TRUE):

  1. 打开某学生时，时间、教室号、老师已预填该学生上一次的值
  2. 同事用苹果式「开始时间 + 结束时间」滚轮选择上课时间
  3. 同事能从教室名单点选教室号（「班课教室」「VIP教室」分组显示）
  4. 同事能手打老师姓名
  5. 同事能通过全局开关在「点选/滚轮」与「直接输入」间切换（作用于时间、教室，老师始终手打）

**Plans**: 2 plans
**UI hint**: yes

Plans:
**Wave 1**

- [ ] 02-01-PLAN.md — 数据闭环（后端 last_* 持久化 + 填写视图 + 预填 + 确认存值，直接输入形态）

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 02-02-PLAN.md — 点选/滚轮形态（时间双滚轮 + 教室分组点选 + 全局开关切换）

### Phase 3: 生成与复制

**Goal**: 同事一键核对完整渲染文案并复制进剪贴板
**Mode**: mvp
**Depends on**: Phase 2
**Requirements**: COPY-01, COPY-02, COPY-03
**Success Criteria** (what must be TRUE):

  1. 点「确认」后弹出核对弹窗，显示完整渲染文案（占位符已替换为当前值）
  2. 核对弹窗提供「修改」（返回编辑）与「确认复制」（复制到剪贴板）两个选项
  3. 确认复制后完整文案进入系统剪贴板，可直接粘贴进企业微信客户群

**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. 数据底座 — 档案与教室管理 | 2/2 | Complete   | 2026-10-07 |
| 2. 每日填写 | 0/2 | Not started | - |
| 3. 生成与复制 | 0/TBD | Not started | - |
