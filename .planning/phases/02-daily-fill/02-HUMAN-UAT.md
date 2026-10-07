---
status: partial
phase: 02-daily-fill
source: [02-VERIFICATION.md]
started: 2026-10-08T02:35:00Z
updated: 2026-10-08T02:35:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. 打开学生即预填上次值（点档案行主区域进入填写视图）
expected: 点某学生行主区域（非「编辑」）打开填写视图，标题为学生名；时间/教室/老师已预填该学生上一次 last_* 值；首次填写时间默认 9:00/10:30、教室与老师为空；last_room 已不在名单则教室留空（D-05）
result: [pending]

### 2. 时间双滚轮吸附（开始/结束）
expected: 点选/滚轮模式（默认）时间卡片显示两个竖向滚轮（06:00–23:45 @15min，72 档），滚动/拖拽/点击某行均吸附到 15 分钟档，中心行 17px/600 高亮、上下 1px 分隔线；开始晚于结束点确认被拦截
result: [pending]

### 3. 教室分组点选（班课教室/VIP教室 chip）
expected: 点选/滚轮模式教室卡片显示「班课教室」组在前、「VIP教室」组在后，chip 为教室号；点击选中蓝底蓝字蓝边框、单选切换、再点已选保持选中；空名单显示「还没有教室号」内联提示
result: [pending]

### 4. 老师手打 + 确认校验
expected: 老师始终为文本框（两种模式不受影响）；点「确认」校验失败显示对应中文错误并聚焦首个失败字段；合法则存值返回档案列表（D-02），重新打开三值已带出
result: [pending]

### 5. 全局开关切换 + 值保留 + 跨会话持久化
expected: header 右侧「点选/滚轮 ⇄ 直接输入」分段开关；默认点选/滚轮；切换时时间/教室两控件形态互换且保留当前值，老师不变；刷新页面/重开浏览器开关保持上次选择（localStorage inputMode）
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
