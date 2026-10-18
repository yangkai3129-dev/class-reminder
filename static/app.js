const PLACEHOLDERS = ["{时间}", "{教室号}", "{教师}"];

const DEFAULT_HEADER = "明日上课提醒：✨✨✨\n🚪教室安排：{教室号}\n🔔 时间安排：";
const DEFAULT_FOOTER = "有任何问题及时沟通哈";

const SAMPLE_VALUES = {
  "{时间}": "9:00-10:30",
  "{教室号}": "2802",
  "{教师}": "王国香",
};

const state = {
  profiles: [],
  rooms: [],
  activeView: "profiles",
  activeRoomCategory: "class",
  schedule: {},
  scheduleDate: "",
};

let editorMode = "create";
let editingProfileId = null;
let confirmTarget = null;
let roomEditorMode = "create";
let editingRoomId = null;
let draftRoomCategory = "class";
let fillProfileId = null;
let roomsLoaded = false;
let inputMode = "picker";
let selectedRoomNumber = "";
let renderedText = "";
let copyDone = false;
let profileView = "list";
let searchQuery = "";
let fillRoomCategory = "class";
let roomManageMode = false;
let scheduleResultOk = true;
let fillPage = 0;
let fillDraft = null;

const els = {
  navProfiles: document.getElementById("nav-profiles"),
  navRooms: document.getElementById("nav-rooms"),
  btnExport: document.getElementById("btn-export"),
  btnImport: document.getElementById("btn-import"),
  btnImportSchedule: document.getElementById("btn-import-schedule"),
  importFile: document.getElementById("import-file"),
  scheduleFile: document.getElementById("schedule-file"),
  profilesView: document.getElementById("profiles-view"),
  roomsView: document.getElementById("rooms-view"),
  profileList: document.getElementById("profile-list"),
  profileGrid: document.getElementById("profile-grid"),
  profileSearch: document.getElementById("profile-search"),
  profileViewToggle: document.getElementById("profile-view-toggle"),
  profilesEmpty: document.getElementById("profiles-empty"),
  btnNewProfile: document.getElementById("btn-new-profile"),
  profileEditor: document.getElementById("profile-editor"),
  profileEditorTitle: document.getElementById("profile-editor-title"),
  profileName: document.getElementById("profile-name"),
  editorHeader: document.getElementById("editor-header"),
  editorFooter: document.getElementById("editor-footer"),
  editorSlotTabs: document.getElementById("editor-slot-tabs"),
  editorSlot0: document.getElementById("editor-slot-0"),
  editorSlot1: document.getElementById("editor-slot-1"),
  editorSlot2: document.getElementById("editor-slot-2"),
  editorError: document.getElementById("editor-error"),
  btnEditorCancel: document.getElementById("btn-editor-cancel"),
  btnEditorConfirm: document.getElementById("btn-editor-confirm"),
  btnNewRoom: document.getElementById("btn-new-room"),
  btnManageRooms: document.getElementById("btn-manage-rooms"),
  roomCategoryTabs: document.getElementById("room-category-tabs"),
  roomGrid: document.getElementById("room-grid"),
  roomsEmpty: document.getElementById("rooms-empty"),
  roomEditor: document.getElementById("room-editor"),
  roomEditorTitle: document.getElementById("room-editor-title"),
  roomNumber: document.getElementById("room-number"),
  roomEditorTabs: document.getElementById("room-editor-tabs"),
  roomEditorError: document.getElementById("room-editor-error"),
  btnRoomCancel: document.getElementById("btn-room-cancel"),
  btnRoomConfirm: document.getElementById("btn-room-confirm"),
  confirmModal: document.getElementById("confirm-modal"),
  confirmTitle: document.getElementById("confirm-title"),
  confirmBody: document.getElementById("confirm-body"),
  btnConfirmCancel: document.getElementById("btn-confirm-cancel"),
  btnConfirmDelete: document.getElementById("btn-confirm-delete"),
  fillView: document.getElementById("fill-view"),
  fillTitle: document.getElementById("fill-title"),
  fillScheduleNote: document.getElementById("fill-schedule-note"),
  fillFields: document.getElementById("fill-fields"),
  fillError: document.getElementById("fill-error"),
  btnFillBack: document.getElementById("btn-fill-back"),
  btnFillConfirm: document.getElementById("btn-fill-confirm"),
  fillModeToggle: document.getElementById("fill-mode-toggle"),
  copyModal: document.getElementById("copy-modal"),
  copyModalTitle: document.getElementById("copy-modal-title"),
  copyPreview: document.getElementById("copy-preview"),
  copyStatus: document.getElementById("copy-status"),
  btnCopyBack: document.getElementById("btn-copy-back"),
  btnCopyConfirm: document.getElementById("btn-copy-confirm"),
  scheduleModal: document.getElementById("schedule-modal"),
  scheduleDate: document.getElementById("schedule-date"),
  scheduleDateBox: document.getElementById("schedule-date-box"),
  scheduleDateDisplay: document.getElementById("schedule-date-display"),
  scheduleDateLabel: document.getElementById("schedule-date-label"),
  scheduleModalError: document.getElementById("schedule-modal-error"),
  scheduleStagePick: document.getElementById("schedule-stage-pick"),
  scheduleStageLoading: document.getElementById("schedule-stage-loading"),
  scheduleStageResult: document.getElementById("schedule-stage-result"),
  scheduleResultText: document.getElementById("schedule-result-text"),
  btnScheduleCancel: document.getElementById("btn-schedule-cancel"),
  btnScheduleConfirm: document.getElementById("btn-schedule-confirm"),
  btnScheduleManual: document.getElementById("btn-schedule-manual"),
  btnScheduleResult: document.getElementById("btn-schedule-result"),
  scheduleStatus: document.getElementById("schedule-status"),
  scheduleStatusText: document.getElementById("schedule-status-text"),
  btnClearSchedule: document.getElementById("btn-clear-schedule"),
};

async function api(path, options = {}) {
  const opts = Object.assign({ headers: { "Content-Type": "application/json" } }, options);
  if (opts.body && typeof opts.body !== "string") {
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(path, opts);
  if (res.status === 204) {
    return null;
  }
  return res.json();
}

function todayStamp() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

async function exportData() {
  let data;
  try {
    data = await api("/api/export");
  } catch (err) {
    window.alert("导出失败，请重试。");
    return;
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "上课提醒-备份-" + todayStamp() + ".json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function importData(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch (err) {
    window.alert("这个文件不是有效的备份文件。");
    return;
  }
  const profileCount = Array.isArray(data.profiles) ? data.profiles.length : 0;
  const roomCount = Array.isArray(data.rooms) ? data.rooms.length : 0;
  if (!window.confirm("导入会覆盖当前全部数据（" + profileCount + " 个档案、" + roomCount + " 个教室）。确定继续吗？")) {
    return;
  }
  let res;
  try {
    res = await api("/api/import", { method: "POST", body: data });
  } catch (err) {
    window.alert("导入失败，请重试。");
    return;
  }
  if (res && res.error) {
    window.alert(res.error);
    return;
  }
  await renderProfiles();
  await renderRooms();
  window.alert("导入成功。");
}

function applyScheduleData(res) {
  state.schedule = (res && res.schedule) || {};
  state.scheduleDate = (res && res.date) || "";
  try {
    localStorage.setItem("schedule", JSON.stringify({ date: state.scheduleDate, schedule: state.schedule }));
  } catch (err) {}
  updateScheduleStatus();
  renderProfiles();
}

function updateScheduleStatus() {
  if (state.scheduleDate) {
    els.scheduleStatusText.textContent = "已导入 " + state.scheduleDate + " 课表";
    els.scheduleStatus.hidden = false;
  } else {
    els.scheduleStatusText.textContent = "";
    els.scheduleStatus.hidden = true;
  }
}

function clearSchedule() {
  state.schedule = {};
  state.scheduleDate = "";
  try {
    localStorage.removeItem("schedule");
  } catch (err) {}
  updateScheduleStatus();
  renderProfiles();
}

async function importScheduleFromFile(file, dateStr) {
  showScheduleStage("loading");
  let res;
  try {
    const url = dateStr ? "/api/import-schedule?date=" + encodeURIComponent(dateStr) : "/api/import-schedule";
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: await file.arrayBuffer(),
    });
    res = await res.json();
  } catch (err) {
    res = { error: "网络请求失败" };
  }

  if (res && !res.error) {
    scheduleResultOk = true;
    applyScheduleData(res);
    els.scheduleResultText.textContent = "✓ 已导入「" + state.scheduleDate + "」课表：共 " + Object.keys(state.schedule).length + " 个学生、" + (res.count || 0) + " 节课";
    els.btnScheduleResult.textContent = "完成";
  } else {
    scheduleResultOk = false;
    els.scheduleResultText.textContent = "导入失败：" + ((res && res.error) ? res.error : "网络请求失败");
    els.btnScheduleResult.textContent = "返回";
  }
  showScheduleStage("result");
}

function tomorrowDateStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function todayDateStr() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function formatDateDisplay(dateStr) {
  return dateStr ? dateStr.replace(/-/g, "/") : "";
}

function updateScheduleDateDisplay() {
  const v = els.scheduleDate.value;
  els.scheduleDateDisplay.textContent = formatDateDisplay(v);
  if (v === todayDateStr()) {
    els.scheduleDateLabel.textContent = "（今日）";
  } else if (v === tomorrowDateStr()) {
    els.scheduleDateLabel.textContent = "（明日）";
  } else {
    els.scheduleDateLabel.textContent = "";
  }
}

function openScheduleModal() {
  els.scheduleDate.value = tomorrowDateStr();
  updateScheduleDateDisplay();
  els.scheduleModalError.hidden = true;
  els.scheduleModalError.textContent = "";
  showScheduleStage("pick");
  els.scheduleModal.hidden = false;
  els.scheduleDate.focus();
}

function closeScheduleModal() {
  els.scheduleModal.hidden = true;
}

function showScheduleStage(stage) {
  els.scheduleStagePick.hidden = stage !== "pick";
  els.scheduleStageLoading.hidden = stage !== "loading";
  els.scheduleStageResult.hidden = stage !== "result";
}

async function handleScheduleConfirm() {
  const dateVal = els.scheduleDate.value;
  if (!dateVal) {
    els.scheduleModalError.textContent = "请选择课表日期。";
    els.scheduleModalError.hidden = false;
    return;
  }
  els.scheduleModalError.hidden = true;
  showScheduleStage("loading");

  let res;
  try {
    res = await fetch("/api/fetch-schedule?date=" + encodeURIComponent(dateVal));
    res = await res.json();
  } catch (err) {
    res = { error: "网络请求失败" };
  }

  if (res && !res.error) {
    scheduleResultOk = true;
    applyScheduleData(res);
    els.scheduleResultText.textContent = "✓ 已导入「" + state.scheduleDate + "」课表：共 " + Object.keys(state.schedule).length + " 个学生、" + (res.count || 0) + " 节课";
    els.btnScheduleResult.textContent = "完成";
  } else {
    scheduleResultOk = false;
    els.scheduleResultText.textContent = "导入失败：" + ((res && res.error) ? res.error : "网络请求失败");
    els.btnScheduleResult.textContent = "返回";
  }
  showScheduleStage("result");
}

function handleScheduleResult() {
  if (scheduleResultOk) {
    closeScheduleModal();
  } else {
    showScheduleStage("pick");
  }
}

function handleImportSchedule() {
  openScheduleModal();
}

function lookupSchedule(name) {
  return state.schedule ? state.schedule[name] || [] : [];
}

function renderScheduleNote(profile, classes) {
  const note = els.fillScheduleNote;
  if (!classes || classes.length === 0) {
    if (state.scheduleDate) {
      note.hidden = false;
      note.textContent = "课表中未找到「" + profile.name + "」，请手动填写。";
    } else {
      note.hidden = true;
      note.textContent = "";
    }
    return;
  }
  const first = classes[0];
  let text = "已按「" + state.scheduleDate + "」课表自动填入：" + first.time + " / " + first.room + " / " + first.teacher;
  if (classes.length > 1) {
    const rest = classes.slice(1).map((c) => c.time + " " + c.room + " " + c.teacher).join("；");
    text += "。另有 " + (classes.length - 1) + " 节：" + rest;
  }
  note.hidden = false;
  note.textContent = text;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function templateToHtml(template) {
  let html = escapeHtml(template);
  for (const token of PLACEHOLDERS) {
    html = html.split(token).join(
      '<span class="chip" data-token="' + token + '" contenteditable="false">' + token + "</span>"
    );
  }
  return html;
}

function serializeComposer(editor) {
  let out = "";
  for (const node of editor.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.classList && node.classList.contains("chip")) {
        out += node.dataset.token || node.textContent;
      } else if (node.tagName === "BR") {
        out += "\n";
      } else if (node.tagName === "DIV" || node.tagName === "P") {
        out += serializeComposer(node) + "\n";
      } else {
        out += serializeComposer(node);
      }
    }
  }
  return out;
}

function showEditorError(message) {
  els.editorError.textContent = message;
  els.editorError.hidden = false;
}

function renderProfileRow(profile) {
  const row = document.createElement("div");
  row.className = "profile-row";

  const main = document.createElement("div");
  main.className = "profile-row-main";
  main.addEventListener("click", () => openFill(profile));

  const name = document.createElement("div");
  name.className = "profile-name";
  name.textContent = profile.name;

  const preview = document.createElement("div");
  preview.className = "profile-template-preview";
  preview.innerHTML = templateToHtml(profilePreview(profile));

  main.appendChild(name);
  main.appendChild(preview);

  const actions = document.createElement("div");
  actions.className = "row-actions";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "link-action";
  editBtn.textContent = "编辑";
  editBtn.addEventListener("click", () => openProfileEditor("edit", profile));

  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "link-action link-danger";
  delBtn.textContent = "删除";
  delBtn.addEventListener("click", () => openDeleteConfirm("profile", profile));

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);

  row.appendChild(main);
  row.appendChild(actions);
  return row;
}

function renderProfileCard(profile) {
  const card = document.createElement("div");
  card.className = "profile-card";
  card.addEventListener("click", () => openFill(profile));

  const name = document.createElement("div");
  name.className = "profile-card-name";
  name.textContent = profile.name;

  const del = document.createElement("button");
  del.type = "button";
  del.className = "profile-card-x";
  del.setAttribute("aria-label", "删除");
  del.textContent = "×";
  del.addEventListener("click", (e) => {
    e.stopPropagation();
    openDeleteConfirm("profile", profile);
  });

  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "profile-card-edit";
  edit.textContent = "编辑";
  edit.addEventListener("click", (e) => {
    e.stopPropagation();
    openProfileEditor("edit", profile);
  });

  card.appendChild(del);
  card.appendChild(name);
  card.appendChild(edit);
  return card;
}

function isMatched(profile) {
  const classes = state.schedule && state.schedule[profile.name];
  return Array.isArray(classes) && classes.length > 0;
}

function renderGroupHeader(text, count) {
  const h = document.createElement("div");
  h.className = "profile-group-header";
  h.textContent = text + " · " + count;
  return h;
}

async function renderProfiles() {
  let data;
  try {
    data = await api("/api/profiles");
  } catch (err) {
    data = { profiles: [] };
  }
  state.profiles = data.profiles || [];
  const q = (searchQuery || "").trim();
  let filtered = state.profiles;
  if (q) {
    filtered = filtered.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  }
  const isCard = profileView === "card";
  if (isCard) {
    filtered = filtered.slice().sort((a, b) => a.name.localeCompare(b.name, "zh"));
  }
  els.profileList.hidden = isCard;
  els.profileGrid.hidden = !isCard;
  els.profileList.innerHTML = "";
  els.profileGrid.innerHTML = "";
  if (filtered.length === 0) {
    els.profilesEmpty.hidden = false;
    const title = els.profilesEmpty.querySelector(".empty-title");
    const body = els.profilesEmpty.querySelector(".empty-body");
    if (state.profiles.length > 0) {
      title.textContent = "没有匹配的学生";
      body.textContent = "换个关键词试试。";
    } else {
      title.textContent = "还没有学生档案";
      body.textContent = "点「新建档案」，输入学生/班级名称和提醒模板，建好第一份档案。";
    }
  } else {
    els.profilesEmpty.hidden = true;
    const container = isCard ? els.profileGrid : els.profileList;
    const hasSchedule = state.schedule && Object.keys(state.schedule).length > 0;
    if (hasSchedule) {
      const matched = filtered.filter((p) => isMatched(p));
      const unmatched = filtered.filter((p) => !isMatched(p));
      if (matched.length) {
        container.appendChild(renderGroupHeader("已匹配课表", matched.length));
        matched.forEach((p) => container.appendChild(isCard ? renderProfileCard(p) : renderProfileRow(p)));
      }
      if (unmatched.length) {
        container.appendChild(renderGroupHeader("课表未匹配", unmatched.length));
        unmatched.forEach((p) => container.appendChild(isCard ? renderProfileCard(p) : renderProfileRow(p)));
      }
    } else {
      filtered.forEach((p) => container.appendChild(isCard ? renderProfileCard(p) : renderProfileRow(p)));
    }
  }
}

function renderPreview() {
  const text = serializeComposer(els.templateComposer);
  let preview = text;
  for (const token of PLACEHOLDERS) {
    preview = preview.split(token).join(SAMPLE_VALUES[token]);
  }
  els.templatePreview.textContent = preview;
}

function renderCopyText(profile) {
  const room = profile.last_room || "";
  let text = (profile.header || "").split("{教室号}").join(room);
  for (const slot of (profile.slots || [])) {
    const tpl = (slot && slot.template) || "";
    if (!tpl.trim()) continue;
    let line = tpl.split("{时间}").join(slot.last_time || "")
      .split("{教师}").join(slot.last_teacher || "")
      .split("{教室号}").join(room);
    text += "\n" + line;
  }
  if (profile.footer) {
    text += "\n" + profile.footer;
  }
  return text;
}

function openCopyModal(profile, rendered) {
  copyDone = false;
  els.copyModalTitle.textContent = profile.name || "";
  els.copyPreview.value = rendered;
  els.copyStatus.hidden = true;
  els.copyStatus.textContent = "";
  els.btnCopyConfirm.textContent = "确认复制";
  els.copyModal.hidden = false;
}

function closeCopyModal() {
  els.copyModal.hidden = true;
}

function showCopyStatus(message, isError) {
  els.copyStatus.textContent = message;
  els.copyStatus.hidden = false;
  els.copyStatus.classList.toggle("error", !!isError);
}

function selectRenderedText() {
  els.copyPreview.focus();
  els.copyPreview.select();
}

function legacyCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
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

async function handleCopyConfirm() {
  const text = els.copyPreview.value;
  let ok = false;
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch (err) {
      ok = false;
    }
  }
  if (!ok) ok = legacyCopy(text);
  if (ok) {
    showCopyStatus("已复制到剪贴板", false);
    copyDone = true;
    els.btnCopyConfirm.textContent = "完成";
  } else {
    selectRenderedText();
    showCopyStatus("请按 ⌘C 手动复制", true);
  }
}

function finishCopyModal() {
  closeCopyModal();
  showView("profiles");
  renderProfiles();
}

function handleCopyConfirmClick() {
  if (copyDone) {
    finishCopyModal();
  } else {
    handleCopyConfirm();
  }
}

function insertToken(token) {
  const ta = document.activeElement;
  const targets = [els.editorHeader, els.editorFooter, els.editorSlot0, els.editorSlot1, els.editorSlot2];
  if (targets.indexOf(ta) !== -1) {
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    ta.value = ta.value.slice(0, start) + token + ta.value.slice(end);
    ta.selectionStart = ta.selectionEnd = start + token.length;
    ta.focus();
  }
}

function switchEditorSlot(n) {
  [els.editorSlot0, els.editorSlot1, els.editorSlot2].forEach((ta, i) => {
    ta.hidden = i !== n;
  });
  els.editorSlotTabs.querySelectorAll(".seg-tab").forEach((tab) => {
    tab.classList.toggle("active", parseInt(tab.dataset.slot, 10) === n);
  });
}

function openProfileEditor(mode, profile) {
  editorMode = mode || "create";
  editingProfileId = profile ? profile.id : null;
  els.editorError.hidden = true;
  els.editorError.textContent = "";
  if (editorMode === "edit" && profile) {
    els.profileEditorTitle.textContent = "编辑档案";
    els.btnEditorConfirm.textContent = "保存修改";
    els.btnEditorCancel.textContent = "放弃修改";
    els.profileName.value = profile.name || "";
    els.editorHeader.value = profile.header || "";
    els.editorFooter.value = profile.footer || "";
    const slots = profile.slots || [];
    els.editorSlot0.value = (slots[0] && slots[0].template) || "";
    els.editorSlot1.value = (slots[1] && slots[1].template) || "";
    els.editorSlot2.value = (slots[2] && slots[2].template) || "";
  } else {
    els.profileEditorTitle.textContent = "新建档案";
    els.btnEditorConfirm.textContent = "创建档案";
    els.btnEditorCancel.textContent = "放弃创建";
    els.profileName.value = "";
    els.editorHeader.value = DEFAULT_HEADER;
    els.editorFooter.value = DEFAULT_FOOTER;
    els.editorSlot0.value = "{时间} @{教师}";
    els.editorSlot1.value = "{时间} @{教师}";
    els.editorSlot2.value = "";
  }
  switchEditorSlot(0);
  els.profileEditor.hidden = false;
  els.profileName.focus();
}

function closeEditor() {
  els.profileEditor.hidden = true;
}

async function handleEditorConfirm() {
  const name = els.profileName.value.trim();
  const header = els.editorHeader.value;
  const footer = els.editorFooter.value;
  const slots = [
    { template: els.editorSlot0.value.trim() },
    { template: els.editorSlot1.value.trim() },
    { template: els.editorSlot2.value.trim() },
  ];
  let res;
  try {
    const body = { name, header, footer, slots };
    if (editorMode === "edit" && editingProfileId) {
      res = await api("/api/profiles/" + editingProfileId, { method: "PUT", body });
    } else {
      res = await api("/api/profiles", { method: "POST", body });
    }
  } catch (err) {
    showEditorError("保存失败：数据没有写进文件，请确认数据文件可写后重试。");
    return;
  }
  if (res && res.error) {
    if (res.error.indexOf("名称") !== -1) {
      showEditorError("学生/班级名称不能为空。");
    } else {
      showEditorError("保存失败：数据没有写进文件，请确认数据文件可写后重试。");
    }
    return;
  }
  closeEditor();
  await renderProfiles();
}

function renderRoomCategoryTabs() {
  els.roomCategoryTabs.querySelectorAll(".seg-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.category === state.activeRoomCategory);
  });
}

function renderRoomEditorTabs() {
  els.roomEditorTabs.querySelectorAll(".seg-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.category === draftRoomCategory);
  });
}

function switchRoomCategory(cat) {
  state.activeRoomCategory = cat;
  renderRoomCategoryTabs();
  renderRooms();
}

function renderRoomTile(room) {
  const tile = document.createElement("div");
  tile.className = "room-tile";
  tile.addEventListener("click", () => {
    if (!roomManageMode) openRoomEditor("edit", room);
  });

  const del = document.createElement("button");
  del.type = "button";
  del.className = "room-tile-x";
  del.setAttribute("aria-label", "删除");
  del.textContent = "×";
  del.hidden = !roomManageMode;
  del.addEventListener("click", (e) => {
    e.stopPropagation();
    openDeleteConfirm("room", room);
  });

  const number = document.createElement("div");
  number.className = "room-tile-number";
  number.textContent = room.number;

  tile.appendChild(del);
  tile.appendChild(number);
  return tile;
}

async function renderRooms() {
  let data;
  try {
    data = await api("/api/rooms");
  } catch (err) {
    data = { rooms: [] };
  }
  state.rooms = data.rooms || [];
  roomsLoaded = true;
  renderRoomCategoryTabs();
  const rooms = state.rooms
    .filter((r) => r.category === state.activeRoomCategory)
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  els.roomGrid.innerHTML = "";
  if (rooms.length === 0) {
    els.roomsEmpty.hidden = false;
  } else {
    els.roomsEmpty.hidden = true;
    for (const room of rooms) {
      els.roomGrid.appendChild(renderRoomTile(room));
    }
  }
}

function openRoomEditor(mode, room) {
  roomEditorMode = mode || "create";
  editingRoomId = room ? room.id : null;
  els.roomEditorError.hidden = true;
  els.roomEditorError.textContent = "";
  if (roomEditorMode === "edit" && room) {
    els.roomEditorTitle.textContent = "编辑教室";
    els.btnRoomConfirm.textContent = "保存修改";
    els.btnRoomCancel.textContent = "放弃修改";
    els.roomNumber.value = room.number || "";
    draftRoomCategory = room.category || "class";
  } else {
    els.roomEditorTitle.textContent = "添加教室";
    els.btnRoomConfirm.textContent = "保存教室";
    els.btnRoomCancel.textContent = "放弃添加";
    els.roomNumber.value = "";
    draftRoomCategory = state.activeRoomCategory;
  }
  renderRoomEditorTabs();
  els.roomEditor.hidden = false;
  els.roomNumber.focus();
}

function closeRoomEditor() {
  els.roomEditor.hidden = true;
}

async function handleRoomConfirm() {
  const number = els.roomNumber.value.trim();
  if (!number) {
    els.roomEditorError.textContent = "教室号不能为空。";
    els.roomEditorError.hidden = false;
    return;
  }
  let res;
  try {
    if (roomEditorMode === "edit" && editingRoomId) {
      res = await api("/api/rooms/" + editingRoomId, { method: "PUT", body: { number, category: draftRoomCategory } });
    } else {
      res = await api("/api/rooms", { method: "POST", body: { number, category: draftRoomCategory } });
    }
  } catch (err) {
    els.roomEditorError.textContent = "保存失败：数据没有写进文件，请确认数据文件可写后重试。";
    els.roomEditorError.hidden = false;
    return;
  }
  if (res && res.error) {
    els.roomEditorError.textContent = res.error;
    els.roomEditorError.hidden = false;
    return;
  }
  closeRoomEditor();
  await renderRooms();
}

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

async function handleConfirmDelete() {
  if (!confirmTarget) return;
  const target = confirmTarget;
  try {
    if (target.kind === "profile") {
      await api("/api/profiles/" + target.item.id, { method: "DELETE" });
    } else if (target.kind === "room") {
      await api("/api/rooms/" + target.item.id, { method: "DELETE" });
    }
  } catch (err) {
    // 删除失败：关闭弹窗后重新渲染，该项仍在列表
  }
  closeConfirm();
  if (target.kind === "room") {
    await renderRooms();
  } else {
    await renderProfiles();
  }
}

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

function hourValues() {
  const values = [];
  for (let h = 6; h <= 23; h++) values.push(String(h));
  return values;
}

function minuteValues() {
  const values = [];
  for (let m = 0; m <= 55; m += 5) values.push(String(m).padStart(2, "0"));
  return values;
}

function valuesForWheel(id) {
  return /-m$/.test(id) ? minuteValues() : hourValues();
}

function snapTo5(value) {
  if (!value) return "";
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value).trim());
  if (!m) return value;
  let total = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  total = Math.round(total / 5) * 5;
  total = Math.max(360, Math.min(1435, total));
  return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
}

function splitClock(clock) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(clock || "").trim());
  if (!m) return { h: "9", m: "00" };
  return { h: m[1], m: m[2] };
}

function wheelHtml(id, values) {
  const rows = values
    .map((v) => '<div class="wheel-row" data-value="' + v + '">' + v + "</div>")
    .join("");
  return (
    '<div class="wheel-column">' +
    '<div class="wheel-band" aria-hidden="true"></div>' +
    '<div class="wheel-scroll" id="' + id + '">' +
    '<div class="wheel-pad"></div>' +
    rows +
    '<div class="wheel-pad"></div>' +
    "</div>" +
    "</div>"
  );
}

function fillTimeCardPickerHtml() {
  return (
    '<div class="field fill-card">' +
    '<label class="label">上课时间</label>' +
    '<div class="time-picker">' +
    '<div class="time-side">' +
    '<div class="time-side-label">开始</div>' +
    '<div class="wheel-group">' +
    wheelHtml("fill-time-wheel-start-h", hourValues()) +
    '<span class="wheel-sep">:</span>' +
    wheelHtml("fill-time-wheel-start-m", minuteValues()) +
    "</div>" +
    "</div>" +
    '<span class="time-range-sep">—</span>' +
    '<div class="time-side">' +
    '<div class="time-side-label">结束</div>' +
    '<div class="wheel-group">' +
    wheelHtml("fill-time-wheel-end-h", hourValues()) +
    '<span class="wheel-sep">:</span>' +
    wheelHtml("fill-time-wheel-end-m", minuteValues()) +
    "</div>" +
    "</div>" +
    "</div>" +
    '<p class="error fill-field-error" data-field="time" hidden></p>' +
    "</div>"
  );
}

function fillTimeCardDirectHtml() {
  return (
    '<div class="field fill-card">' +
    '<label class="label">上课时间</label>' +
    '<div class="fill-time-row">' +
    '<div class="fill-time-col">' +
    '<label class="label" for="fill-time-start">开始</label>' +
    '<input id="fill-time-start" class="input" type="text" placeholder="9:00">' +
    "</div>" +
    '<span class="fill-time-sep">-</span>' +
    '<div class="fill-time-col">' +
    '<label class="label" for="fill-time-end">结束</label>' +
    '<input id="fill-time-end" class="input" type="text" placeholder="10:30">' +
    "</div>" +
    "</div>" +
    '<p class="error fill-field-error" data-field="time" hidden></p>' +
    "</div>"
  );
}

function fillRoomCardPickerHtml() {
  return (
    '<div class="field fill-card">' +
    '<label class="label">教室号</label>' +
    '<div class="segmented fill-room-toggle">' +
    '<button class="seg-tab active" data-room-cat="class" type="button">班课教室</button>' +
    '<button class="seg-tab" data-room-cat="vip" type="button">VIP教室</button>' +
    "</div>" +
    '<div class="room-chip-container"></div>' +
    '<p class="error fill-field-error" data-field="room" hidden></p>' +
    "</div>"
  );
}

function fillRoomCardDirectHtml() {
  return (
    '<div class="field fill-card">' +
    '<label class="label">教室号</label>' +
    '<input id="fill-room" class="input" type="text" placeholder="例如：2802">' +
    '<p class="error fill-field-error" data-field="room" hidden></p>' +
    "</div>"
  );
}

function fillTeacherCardHtml() {
  return (
    '<div class="field fill-card">' +
    '<label class="label">教师</label>' +
    '<input id="fill-teacher" class="input" type="text" placeholder="例如：王国香">' +
    '<p class="error fill-field-error" data-field="teacher" hidden></p>' +
    "</div>"
  );
}

function activeSlotIndices(profile) {
  const idx = [];
  (profile.slots || []).forEach((s, i) => {
    if ((s.template || "").trim()) idx.push(i);
  });
  return idx;
}

function profilePreview(profile) {
  const slot = (profile.slots || []).find((s) => (s.template || "").trim());
  return slot ? slot.template : "";
}

function currentFillProfile() {
  return state.profiles.find((p) => p.id === fillProfileId);
}

function saveCurrentPageToDraft() {
  if (!fillDraft) return;
  const values = currentFillValues();
  fillDraft.room = values.room;
  if (fillPage < fillDraft.slots.length) {
    fillDraft.slots[fillPage] = {
      time: values.start && values.end ? values.start + "-" + values.end : "",
      teacher: values.teacher,
    };
  }
}

function switchFillPage(n) {
  const profile = currentFillProfile();
  if (!profile) return;
  const indices = activeSlotIndices(profile);
  if (n === fillPage || n < 0 || n >= indices.length) return;
  saveCurrentPageToDraft();
  fillPage = n;
  renderFill(profile, null);
}

function renderFill(profile, override) {
  fillProfileId = profile.id;
  els.fillTitle.textContent = profile.name || "";
  els.fillError.hidden = true;
  els.fillError.textContent = "";
  const indices = activeSlotIndices(profile);
  const o = override || {};
  if (fillPage >= indices.length) fillPage = 0;

  if (!fillDraft) {
    fillDraft = { room: o.room !== undefined ? o.room : profile.last_room || "", slots: [] };
    indices.forEach((idx, n) => {
      const slot = profile.slots[idx];
      const sv = (o.slots && o.slots[n]) || {};
      fillDraft.slots.push({
        time: sv.time !== undefined ? sv.time : slot.last_time || "",
        teacher: sv.teacher !== undefined ? sv.teacher : slot.last_teacher || "",
      });
    });
  }

  const cur = fillDraft.slots[fillPage] || { time: "", teacher: "" };
  const isPicker = inputMode === "picker";

  let tabsHtml = '<div class="segmented fill-slot-tabs">';
  indices.forEach((idx, n) => {
    tabsHtml += '<button class="seg-tab' + (n === fillPage ? ' active' : '') + '" data-fillpage="' + n + '" type="button">第 ' + (n + 1) + ' 节</button>';
  });
  tabsHtml += '</div>';

  const cards = [];
  cards.push(isPicker ? fillTimeCardPickerHtml() : fillTimeCardDirectHtml());
  cards.push(isPicker ? fillRoomCardPickerHtml() : fillRoomCardDirectHtml());
  cards.push(fillTeacherCardHtml());
  els.fillFields.innerHTML = tabsHtml + cards.join("");

  if (isPicker) {
    let start = { h: "9", m: "00" };
    let end = { h: "10", m: "30" };
    if (cur.time && cur.time.indexOf("-") !== -1) {
      const parts = cur.time.split("-");
      start = splitClock(snapTo5(parts[0]));
      end = splitClock(snapTo5(parts[1]));
    }
    renderTimeWheels(start, end);
  } else {
    const startEl = document.getElementById("fill-time-start");
    const endEl = document.getElementById("fill-time-end");
    if (cur.time && cur.time.indexOf("-") !== -1) {
      const parts = cur.time.split("-");
      startEl.value = parts[0] || "9:00";
      endEl.value = parts[1] || "10:30";
    } else {
      startEl.value = "9:00";
      endEl.value = "10:30";
    }
  }

  const exists = fillDraft.room && state.rooms.some((r) => r.number === fillDraft.room);
  if (isPicker) {
    selectedRoomNumber = exists ? fillDraft.room : "";
    const match = exists ? state.rooms.find((r) => r.number === fillDraft.room) : null;
    fillRoomCategory = match ? match.category : "class";
    wireRoomToggle();
    renderRoomToggle();
    renderRoomChips();
  } else {
    document.getElementById("fill-room").value = exists ? fillDraft.room : "";
  }
  document.getElementById("fill-teacher").value = cur.teacher;

  els.fillFields.querySelectorAll(".fill-slot-tabs .seg-tab").forEach((tab) => {
    tab.addEventListener("click", () => switchFillPage(parseInt(tab.dataset.fillpage, 10)));
  });
}

async function openFill(profile) {
  if (!roomsLoaded) {
    try {
      const data = await api("/api/rooms");
      state.rooms = data.rooms || [];
    } catch (err) {
      state.rooms = [];
    }
    roomsLoaded = true;
  }
  showView("fill");
  fillPage = 0;
  fillDraft = null;
  const classes = lookupSchedule(profile.name);
  let override;
  if (classes && classes.length > 0) {
    const indices = activeSlotIndices(profile);
    const slots = indices.map((idx, n) => {
      const c = classes[n];
      return c ? { time: c.time || "", teacher: c.teacher || "" } : { time: "", teacher: "" };
    });
    override = { room: classes[0].room || "", slots };
  }
  renderFill(profile, override);
  renderScheduleNote(profile, classes);
}

function getWheelValue(id) {
  const col = document.getElementById(id);
  return col ? col.dataset.selected || "" : "";
}

function snapWheel(col) {
  const values = valuesForWheel(col.id);
  const idx = Math.max(0, Math.min(values.length - 1, Math.round(col.scrollTop / 32)));
  col.scrollTop = idx * 32;
  const selected = values[idx];
  col.dataset.selected = selected;
  col.querySelectorAll(".wheel-row").forEach((row) => {
    row.classList.toggle("selected", row.dataset.value === selected);
  });
}

function renderTimeWheels(start, end) {
  initTimeWheel("fill-time-wheel-start-h", start.h);
  initTimeWheel("fill-time-wheel-start-m", start.m);
  initTimeWheel("fill-time-wheel-end-h", end.h);
  initTimeWheel("fill-time-wheel-end-m", end.m);
}

function initTimeWheel(id, selectedValue) {
  const col = document.getElementById(id);
  if (!col) return;
  const values = valuesForWheel(id);
  let idx = values.indexOf(String(selectedValue));
  if (idx < 0) idx = 0;
  col.scrollTop = idx * 32;

  let scrollTimer = null;
  col.addEventListener("scroll", () => {
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => snapWheel(col), 80);
  });
  col.querySelectorAll(".wheel-row").forEach((row) => {
    row.addEventListener("click", () => {
      const i = values.indexOf(row.dataset.value);
      if (i >= 0) {
        col.scrollTop = i * 32;
        snapWheel(col);
      }
    });
  });
  snapWheel(col);
}

function renderRoomToggle() {
  const toggle = els.fillFields.querySelector(".fill-room-toggle");
  if (!toggle) return;
  toggle.querySelectorAll(".seg-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.roomCat === fillRoomCategory);
  });
}

function wireRoomToggle() {
  const toggle = els.fillFields.querySelector(".fill-room-toggle");
  if (!toggle) return;
  toggle.querySelectorAll(".seg-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      fillRoomCategory = tab.dataset.roomCat;
      renderRoomToggle();
      renderRoomChips();
    });
  });
}

function renderRoomChips() {
  const container = els.fillFields.querySelector(".room-chip-container");
  if (!container) return;
  container.innerHTML = "";
  const rooms = state.rooms.filter((r) => r.category === fillRoomCategory);
  if (rooms.length === 0) {
    const empty = document.createElement("div");
    empty.className = "room-empty-hint";
    const title = document.createElement("strong");
    title.textContent = "还没有教室号";
    const body = document.createElement("p");
    body.textContent = "请先到「教室」页添加教室号，再回来填写。";
    empty.appendChild(title);
    empty.appendChild(body);
    container.appendChild(empty);
    return;
  }
  const group = document.createElement("div");
  group.className = "room-chip-group";
  rooms.forEach((r) => group.appendChild(roomChipEl(r)));
  container.appendChild(group);
}

function roomGroupHeader(text) {
  const h = document.createElement("div");
  h.className = "room-chip-group-header";
  h.textContent = text;
  return h;
}

function roomChipEl(room) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "room-chip" + (room.number === selectedRoomNumber ? " selected" : "");
  chip.textContent = room.number;
  chip.addEventListener("click", () => {
    selectedRoomNumber = room.number;
    els.fillFields.querySelectorAll(".room-chip").forEach((c) => {
      c.classList.toggle("selected", c.textContent === selectedRoomNumber);
    });
  });
  return chip;
}

function currentFillValues() {
  const out = { start: "", end: "", room: "", teacher: "" };
  if (inputMode === "picker") {
    out.start = getWheelValue("fill-time-wheel-start-h") + ":" + getWheelValue("fill-time-wheel-start-m");
    out.end = getWheelValue("fill-time-wheel-end-h") + ":" + getWheelValue("fill-time-wheel-end-m");
    out.room = selectedRoomNumber;
  } else {
    const startEl = document.getElementById("fill-time-start");
    const endEl = document.getElementById("fill-time-end");
    const roomEl = document.getElementById("fill-room");
    out.start = startEl ? startEl.value.trim() : "";
    out.end = endEl ? endEl.value.trim() : "";
    out.room = roomEl ? roomEl.value.trim() : "";
  }
  const teacherEl = document.getElementById("fill-teacher");
  out.teacher = teacherEl ? teacherEl.value : "";
  return out;
}

function toggleInputMode(nextMode) {
  if (nextMode === inputMode) return;
  const profile = currentFillProfile();
  saveCurrentPageToDraft();
  inputMode = nextMode;
  if (profile) renderFill(profile, null);
  try {
    localStorage.setItem("inputMode", nextMode);
  } catch (err) {
    // ignore persistence failure
  }
  updateModeToggle();
}

function updateModeToggle() {
  els.fillModeToggle.querySelectorAll(".seg-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.mode === inputMode);
  });
}

function focusFillInput(id) {
  const el = document.getElementById(id);
  if (el) el.focus();
}

function showFillFieldError(field, message) {
  const el = els.fillFields.querySelector('.fill-field-error[data-field="' + field + '"]');
  if (el) {
    el.textContent = message;
    el.hidden = false;
  }
}

function clearFillFieldErrors() {
  els.fillFields.querySelectorAll(".fill-field-error").forEach((el) => {
    el.textContent = "";
    el.hidden = true;
  });
}

function normalizeClock(hourStr, minuteStr) {
  return parseInt(hourStr, 10) + ":" + minuteStr;
}

async function handleFillConfirm() {
  const profile = state.profiles.find((p) => p.id === fillProfileId);
  if (!profile) return;
  const indices = activeSlotIndices(profile);
  saveCurrentPageToDraft();
  clearFillFieldErrors();
  els.fillError.hidden = true;

  for (let n = 0; n < indices.length; n++) {
    const sv = fillDraft.slots[n] || { time: "", teacher: "" };
    if (sv.time) {
      const parts = sv.time.split("-");
      const re = /^(\d{1,2}):(\d{2})$/;
      const sm = re.exec(parts[0]);
      const em = re.exec(parts[1]);
      if (!sm || !em) {
        fillPage = n; renderFill(profile, null);
        showFillFieldError("time", "时间格式不正确，例如 9:00。");
        return;
      }
      const sh = parseInt(sm[1], 10), sM = parseInt(sm[2], 10);
      const eh = parseInt(em[1], 10), eM = parseInt(em[2], 10);
      if (sh > 23 || sM > 59 || eh > 23 || eM > 59 || sh * 60 + sM >= eh * 60 + eM) {
        fillPage = n; renderFill(profile, null);
        showFillFieldError("time", "开始时间不能晚于结束时间。");
        return;
      }
    }
  }

  const room = fillDraft.room;
  const fullSlots = [{ time: "", teacher: "" }, { time: "", teacher: "" }, { time: "", teacher: "" }];
  indices.forEach((fullIdx, n) => {
    const sv = fillDraft.slots[n] || { time: "", teacher: "" };
    fullSlots[fullIdx] = { time: sv.time, teacher: sv.teacher };
  });

  let res;
  try {
    res = await api("/api/profiles/" + fillProfileId + "/fill", {
      method: "PUT",
      body: { room, slots: fullSlots },
    });
  } catch (err) {
    els.fillError.textContent = "保存失败：数据没有写进文件，请确认数据文件可写后重试。";
    els.fillError.hidden = false;
    return;
  }
  if (res && res.error) {
    els.fillError.textContent = "保存失败：数据没有写进文件，请确认数据文件可写后重试。";
    els.fillError.hidden = false;
    return;
  }
  profile.last_room = room;
  indices.forEach((fullIdx, n) => {
    profile.slots[fullIdx].last_time = fullSlots[fullIdx].time;
    profile.slots[fullIdx].last_teacher = fullSlots[fullIdx].teacher;
  });
  openCopyModal(profile, renderCopyText(profile));
}

function wireEvents() {
  els.navProfiles.addEventListener("click", () => showView("profiles"));
  els.navRooms.addEventListener("click", () => {
    showView("rooms");
    renderRooms();
  });
  els.btnNewProfile.addEventListener("click", () => openProfileEditor("create"));
  els.profilesEmpty.addEventListener("click", () => openProfileEditor("create"));
  els.btnEditorCancel.addEventListener("click", closeEditor);
  els.btnEditorConfirm.addEventListener("click", handleEditorConfirm);
  els.btnNewRoom.addEventListener("click", () => openRoomEditor("create"));
  els.roomsEmpty.addEventListener("click", () => openRoomEditor("create"));
  els.btnRoomCancel.addEventListener("click", closeRoomEditor);
  els.btnRoomConfirm.addEventListener("click", handleRoomConfirm);
  els.roomCategoryTabs.querySelectorAll(".seg-tab").forEach((tab) => {
    tab.addEventListener("click", () => switchRoomCategory(tab.dataset.category));
  });
  els.roomEditorTabs.querySelectorAll(".seg-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      draftRoomCategory = tab.dataset.category;
      renderRoomEditorTabs();
    });
  });
  els.btnConfirmCancel.addEventListener("click", closeConfirm);
  els.btnConfirmDelete.addEventListener("click", handleConfirmDelete);
  els.btnCopyBack.addEventListener("click", closeCopyModal);
  els.btnCopyConfirm.addEventListener("click", handleCopyConfirmClick);
  els.btnFillBack.addEventListener("click", () => showView("profiles"));
  els.btnFillConfirm.addEventListener("click", handleFillConfirm);
  els.fillModeToggle.querySelectorAll(".seg-tab").forEach((tab) => {
    tab.addEventListener("click", () => toggleInputMode(tab.dataset.mode));
  });
  els.editorSlotTabs.querySelectorAll(".seg-tab").forEach((tab) => {
    tab.addEventListener("click", () => switchEditorSlot(parseInt(tab.dataset.slot, 10)));
  });
  document.querySelectorAll(".chip-btn").forEach((btn) => {
    btn.addEventListener("click", () => insertToken(btn.dataset.token));
  });

  els.profileSearch.addEventListener("input", () => {
    searchQuery = els.profileSearch.value;
    renderProfiles();
  });
  els.profileSearch.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      searchQuery = els.profileSearch.value;
      renderProfiles();
    }
  });
  els.profileViewToggle.querySelectorAll(".seg-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      profileView = tab.dataset.view;
      els.profileViewToggle.querySelectorAll(".seg-tab").forEach((t) => {
        t.classList.toggle("active", t.dataset.view === profileView);
      });
      try {
        localStorage.setItem("profileView", profileView);
      } catch (err) {}
      renderProfiles();
    });
  });
  els.btnManageRooms.addEventListener("click", () => {
    roomManageMode = !roomManageMode;
    els.btnManageRooms.classList.toggle("active", roomManageMode);
    renderRooms();
  });
  els.btnExport.addEventListener("click", exportData);
  els.btnImport.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", () => {
    const file = els.importFile.files && els.importFile.files[0];
    if (file) importData(file);
    els.importFile.value = "";
  });
  els.btnImportSchedule.addEventListener("click", handleImportSchedule);
  els.scheduleFile.addEventListener("change", () => {
    const file = els.scheduleFile.files && els.scheduleFile.files[0];
    if (file) importScheduleFromFile(file, els.scheduleDate.value);
    els.scheduleFile.value = "";
  });
  els.btnScheduleCancel.addEventListener("click", closeScheduleModal);
  els.btnScheduleConfirm.addEventListener("click", handleScheduleConfirm);
  els.btnScheduleResult.addEventListener("click", handleScheduleResult);
  els.btnScheduleManual.addEventListener("click", () => {
    els.scheduleFile.click();
  });
  els.btnClearSchedule.addEventListener("click", clearSchedule);
  els.scheduleDate.addEventListener("change", updateScheduleDateDisplay);
  els.scheduleDateBox.addEventListener("click", () => {
    try {
      els.scheduleDate.showPicker();
    } catch (err) {
      els.scheduleDate.focus();
    }
  });
}

async function init() {
  wireEvents();
  let storedMode = null;
  try {
    storedMode = localStorage.getItem("inputMode");
  } catch (err) {
    storedMode = null;
  }
  if (storedMode === "picker" || storedMode === "direct") {
    inputMode = storedMode;
  }
  let storedView = null;
  try {
    storedView = localStorage.getItem("profileView");
  } catch (err) {
    storedView = null;
  }
  if (storedView === "list" || storedView === "card") {
    profileView = storedView;
    els.profileViewToggle.querySelectorAll(".seg-tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.view === profileView);
    });
  }
  try {
    const savedSchedule = localStorage.getItem("schedule");
    if (savedSchedule) {
      const parsed = JSON.parse(savedSchedule);
      if (parsed && typeof parsed === "object") {
        state.schedule = parsed.schedule || {};
        state.scheduleDate = parsed.date || "";
      }
    }
  } catch (err) {}
  updateScheduleStatus();
  updateModeToggle();
  showView("profiles");
  await renderProfiles();
}

document.addEventListener("DOMContentLoaded", init);
