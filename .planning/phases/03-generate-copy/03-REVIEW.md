---
phase: 03-generate-copy
reviewed: 2026-10-07T19:30:42Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - static/app.js
  - static/index.html
  - static/style.css
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
status: issues_found
---

# Phase 03-generate-copy: Code Review Report

**Reviewed:** 2026-10-07T19:30:42Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed the three Phase 3 frontend files (`static/app.js`, `static/index.html`, `static/style.css`) plus the backend (`class_reminder.py`) as cross-reference for the fill/copy API contract. The anti-XSS work is solid: all user-controlled strings (profile names, templates, room numbers, fill values) reach the DOM exclusively through `textContent`, `escapeHtml()`, or DOM node creation — no injection surface found. The three-tier clipboard chain (writeText → execCommand → manual select-all) is structurally correct, and empty-room validation fires correctly in both picker and direct modes.

No critical/blocker issues were found. The findings below are correctness/robustness concerns in the copy-and-template round-trip, state staleness after a specific navigation path, and a handful of quality/UX issues.

## Warnings

### WR-01: `serializeComposer` accumulates a trailing newline (and doubles blank lines) on every round-trip

**File:** `static/app.js:107-125` (esp. `117-118`)
**Issue:** `serializeComposer` appends `"\n"` after every `<div>`/`<p>` child. Contenteditable editors (Chrome/Safari) represent each typed line as a `<div>`, so a template like `第一行\n第二行` serializes to `第一行\n第二行\n` — a trailing newline is added, and an intentional blank line (`<div><br></div>`) becomes `\n\n`. The extra newline is persisted to the JSON template and ends up in the copied WeChat message.
**Fix:** Only join sibling blocks with `\n` rather than appending after the last one, and normalize `<br>` inside a div. For example, collect block strings in an array and `join("\n")`:

```js
function serializeComposer(editor) {
  const parts = [];
  for (const node of editor.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.classList && node.classList.contains("chip")) {
        parts.push(node.dataset.token || node.textContent);
      } else if (node.tagName === "BR") {
        parts.push("\n");
      } else if (node.tagName === "DIV" || node.tagName === "P") {
        parts.push(serializeComposer(node).replace(/\n+$/, ""));
      } else {
        parts.push(serializeComposer(node));
      }
    }
  }
  return parts.join("\n");
}
```

### WR-02: `state.profiles` `last_*` values go stale after the "修改" path, breaking next-open auto-fill

**File:** `static/app.js:957` / `static/app.js:962` / `static/app.js:280-284` / `static/app.js:705-717`
**Issue:** `handleFillConfirm` persists `last_time`/`last_room`/`last_teacher` to the backend but never updates `state.profiles`. The only refresh after a fill save is `finishCopyModal` (the "完成" path) which calls `renderProfiles()`. If the user instead clicks "修改" (`btnCopyBack` → `closeCopyModal`, line 986), then navigates via the "档案" nav (`showView("profiles")` does not re-fetch, line 962) and reopens the same profile, `openFill`/`renderFill` read the stale pre-save `profile.last_*` and show outdated defaults.
**Fix:** After a successful fill PUT, update the in-memory profile:

```js
if (res && res.error) { /* ... */ }
Object.assign(profile, { last_time, last_room, last_teacher });
renderedText = renderCopyText(tpl, last_time, last_room, last_teacher);
openCopyModal(profile, renderedText);
```

### WR-03: Toolbar token insertion can lose the caret position (chip inserted at wrong spot)

**File:** `static/app.js:294-316` / `static/app.js:994-996`
**Issue:** `insertToken` calls `composer.focus()` and then trusts `window.getSelection().getRangeAt(0)` to still point inside the composer. Clicking the `.chip-btn` button moves focus to the button; in several browsers this collapses or relocates the document selection, so `focus()` restores a default caret (commonly the start) and the chip is inserted at the top of the template instead of at the original cursor position.
**Fix:** Preserve the composer caret before the button steals focus — e.g. `mousedown` with `preventDefault` on the chip buttons, or capture the range on `selectionchange`/`blur`:

```js
document.querySelectorAll(".chip-btn").forEach((btn) => {
  btn.addEventListener("mousedown", (e) => e.preventDefault()); // keep composer focus + caret
  btn.addEventListener("click", () => insertToken(btn.dataset.token));
});
```

## Info

### IN-01: `focusFillInput` targets elements that don't exist in picker mode

**File:** `static/app.js:924-925` (also `903`, `910`, `916`)
**Issue:** In picker mode the room field is rendered as chips (`#fill-room` never exists) and the time field is the wheel group (`#fill-time-start` never exists). When empty-room validation fails in picker mode, `focusFillInput("fill-room")` is a silent no-op; the error message shows but focus does not move to a useful element.
**Fix:** Route focus by mode, e.g. focus the `.room-chip-container`/first chip in picker mode, or simply skip focus for wheel-based fields.

### IN-02: Fragile error-message string matching in `handleEditorConfirm`

**File:** `static/app.js:359-366`
**Issue:** The frontend detects the backend error type via `res.error.indexOf("占位符")` / `indexOf("名称")`. This couples client logic to the exact wording of server messages; any backend wording change silently falls through to the generic "保存失败" message.
**Fix:** Return a stable machine-readable error code (e.g. `{"error": {...}, "code": "missing_placeholder"}`) from the backend and switch on `code` instead of substring matching.

### IN-03: No double-submit guard on confirm/delete buttons

**File:** `static/app.js:883` (`handleFillConfirm`), `345` (`handleEditorConfirm`), `476` (`handleRoomConfirm`), `521` (`handleConfirmDelete`)
**Issue:** None of the async confirm handlers disable their button or guard against re-entry. A rapid double-click can fire two concurrent PUT/POST/DELETE requests — e.g. duplicating a profile/room create, or deleting twice (second returns 404 which is swallowed).
**Fix:** Add a `busy` flag or disable the button at the start of each handler and re-enable it in `finally`.

### IN-04: Custom room number is silently dropped when toggling direct → picker mode

**File:** `static/app.js:839-851` / `static/app.js:691-699`
**Issue:** In direct mode a user can type a room number that is not in the room list. `toggleInputMode("picker")` carries it into `renderFill`, but picker mode only recognizes rooms present in `state.rooms`, so `selectedRoomNumber` becomes `""` and the typed value is lost (including when toggling back to direct).
**Fix:** Either preserve the non-listed value across the toggle, or warn the user that picker mode only supports saved rooms before discarding the typed value.

### IN-05: Delete failure is swallowed with no user feedback

**File:** `static/app.js:521-539` (catch at `530-532`)
**Issue:** `handleConfirmDelete` silently ignores any `DELETE` error (the catch body is empty), then closes the modal and re-renders. The item remains in the list with no explanation, so the user cannot tell whether the delete failed or was ignored.
**Fix:** Show an error (e.g. reuse a status area or `alert`) in the catch block, and only close the modal on success.

---

_Reviewed: 2026-10-07T19:30:42Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
