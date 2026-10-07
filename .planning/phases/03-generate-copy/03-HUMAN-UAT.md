---
status: partial
phase: 03-generate-copy
source: [03-VERIFICATION.md]
started: 2026-10-07T19:34:16Z
updated: 2026-10-07T19:34:16Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. 核对弹窗渲染与视觉
expected: 启动 `python3 class_reminder.py`，打开某学生 → 填好时间/教室/老师 → 点「确认」弹出核对弹窗，标题=学生姓名，预览=完整渲染文案（占位符已替换、保留换行与 emoji），视觉遵守 Apple 规范（无渐变/阴影、唯一强调色 #0066cc）。
result: [pending]

### 2. 「修改」路径与数据新鲜度（对应 WR-02）
expected: 点「修改」关弹窗回填写视图且三值（时间/教室/老师）仍保留；再点「档案」导航回列表后重新打开同一学生，自动带出刚保存的值（不残留旧值）。
result: [pending]

### 3. 确认复制（COPY-03 主路径）
expected: 点「确认复制」后完整文案进入系统剪贴板、可直接粘贴进企业微信；按钮变「完成」并显示「已复制到剪贴板」；点「完成」回档案列表。
result: [pending]

### 4. 三级复制降级链
expected: Chrome DevTools 置空 `navigator.clipboard` 后点「确认复制」，自动降级 `document.execCommand('copy')` 仍复制成功；再让 `execCommand` 抛错，预览被全选并显示红色「请按 ⌘C 手动复制」。
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
