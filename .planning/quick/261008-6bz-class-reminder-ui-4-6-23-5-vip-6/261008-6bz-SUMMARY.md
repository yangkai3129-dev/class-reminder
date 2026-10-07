---
status: complete
quick_id: 261008-6bz
date: 2026-10-08
---

# Quick Task 261008-6bz: class-reminder UI 改版

## 结果

6 条 UI 需求全部落地，源码改动已提交（commit `f6c59b6`）：

1. 侧栏固定（`.app` height:100vh + overflow:hidden，仅 `#content` 滚动）
2. 档案双视图：列表 ↔ 卡片（圆角、随宽换行、只显名字、`localeCompare('zh')` 拼音排序、点卡进填写、编辑在卡右端、悬停右上角 × 删除）
3. 档案搜索框：实时筛选 + 回车，按姓名包含匹配
4. 时间 4 滚轮：开始/结束各拆「小时(6–23) + 分钟(0/5/…/55)」
5. 填写页教室号「班课/VIP」切换，一次只显示一类
6. 教室网格一排 6 个、数字自然序，管理态 × 删除（带确认）

## 关键决定

- 删除确认统一「否(左白) / 是(右蓝)」，替换原「取消/删除(红)」
- 英文名按拉丁首字母排（未做拼音表混排，用户已接受）
- 教室网格正常态点 tile 打开编辑（保留改房间号能力），管理态点 tile 无操作
- 视图切换记忆到 localStorage（同 inputMode）

## 验证

- `node --check` 通过；grep 无 `buildTimeValues` / `snapTo15` / `renderRoomRow` / `roomList` 残留
- 只读冒烟：首页 200、profiles 返回、61 教室、新 ID / 样式 / 4 滚轮均就位

## 后续

- `dist/` 副本已过时，需重新同步（下一步待办）
- 列表视图的删除弹窗也一并换成了「否/是」
