# Phase 3: 生成与复制 (generate-copy) - Pattern Map

**Mapped:** 2026-10-08
**Files analyzed:** 3 (all modified in place, no new files)
**Analogs found:** 3 / 3

## File Classification

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `static/index.html` | view/markup | static DOM | existing `#confirm-modal` overlay (lines 116-126) | exact |
| `static/style.css` | config/stylesheet | static | `.modal`/`.modal-backdrop`/`.modal-actions` + `.preview` (lines 293-442, 410-420) | exact |
| `static/app.js` | controller (frontend) | event-driven + request-response + client clipboard | `openDeleteConfirm`/`closeConfirm` (modal), `renderPreview()` (split/join), `handleFillConfirm()` (entry), `showView()` | exact |

**Backend note:** `class_reminder.py` requires **no changes** (RESEARCH.md confirmed pure-frontend phase). `PUT /api/profiles/<id>/fill`, `JsonStore`, `PLACEHOLDERS` all reused as-is. Do not modify it.

---

## Pattern Assignments

### `static/index.html` — add `<div id="copy-modal">` overlay

**Analog:** existing `#confirm-modal` (lines 116-126) and `#profile-editor` (lines 67-91)

**Overlay DOM pattern** (copy this structure, but with a `modal` width that fits a scrollable preview — use plain `.modal` not `.modal-narrow`):
```html
<!-- 删除确认 -->
<div id="confirm-modal" class="modal-backdrop" hidden>
  <div class="modal modal-narrow" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
    <h2 id="confirm-title" class="modal-title">删除档案</h2>
    <p id="confirm-body" class="confirm-body"></p>
    <div class="modal-actions">
      <button id="btn-confirm-cancel" class="btn btn-secondary" type="button">取消</button>
      <button id="btn-confirm-delete" class="btn btn-danger" type="button">删除</button>
    </div>
  </div>
</div>
```

**Required new elements for copy-modal** (place after `#confirm-modal`, before `<script src="/app.js">` on line 128):
- `<div id="copy-modal" class="modal-backdrop" hidden>` wrapper
- `.modal` (not `.modal-narrow`; the preview needs width) with `role="dialog" aria-modal="true" aria-labelledby="copy-modal-title"`
- `<h2 id="copy-modal-title" class="modal-title">` — student name (Claude's discretion, recommended)
- `<pre id="copy-preview" class="copy-preview">` or a `<p>`/`<div>` — read-only rendered text (use `textContent`, NOT `innerHTML`)
- `<p id="copy-status" class="copy-status">` — status line (initially hidden/empty; shows "已复制到剪贴板" / "请按 ⌘C 手动复制")
- `.modal-actions` with two buttons:
  - `<button id="btn-copy-back" class="btn btn-secondary" type="button">修改</button>`
  - `<button id="btn-copy-confirm" class="btn btn-primary" type="button">确认复制</button>`

**Conventions observed:** all modals share `.modal-backdrop` + `hidden` attribute toggling; `role="dialog" aria-modal="true" aria-labelledby="...-title"`; action buttons use `.btn btn-secondary` (cancel-ish) and `.btn btn-primary` (primary action).

---

### `static/style.css` — add `.copy-preview` / `.copy-status` styles

**Analog:** `:root` tokens (lines 1-13), `.modal-backdrop`/`.modal`/`.modal-actions` (lines 294-442), `.preview` (lines 410-420)

**Design tokens to reuse** (lines 1-13):
```css
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f7;
  --accent: #0066cc;
  --accent-hover: #005bb5;
  --accent-tint: rgba(0, 102, 204, 0.08);
  --danger: #ff3b30;
  --text-primary: #1d1d1f;
  --text-secondary: #6e6e73;
  --divider: #d2d2d7;
  --font-stack: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "PingFang SC", "Helvetica Neue", sans-serif;
  --radius: 6px;
}
```

**Modal overlay / actions — reuse as-is, no new classes needed** (lines 294-434):
```css
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal {
  background: var(--bg-primary);
  border-radius: var(--radius);
  padding: 24px;
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  overflow-y: auto;
}
.modal-title {
  font-size: 22px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--text-primary);
  margin-bottom: 16px;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.btn-secondary {
  background: transparent;
  color: var(--text-primary);
  border-color: var(--divider);
}
.btn-primary {
  background: var(--accent);
  color: #ffffff;
}
```

**`.preview` precedent for a pre-wrap read-only block** (lines 410-420) — `.copy-preview` is a larger version of this:
```css
.preview {
  background: var(--bg-secondary);
  border-radius: var(--radius);
  padding: 12px;
  font-size: 13px;
  line-height: 1.4;
  color: var(--text-secondary);
  margin-top: 8px;
  white-space: pre-wrap;
  overflow-wrap: break-word;
}
```

**New `.copy-preview` style** (matches RESEARCH.md, uses `white-space: pre-wrap` to preserve `\n` + emoji; use 17px body spec, not the 13px preview spec):
```css
.copy-preview {
  white-space: pre-wrap;
  overflow-wrap: break-word;
  font-size: 17px;
  line-height: 1.47;
  color: var(--text-primary);
  background: var(--bg-secondary);
  border-radius: var(--radius);
  padding: 12px;
  max-height: 50vh;
  overflow-y: auto;
}
```

**New `.copy-status` style** (reuse the `.error`/`.confirm-body` precedent — 13px secondary or danger color depending on state; error state reuses `--danger`):
```css
/* status line: success uses text-secondary, manual-copy fallback uses --danger */
.copy-status { font-size: 13px; line-height: 1.4; margin: 8px 0 0; color: var(--text-secondary); }
.copy-status.error { color: var(--danger); }
```

**Critical global rule** (line 606-608) — `[hidden]` is `display: none !important`, so toggling `hidden` on the new `#copy-modal` works without extra CSS:
```css
[hidden] { display: none !important; }
```

---

### `static/app.js` — modify `handleFillConfirm()` + add copy-modal functions

**Analogs:** `openDeleteConfirm`/`closeConfirm` (lines 404-419), `renderPreview()` (lines 185-192), `handleFillConfirm()` (lines 783-859), `showView()` (lines 441-451), `currentFillValues()` (lines 720-737)

#### 1. Element refs — extend `els` object (lines 27-66)

Copy the existing pattern. Add these keys inside the `els` object literal, following the `getElementById` convention:
```javascript
const els = {
  // ... existing keys ...
  confirmModal: document.getElementById("confirm-modal"),
  confirmTitle: document.getElementById("confirm-title"),
  confirmBody: document.getElementById("confirm-body"),
  btnConfirmCancel: document.getElementById("btn-confirm-cancel"),
  btnConfirmDelete: document.getElementById("btn-confirm-delete"),
  // NEW for phase 3:
  copyModal: document.getElementById("copy-modal"),
  copyModalTitle: document.getElementById("copy-modal-title"),
  copyPreview: document.getElementById("copy-preview"),
  copyStatus: document.getElementById("copy-status"),
  btnCopyBack: document.getElementById("btn-copy-back"),
  btnCopyConfirm: document.getElementById("btn-copy-confirm"),
  // ...
};
```

#### 2. Module-scope variable for rendered text (copy the `confirmTarget`/`fillProfileId` pattern, lines 18-25)

```javascript
let confirmTarget = null;
let fillProfileId = null;
// NEW:
let renderedText = "";
```

#### 3. Modal open/close pattern (copy `openDeleteConfirm` + `closeConfirm`, lines 404-419)

```javascript
function openDeleteConfirm(kind, item) {
  confirmTarget = { kind, item };
  if (kind === "profile") {
    els.confirmTitle.textContent = "删除档案";
    els.confirmBody.textContent = "确定删除「" + item.name + "」吗？此操作无法撤销。";
  } else {
    els.confirmTitle.textContent = "删除教室";
    els.confirmBody.textContent = "确定删除教室号「" + (item.number || "") + "」吗？";
  }
  els.confirmModal.hidden = false;
}
function closeConfirm() {
  els.confirmModal.hidden = true;
  confirmTarget = null;
}
```

**New `openCopyModal(profile, rendered)` / `closeCopyModal()` mirror this** — set title (student name), set `els.copyPreview.textContent = rendered` (NOT innerHTML — anti-XSS), reset status line to hidden, then `els.copyModal.hidden = false`. `closeCopyModal()` just sets `els.copyModal.hidden = true`. **Do not touch `state.activeView` or `showView()` on open** — the modal is an overlay on top of the fill view (Pitfall 5).

#### 4. Placeholder-replacement pattern (copy `renderPreview()` lines 185-192 + `PLACEHOLDERS` line 1)

```javascript
const PLACEHOLDERS = ["{时间}", "{教室号}", "{老师}"];

function renderPreview() {
  const text = serializeComposer(els.templateComposer);
  let preview = text;
  for (const token of PLACEHOLDERS) {
    preview = preview.split(token).join(SAMPLE_VALUES[token]);
  }
  els.templatePreview.textContent = preview;
}
```

**New `renderCopyText(template, values)`** — same `template.split(token).join(value)` loop, but values come from `last_time`/`last_room`/`last_teacher` (not `SAMPLE_VALUES`):
```javascript
function renderCopyText(template, last_time, last_room, last_teacher) {
  const values = { "{时间}": last_time, "{教室号}": last_room, "{老师}": last_teacher };
  let out = template;
  for (const token of PLACEHOLDERS) out = out.split(token).join(values[token]);
  return out;
}
```

#### 5. Entry point to modify — `handleFillConfirm()` (lines 783-859)

This is the integration point. Current flow ends with `showView("profiles"); await renderProfiles();` (lines 857-858). Phase 3 replaces those two lines with `openCopyModal(...)`.

**D-04 fix (Pitfall 2):** change the room-empty guard. Current (lines 821-829):
```javascript
if (tpl.indexOf("{教室号}") !== -1) {
  const room = values.room.trim();
  if (inputMode === "direct" && !room) {          // ← BUG: only blocks direct mode
    showFillFieldError("room", "教室号不能为空。");
    focusFillInput("fill-room");
    return;
  }
  last_room = room;
}
```
Change `if (inputMode === "direct" && !room)` to unconditional `if (!room)`. Keep using `values.room` from `currentFillValues()` (picker mode reads `selectedRoomNumber`, direct mode reads `#fill-room` — see `currentFillValues()` lines 720-737). `focusFillInput("fill-room")` is already a safe no-op in picker mode because of its `if (el)` guard (lines 759-762).

**Error-display helpers to reuse as-is** (lines 764-777):
```javascript
function showFillFieldError(field, message) {
  const el = els.fillFields.querySelector('.fill-field-error[data-field="' + field + '"]');
  if (el) { el.textContent = message; el.hidden = false; }
}
function clearFillFieldErrors() {
  els.fillFields.querySelectorAll(".fill-field-error").forEach((el) => {
    el.textContent = ""; el.hidden = true;
  });
}
```

**Flow after validation + successful PUT** (replace lines 857-858): build `renderedText = renderCopyText(profile.template, last_time, last_room, last_teacher)` then `openCopyModal(profile, renderedText)`. Do NOT call `showView("profiles")` here anymore (that moves to the "完成" button).

#### 6. Copy handler — three-tier chain (RESEARCH.md verified pattern)

**"确认复制" click handler** — `writeText` must be the FIRST async statement (before any `await`), per Pitfall 1:
```javascript
async function handleCopyConfirm() {
  let ok = false;
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(renderedText);
      ok = true;
    } catch (err) {
      ok = false; // NotAllowedError / SecurityError → fall through
    }
  }
  if (!ok) ok = legacyCopy(renderedText);
  if (!ok) {
    selectRenderedText();
    showCopyStatus("请按 ⌘C 手动复制", true);
    return;
  }
  showCopyStatus("已复制到剪贴板", false);
  switchToDoneButton(); // same button switches text "确认复制" → "完成"
}

function legacyCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";   // offscreen, NOT display:none (Pitfall 4)
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, ta.value.length);
  let ok = false;
  try { ok = document.execCommand("copy", false, null); }
  catch (e) { ok = false; }
  finally { document.body.removeChild(ta); }
  return ok;
}

function selectRenderedText() {
  const sel = window.getSelection();
  if (sel.rangeCount > 0) sel.removeAllRanges(); // Pitfall 3
  const range = document.createRange();
  range.selectNodeContents(els.copyPreview);
  sel.addRange(range);
}
```

#### 7. `showView()` pattern (lines 441-451) — reused by "修改"/"完成"

"修改" (`btn-copy-back`) = `closeCopyModal()` only — fill view DOM already holds values (Pitfall 5, no re-render).

"完成" (after success) = `closeCopyModal()` + `showView("profiles")` + `await renderProfiles()`. `showView` already handles toggling view `hidden` + nav `active` state:
```javascript
function showView(viewName) {
  state.activeView = viewName;
  const isProfiles = viewName === "profiles";
  const isRooms = viewName === "rooms";
  const isFill = viewName === "fill";
  els.profilesView.hidden = !isProfiles;
  els.roomsView.hidden = !isRooms;
  els.fillView.hidden = !isFill;
  els.navProfiles.classList.toggle("active", isProfiles || isFill);
  els.navRooms.classList.toggle("active", isRooms);
}
```

#### 8. Event wiring (copy `wireEvents` pattern, lines 861-895)

Add these bindings alongside `els.btnConfirmCancel`/`els.btnConfirmDelete` (lines 884-885):
```javascript
els.btnCopyBack.addEventListener("click", closeCopyModal);
els.btnCopyConfirm.addEventListener("click", handleCopyConfirm);
```

#### 9. `api()` fetch helper (lines 68-78) — reused unchanged for the existing `PUT /fill`

```javascript
async function api(path, options = {}) {
  const opts = Object.assign({ headers: { "Content-Type": "application/json" } }, options);
  if (opts.body && typeof opts.body !== "string") opts.body = JSON.stringify(opts.body);
  const res = await fetch(path, opts);
  if (res.status === 204) return null;
  return res.json();
}
```

---

## Shared Patterns

### Modal overlay (applies to `index.html` + `style.css` + `app.js`)
**Source:** `#confirm-modal` in `index.html` (116-126), `.modal-backdrop`/`.modal`/`.modal-actions` in `style.css` (294-434), `openDeleteConfirm`/`closeConfirm` in `app.js` (404-419).
- All modals are `.modal-backdrop[hidden]` overlays; JS toggles the `hidden` attribute only.
- `[hidden] { display: none !important; }` (style.css 606-608) makes this work globally.
- Never switch `state.activeView` to show a modal — modals overlay the current view.

### Anti-XSS text rendering (applies to `app.js`)
**Source:** `renderPreview()` line 191 (`els.templatePreview.textContent = preview`).
- Always set preview text via `.textContent`, never `innerHTML` + user data.
- `templateToHtml()`/`escapeHtml()` (lines 80-97) are ONLY for the editable composer/list chips — do NOT use for the read-only copy preview.

### Placeholder substitution (applies to `app.js`)
**Source:** `renderPreview()` lines 188-190.
- `template.split(token).join(value)` loop over `PLACEHOLDERS` (line 1). No regex.

### Error display (applies to `app.js`)
**Source:** `showFillFieldError` (764-770), `clearFillFieldErrors` (772-777), `focusFillInput` (759-762).
- Field errors live in `.fill-field-error[data-field="..."]` elements inside each fill card (see `fillRoomCardPickerHtml`/`fillRoomCardDirectHtml`, lines 519-537).
- `focusFillInput` has `if (el)` guard — safe no-op when the input doesn't exist (picker mode room).

### Save-failure messaging (applies to `app.js`)
**Source:** `handleFillConfirm` lines 847-856 and `handleRoomConfirm` lines 390-399.
- On fetch throw or `res.error`: set `els.fillError.textContent = "保存失败：数据没有写进文件，请确认数据文件可写后重试。"` and `hidden = false`, then `return`.

---

## No Analog Found

None. All three files have an exact same-role analog already in the codebase.

The only genuinely new code (the clipboard three-tier chain, `navigator.clipboard.writeText` → `document.execCommand('copy')` → `Range`/`Selection` manual ⌘C) has no existing codebase precedent, but the verified reference is provided in RESEARCH.md Code Examples (lines 225-314). The planner should copy that chain verbatim, wiring it into the existing `els`/`wireEvents`/`open*Modal` conventions documented above.

## Metadata

**Analog search scope:** `static/app.js`, `static/style.css`, `static/index.html`, `class_reminder.py`
**Files scanned:** 4 (all read in full; app.js 913 lines, style.css 608 lines, index.html 130 lines, class_reminder.py 348 lines)
**Pattern extraction date:** 2026-10-08
