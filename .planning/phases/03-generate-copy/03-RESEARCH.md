# Phase 3: 生成与复制 (generate-copy) - Research

**Researched:** 2026-10-08
**Domain:** 本地网页剪贴板复制 + 只读核对弹窗渲染（零第三方依赖，Python 标准库 + 原生 HTML/CSS/JS）
**Confidence:** HIGH

## Summary

Phase 3 把 Phase 2 的「确认 → 校验+存值 → 回列表」改成「确认 → 校验+存值 → 打开核对弹窗」，在弹窗里把 `profile.template` 中的 `{时间}`/`{教室号}`/`{老师}` 替换为当前值渲染成只读完整文案，提供「修改」（关弹窗回填写视图）与「确认复制」（写进系统剪贴板）。同事随后手动粘贴进企业微信客户群。

核心难点是剪贴板复制的可靠性。本阶段已确认：服务器 bind `127.0.0.1`，`http://127.0.0.1` 属 **secure context**（potentially trustworthy origin），因此 `navigator.clipboard` 在 Mac 桌面 Safari/Chrome 上可用。但 `navigator.clipboard.writeText` 在 Safari/Firefox 上**必须由用户手势触发**（transient activation），且失败时抛 `NotAllowedError`。因此「确认复制」必须是独立的按钮点击（不是弹窗打开时自动复制），且复制调用要在点击处理器内**同步地**发起（不先 await 其他东西）。标准三级降级链为：`navigator.clipboard.writeText` → `document.execCommand('copy')`（deprecated 但 Mac Safari/Chrome 仍可用）→ D-03 的全选手动 ⌘C（Range/Selection 选中预览文本 + 提示）。

只读预览用 `textContent` + `white-space: pre-wrap` 渲染即可原样保留换行与 emoji，且天然防 XSS（不需要 `innerHTML`/`escapeHtml`）。真实模板（`data.json`）含 emoji 与 `\n` 换行，确认此要求为硬约束。

**Primary recommendation:** 新建一个 `copy-modal` 覆盖层（复用 `.modal-backdrop`/`.modal`/`.modal-actions` 样式，但不复用删除确认弹窗的 DOM），「确认复制」按钮点击处理器内同步调用三级复制降级链；D-04 只需把 `handleFillConfirm()` 里教室空校验从 `if (inputMode === "direct" && !room)` 改成无条件的 `if (!room)`。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** 核对弹窗里的完整文案是**只读预览**，不可直接改字。要改字走「修改」回填写视图改三个字段，或回「编辑档案」改模板固定文字。避免误改模板固定文字，符合「确认默认值」定位。
- **D-02:** 复制成功后**弹窗停留**，显示「已复制到剪贴板」提示；同事点「完成」关闭弹窗并返回学生列表（**不**自动跳下一个学生，延续 Phase 2 D-02）。
- **D-03:** 剪贴板复制失败时，**自动全选渲染文案并提示「请按 ⌘C 手动复制」**，确保核心动作「复制」永不卡死。
- **D-04:** 点「确认」时校验「模板里出现的每个占位符都必须有非空值」，空则标红提示、**不让进核对弹窗**。现有代码只在「直接输入」模式拦空教室，点选模式未拦——需补上。发出去的文案不能缺字段（核心价值「少错一个字」）。
- **D-05:** Phase 2 的「确认 → 校验+存值 → 回列表」改为「确认 → 校验+存值 → 打开核对弹窗」。「修改」关弹窗回填写视图（已填值保留、不丢）；「确认复制」只复制进剪贴板（存值已在确认时完成，不再重复存）。

### Claude's Discretion

- 「完成」按钮的具体形态（「确认复制」成功后按钮切换为「完成」，或另起一个完成按钮）。
- 核对弹窗标题是否显示学生姓名（建议显示，帮助同事确认在给谁发）。
- 只读预览的渲染方式（建议 `white-space: pre-wrap` 原样保留换行与 emoji）。
- 复制技术链：优先 `navigator.clipboard.writeText`，失败回退 `document.execCommand('copy')`，再失败走 D-03 的全选手动 ⌘C 兜底。

### Deferred Ideas (OUT OF SCOPE)

- 微信 API 自动发送、批量生成、历史已发记录——均属其他阶段，本阶段不实现。
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COPY-01 | 同事点「确认」后弹出核对弹窗，显示完整渲染文案 | 「Rendering the read-only preview」+「Modal reuse」：新建 copy-modal 覆盖层，`textContent` + `white-space: pre-wrap` 渲染 `template` 用 `last_*` 替换后的文本；D-05 流程改动见下 |
| COPY-02 | 核对弹窗提供「修改」（返回编辑）与「确认复制」（复制到剪贴板）两个选项 | 「Clipboard copy chain」：确认复制必须为用户手势触发的独立按钮；修改 = 关弹窗回填写视图（值已保留，不重渲染） |
| COPY-03 | 确认复制后完整文案进入系统剪贴板，可直接粘贴进企业微信客户群 | 「Clipboard copy chain」三级降级链（writeText → execCommand → 手动 ⌘C 兜底）；「Text selection fallback」保证 D-03 永不卡死 |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 渲染完整文案（占位符→当前值） | Browser / Client | — | `profile.template` 与 `last_time`/`last_room`/`last_teacher` 均已在前端 `state.profiles` 内存中，纯前端拼接即可，无需新后端端点 |
| 复制进系统剪贴板 | Browser / Client | — | 剪贴板是纯客户端能力；服务器完全无涉 |
| 手动 ⌘C 兜底的全选 | Browser / Client | — | Range/Selection 是纯 DOM 能力 |
| 持久化 last_* 值 | API / Backend | Browser / Client（校验 UX） | 复用现有 `PUT /api/profiles/<id>/fill`（`validate_fill` 后端校验时间格式），Phase 3 不改后端 |
| D-04「每个占位符非空」校验 | Browser / Client（UX 门禁） | API / Backend（数据完整性） | D-04 是「不让进核对弹窗」的前端门禁；后端 `validate_fill` 只校验时间格式，不校验教室/老师非空——本阶段只需补前端校验，后端可不动 |

**关键结论：** Phase 3 是纯前端阶段。后端 `class_reminder.py` **无需任何改动**（`/api/profiles/<id>/fill`、`JsonStore`、`PLACEHOLDERS` 全部复用）。所有改动集中在 `static/index.html`、`static/style.css`、`static/app.js`。

## Standard Stack

本项目为**零第三方依赖**（Python 3 标准库 + 手写 HTML/CSS/JS，见 CLAUDE.md 与 PROJECT.md 锁定的 Tech Stack）。Phase 3 **不引入任何新库、新字体、新图标**——剪贴板/选择/渲染全部用 Web 平台原生 API。

### Core
| Library / API | Version | Purpose | Why Standard |
|---------------|---------|---------|--------------|
| `navigator.clipboard.writeText` | Web 平台（Async Clipboard API） | 首选剪贴板复制 | 官方推荐的 `execCommand` 替代；Mac Safari 15+/Chrome 均支持 |
| `document.execCommand('copy')` | Web 平台（deprecated） | 降级复制回退 | 虽 deprecated 但 Mac Safari/Chrome 仍实现，作为 writeText 失败时的第二道 |
| `Range.selectNodeContents` + `Selection.addRange` | Web 平台（Selection API，Baseline 2015） | D-03 手动 ⌘C 全选 | 唯一标准化的程序化选中文本方式 |
| `white-space: pre-wrap` | CSS（核心属性） | 保留换行 + emoji 的只读预览 | 现有 `.preview`/`.composer` 已用同款，无需新 token |
| `Node.textContent` | DOM（核心） | 只读预览渲染 + 防 XSS | 写文本即无 HTML 注入面，无需 `escapeHtml`/`innerHTML` |

### Supporting
| Library / API | Purpose | When to Use |
|---------------|---------|-------------|
| `window.isSecureContext` / `'clipboard' in navigator` | 运行时特性检测 | 决定是否走 writeText 还是直接降级 |
| `HTMLTextAreaElement.select()` + `setSelectionRange` | execCommand 回退的选择源 | 隐藏 textarea 的 execCommand('copy') 回退 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 三级降级链（原生） | `copy-to-clipboard` 等第三方库 | 项目锁定零依赖；原生链足够，无需引入库 |
| `execCommand('copy')` 的隐藏 textarea | 直接选中只读预览再用 execCommand | 预览元素非可编辑，execCommand('copy') 对「当前 selection」生效，隐藏 textarea 更可控 |

**Installation:**
```bash
# 无需安装任何包。零第三方依赖，纯 Web 平台 API + 现有 Python 标准库。
```

**Version verification:** 无第三方包需验证。运行环境已确认 Python 3.13.7（`class_reminder.py` 用标准库 `http.server`/`json`/`argparse`）；Mac 桌面 Safari 与 Chrome 均已安装（见 Environment Availability）。

## Package Legitimacy Audit

> 本阶段不安装任何外部包（项目锁定零第三方依赖）。Package Legitimacy Gate 不适用。

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*无第三方依赖，无需 slopcheck、无需 npm/pip/cargo 注册表验证。*

## Architecture Patterns

### System Architecture Diagram

```
同事点击档案行 → openFill(profile) → 填写视图（时间/教室/老师，预填 last_*）
                                          │
                                    点「确认」btn-fill-confirm
                                          │
                                          ▼
                              handleFillConfirm()  ← 入口改造点
                                          │
                          ┌───────────────┴───────────────┐
                          │ D-04 校验：模板里出现的每个占位符非空 │
                          │  （时间始终校验；老师始终校验；       │
                          │    教室改为无条件非空校验）           │
                          └───────────────┬───────────────┘
                                          │ 任一空 → showFillFieldError 标红 + return（不进弹窗）
                                          │ 全非空 ↓
                                          ▼
                          PUT /api/profiles/<id>/fill 存 last_*
                          （后端 validate_fill 校验时间格式）
                                          │ 成功 ↓
                                          ▼
                          打开 copy-modal 覆盖层（不改 activeView）
                          渲染 renderedText = template 用 last_* 替换占位符
                          （textContent + white-space: pre-wrap）
                                          │
                        ┌─────────────────┼─────────────────┐
                   「修改」           「确认复制」（用户手势）
                        │                  │
                        ▼                  ▼
                  关弹窗（隐藏 backdrop）   三级复制降级链：
                  填写视图值原样保留      1. navigator.clipboard.writeText(renderedText)
                                          │  失败 ↓
                                          2. 隐藏 textarea + select + execCommand('copy')
                                          │  失败 ↓
                                          3. Range.selectNodeContents(预览) + Selection.addRange
                                             → 显示「请按 ⌘C 手动复制」
                                          │  成功 ↓
                                          ▼
                                  弹窗停留，显示「已复制到剪贴板」
                                  「确认复制」按钮 →「完成」
                                          │
                                          ▼
                              「完成」→ closeCopyModal + showView("profiles") + renderProfiles()
```

**说明：** 复制无服务器参与。数据流「确认 → 校验 → 存值 → 渲染 → 复制」全程前端，唯一后端交互是既有的 `PUT /fill`。

### Recommended Project Structure

```
static/
├── index.html     # 新增 <div id="copy-modal"> 覆盖层（仿 confirm-modal）
├── style.css      # 新增 .copy-preview（pre-wrap + 滚动）等少量样式
└── app.js         # 改造 handleFillConfirm；新增 openCopyModal / copyText 三级链 / selectRenderedText
class_reminder.py  # 无需改动（复现验证即可）
```

### Pattern 1: 三级剪贴板降级链
**What:** 复制必须在用户手势内同步发起，按 writeText → execCommand → 手动全选 三级降级，任一成功即停。
**When to use:** 「确认复制」按钮的 click 处理器。
**关键约束：** `navigator.clipboard.writeText` 的调用必须发生在任何 `await` **之前**（Safari 对 transient activation 作用域严格）。见 Code Examples。

### Pattern 2: 只读预览 textContent + pre-wrap
**What:** 用 `textContent` 设置渲染文本（非 `innerHTML`/`templateToHtml`），CSS `white-space: pre-wrap` 原样保留 `\n` 与 emoji。
**When to use:** 核对弹窗预览。`renderPreview()`（模板编辑器）已用 `textContent` 是同一模式；复制预览无需把占位符渲染成 chip，直接渲染最终文本。

### Pattern 3: 覆盖层弹窗复用（非复用 DOM）
**What:** 新建 `copy-modal` 覆盖层，**复用 CSS 类**（`.modal-backdrop`/`.modal`/`.modal-actions`/`.btn-secondary`/`.btn-primary`），但**不复用** `confirm-modal` 的 DOM/JS（删除确认是「标题+一句 body+取消/删除」固定结构，核对弹窗需「标题+滚动预览+状态提示+三态按钮」）。
**When to use:** 核对弹窗。理由见「Modal reuse」分析。

### Anti-Patterns to Avoid
- **用 `innerHTML` 渲染复制预览：** 引入 XSS 面（模板/值虽为用户自输入，但 `textContent` 更简单且绝对安全）；且无需把值渲染成 chip。
- **弹窗打开时自动复制：** 违反「确认复制 = 用户手势」；Safari 会在无手势时抛 `NotAllowedError`，且与 D-02「弹窗停留」语义冲突。
- **「修改」用 `showView("fill")` 重渲染：** 若弹窗是覆盖层（推荐），「修改」只需隐藏 backdrop，填写视图 DOM 原样保留，无需任何重渲染/状态回填，避免丢值风险。
- **「确认复制」重复 PUT 存值：** 值已在「确认」时保存，再存是多余请求且可能覆盖。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 写入系统剪贴板 | 自写剪贴板访问/第三方库 | `navigator.clipboard.writeText` + `execCommand('copy')` 降级 | 平台 API 已标准化；自写无法绕过浏览器安全模型 |
| 程序化选中文本（D-03 手动 ⌘C） | 自写选择逻辑 | `Range.selectNodeContents` + `Selection.addRange` | 唯一标准化方式；跨浏览器需先 `removeAllRanges()` |
| 只读预览防 XSS | `escapeHtml` + `innerHTML` | `textContent` | 写文本即无注入面，且天然保留 emoji/换行 |
| 占位符替换 | 带动态值的正则替换 | `template.split(token).join(value)` | 现有 `renderPreview()` 已用同款，简单且无正则转义坑 |

**Key insight:** 「复制」问题看似简单，实则陷阱密集（secure context、transient activation、Safari 手势作用域严格、换行/emoji 保留、选择被清空）。标准三级降级链已覆盖全部边界，**不要自写剪贴板/选择方案**。

## Common Pitfalls

### Pitfall 1: writeText 在无手势/await 之后被调用
**What goes wrong:** Safari/Firefox 上 `navigator.clipboard.writeText` 抛 `NotAllowedError`，复制静默失败。
**Why it happens:** Safari/Firefox 不支持 `clipboard-write` permission，**只认 transient activation**；在 `await`（fetch/微任务）之后调用会丢失手势作用域。
**How to avoid:** 「确认复制」click 处理器内，`writeText` 作为**第一条语句**发起（放在任何 `await` 之前）；不要在确认阶段先 `await` fetch 再复制。
**Warning signs:** 复制按钮点击后无任何提示；console 报 `NotAllowedError`。

### Pitfall 2: D-04 教室空校验依赖 `#fill-room` 输入框
**What goes wrong:** 若把空校验写成依赖 `document.getElementById("fill-room")`，点选模式下该元素不存在，校验缺失或抛错。
**Why it happens:** 点选模式教室是 chip 网格（`selectedRoomNumber`），无 `#fill-room` 输入框。
**How to avoid:** 校验用 `currentFillValues()` 返回的 `values.room`（点选模式取自 `selectedRoomNumber`）；错误展示用 `showFillFieldError("room", ...)`（两种模式的 card HTML 都含 `data-field="room"` 的错误元素）。`focusFillInput` 已带 `if (el)` 守卫，点选模式下为无害 no-op。

### Pitfall 3: 手动全选后选择被清空
**What goes wrong:** D-03 兜底选中预览文本后，用户按 ⌘C 却复制不到东西。
**Why it happens:** 选中后若重渲染预览（重设 `textContent`）、或焦点切换/再次 `removeAllRanges()`，选择被清。
**How to avoid:** 选中放在所有 DOM 写入**之后**；选中后不再重设预览元素内容；先 `removeAllRanges()` 再 `addRange()`（Chrome/Safari 不叠加多 range）。

### Pitfall 4: execCommand 回退的隐藏 textarea 用 `display:none`
**What goes wrong:** 部分浏览器对 `display:none` 的 textarea 不执行 `select()`/copy。
**Why it happens:** 历史兼容性问题。
**How to avoid:** 用 `position:fixed; left:-9999px`（offscreen 而非 display:none），并设 `readonly`；`select()` + `setSelectionRange(0, len)` 后执行 `execCommand('copy')`，finally 移除节点。

### Pitfall 5: 弹窗打开时切换 activeView 导致填写值丢失
**What goes wrong:** 若打开核对弹窗时把 `activeView` 切走，「修改」回来需要重新 `renderFill` + 回填，易丢值。
**Why it happens:** 填写视图的滚轮/选中 chip 是瞬态 DOM 状态。
**How to avoid:** 核对弹窗做成**覆盖层**（`.modal-backdrop` overlay 在填写视图之上），打开/关闭只 `hidden` 切换 backdrop，`activeView` 保持 `"fill"`；「修改」= 仅 `closeCopyModal()`。

## Code Examples

Verified patterns from official sources:

### 三级剪贴板复制链（含 D-03 手动兜底）
```javascript
// 渲染文本在打开弹窗时已算好，保存在模块变量 renderedText
// 确认复制按钮 click 处理器：
async function handleCopyConfirm() {
  // 第 1 级：writeText 必须在任何 await 之前同步发起（Safari 手势作用域）
  let ok = false;
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(renderedText);
      ok = true;
    } catch (err) {
      ok = false; // NotAllowedError / SecurityError → 降级
    }
  }

  // 第 2 级：execCommand('copy') 隐藏 textarea 回退（deprecated 但 Mac Safari/Chrome 可用）
  if (!ok) {
    ok = legacyCopy(renderedText);
  }

  // 第 3 级：D-03 全选手动 ⌘C 兜底（永不卡死）
  if (!ok) {
    selectRenderedText();
    showCopyStatus("请按 ⌘C 手动复制"); // 提示同事手动复制
    return;
  }
  showCopyStatus("已复制到剪贴板");
  switchToDoneButton(); // 「确认复制」→「完成」
}

// execCommand 回退：Source: MDN execCommand 的防御式用法
function legacyCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";           // offscreen，非 display:none
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, ta.value.length);
  let ok = false;
  try {
    ok = document.execCommand("copy", false, null);
  } catch (e) {
    ok = false;
  } finally {
    document.body.removeChild(ta);
  }
  return ok;
}
```

### D-03 手动全选（Range/Selection）
```javascript
// Source: MDN Selection.addRange —— selectNodeContents + addRange，先 removeAllRanges
function selectRenderedText() {
  const sel = window.getSelection();
  if (sel.rangeCount > 0) sel.removeAllRanges(); // Chrome/Safari 不叠加多 range
  const range = document.createRange();
  range.selectNodeContents(els.copyPreview);      // 选中预览元素全部文本
  sel.addRange(range);
}
```

### 只读预览渲染（防 XSS + 保留换行/emoji）
```javascript
// 占位符 → 当前值：复用现有 renderPreview 的 split/join 模式
function renderCopyText(template, last_time, last_room, last_teacher) {
  const values = { "{时间}": last_time, "{教室号}": last_room, "{老师}": last_teacher };
  let out = template;
  for (const token of PLACEHOLDERS) out = out.split(token).join(values[token]);
  return out;
}
// 渲染进预览：textContent，天然防 XSS
els.copyPreview.textContent = renderedText;
```
```css
/* 只读预览：pre-wrap 保留 \n 与 emoji，滚动防超长 */
.copy-preview {
  white-space: pre-wrap;
  overflow-wrap: break-word;
  font-size: 17px; line-height: 1.47;   /* 正文规格 */
  color: var(--text-primary);
  background: var(--bg-secondary);
  border-radius: var(--radius);
  padding: 12px;
  max-height: 50vh;
  overflow-y: auto;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `document.execCommand('copy')`（同步） | `navigator.clipboard.writeText`（异步，secure context + 手势） | Async Clipboard API 成为标准 | 首选 writeText；execCommand 降为回退 |
| 手动粘贴 | 一键复制 + 手动粘贴进微信 | 本项目 | 复制后仍需同事手动粘贴（无微信 API，锁定决策） |

**Deprecated/outdated:**
- `document.execCommand`：MDN 标记 deprecated + non-standard，但仍被 Mac Safari/Chrome 实现，保留为降级第二级是正确做法（不能用它做首选，也不能完全不备它）。

## Assumptions Log

> 本阶段无第三方包，无 [ASSUMED] 包名。以下为浏览器行为层面的非阻塞假设/提示，供 discuss/planner 留意。

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Safari 对 `writeText` 的 transient activation 作用域严格，`await` 之后调用会失败 | Common Pitfalls 1 | 低——已按「writeText 放第一条语句」防御，即便 A1 为假也不影响正确性 |
| A2 | `document.execCommand('copy')` 在 Mac 桌面 Safari/Chrome 仍可用 | Clipboard chain | 低——它是第二级降级，失败自动落到 D-03 手动兜底 |
| A3 | Safari 写入剪贴板可能需要文档聚焦 | Clipboard chain | 低——点击「确认复制」按钮本身即聚焦文档，正常流程恒满足 |

**说明：** A1/A2/A3 均为防御性降级设计的一部分，即便任一为假，三级链的最终 D-03 手动兜底仍保证「复制永不卡死」。无需用户确认即可开工。

## Open Questions (RESOLVED)

1. **「完成」按钮形态（D-02 的 Claude's Discretion）** — RESOLVED
   - Decision: 「确认复制」成功后**同按钮切换文案为「完成」**（复用 DOM，改动最小，符合「最多一个视觉焦点」的 Apple 原则）。
   - Resolved in: 03-01-PLAN.md Task 3（`copyDone=true` → 按钮文案切「完成」）。

2. **核对弹窗标题是否显示学生姓名（Claude's Discretion）** — RESOLVED
   - Decision: 显示「学生名」作为标题（帮助同事确认在给谁发），与 D-01「确认默认值」定位一致。
   - Resolved in: 03-01-PLAN.md Task 1（弹窗标题 = 学生名）。

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3 标准库 | 本地 HTTP 服务（现有，不改） | ✓ | 3.13.7 | — |
| Safari (Mac 桌面) | 剪贴板复制（主浏览器） | ✓ | 已安装 | Chrome 已装，双浏览器均可测 |
| Google Chrome (Mac 桌面) | 剪贴板复制（交叉验证） | ✓ | 已安装 | — |

**Missing dependencies with no fallback:** none — 本阶段无新外部依赖。

**Missing dependencies with fallback:** none。

## Security Domain

> `security_enforcement` 未显式 false，按启用处理。

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 单用户本地工具，无鉴权（锁定决策，服务器只 bind 127.0.0.1） |
| V3 Session Management | no | 无会话 |
| V4 Access Control | no | 无多用户 |
| V5 Input Validation | yes | 复用现有 `validate_fill`（后端时间格式）+ 前端 D-04 非空校验；`textContent` 渲染杜绝注入 |
| V6 Cryptography | no | 无加密需求 |

### Known Threat Patterns for {原生 JS + 本地 HTTP}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 模板/字段值注入 HTML（XSS） | Tampering | 用 `textContent` 渲染复制预览，绝不 `innerHTML` 拼接用户值 |
| 跨站访问本地数据端点 | Spoofing / Elevation | 既有防线：服务器 bind 127.0.0.1 + 静态路由白名单；本阶段不引入新端点 |

## Sources

### Primary (HIGH confidence)
- [MDN Secure Contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts) — 确认 `127.0.0.0/8`、`localhost` 为 potentially trustworthy origin（secure context）
- [MDN Clipboard.writeText](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText) — secure context 必需 + `NotAllowedError` 异常
- [MDN Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API) — Safari/Firefox 写剪贴板需 transient activation（不支持 clipboard-write permission）；Chromium 可用 permission 替代
- [MDN Document.execCommand](https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand) — deprecated/non-standard 但仍实现；copy 作用于当前 selection、需手势、返回 boolean
- [MDN Selection.addRange](https://developer.mozilla.org/en-US/docs/Web/API/Selection/addRange) — `selectNodeContents` + `addRange` 模式；需先 `removeAllRanges()`

### Secondary (MEDIUM confidence)
- [Apple Developer Forums — navigator.clipboard.writeText fails in Safari](https://developer.apple.com/forums/thread/691873) — 引 WebKit 博客：writeText 必须在用户手势事件处理器内调用、仅 secure context；确认 Safari 手势要求
- WebSearch（navigator.clipboard.writeText secure context localhost Safari user gesture）— 多来源交叉确认 Safari 手势严格性、async 边界风险

### Tertiary (LOW confidence)
- iOS Safari 对 `http://127.0.0.1` 是否视为 secure 的单来源争议（CSDN）——本阶段目标平台是 **Mac 桌面**，此争议不适用，忽略。

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 零第三方依赖，全用 Web 平台原生 API，MDN 逐条核实
- Architecture: HIGH — 代码逐行核对（`class_reminder.py`/`app.js`/`index.html`/`style.css` 已读），Phase 3 纯前端结论有源码依据
- Pitfalls: HIGH — 剪贴板/选择/渲染坑均有 MDN 或 Apple forum 出处；D-04 缺口已定位到 `app.js` 第 823 行精确条件

**Research date:** 2026-10-08
**Valid until:** 2026-10-22（浏览器 API 相对稳定，30 天有效）
