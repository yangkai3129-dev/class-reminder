const PLACEHOLDERS = ["{时间}", "{教室号}", "{老师}"];

const SAMPLE_VALUES = {
  "{时间}": "9:00-10:30",
  "{教室号}": "2802",
  "{老师}": "王国香",
};

const state = {
  profiles: [],
  rooms: [],
  activeView: "profiles",
  activeRoomCategory: "class",
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

const els = {
  navProfiles: document.getElementById("nav-profiles"),
  navRooms: document.getElementById("nav-rooms"),
  profilesView: document.getElementById("profiles-view"),
  roomsView: document.getElementById("rooms-view"),
  profileList: document.getElementById("profile-list"),
  profilesEmpty: document.getElementById("profiles-empty"),
  btnNewProfile: document.getElementById("btn-new-profile"),
  profileEditor: document.getElementById("profile-editor"),
  profileEditorTitle: document.getElementById("profile-editor-title"),
  profileName: document.getElementById("profile-name"),
  templateComposer: document.getElementById("template-composer"),
  templatePreview: document.getElementById("template-preview"),
  editorError: document.getElementById("editor-error"),
  btnEditorCancel: document.getElementById("btn-editor-cancel"),
  btnEditorConfirm: document.getElementById("btn-editor-confirm"),
  btnNewRoom: document.getElementById("btn-new-room"),
  roomCategoryTabs: document.getElementById("room-category-tabs"),
  roomList: document.getElementById("room-list"),
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
  fillFields: document.getElementById("fill-fields"),
  fillError: document.getElementById("fill-error"),
  btnFillBack: document.getElementById("btn-fill-back"),
  btnFillConfirm: document.getElementById("btn-fill-confirm"),
  fillModeToggle: document.getElementById("fill-mode-toggle"),
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
  preview.innerHTML = templateToHtml(profile.template || "");

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

async function renderProfiles() {
  let data;
  try {
    data = await api("/api/profiles");
  } catch (err) {
    data = { profiles: [] };
  }
  state.profiles = data.profiles || [];
  els.profileList.innerHTML = "";
  if (state.profiles.length === 0) {
    els.profilesEmpty.hidden = false;
  } else {
    els.profilesEmpty.hidden = true;
    for (const profile of state.profiles) {
      els.profileList.appendChild(renderProfileRow(profile));
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

function insertToken(token) {
  const composer = els.templateComposer;
  composer.focus();
  const chip = document.createElement("span");
  chip.className = "chip";
  chip.setAttribute("data-token", token);
  chip.setAttribute("contenteditable", "false");
  chip.textContent = token;

  const selection = window.getSelection();
  if (selection && selection.rangeCount) {
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(chip);
    range.setStartAfter(chip);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  } else {
    composer.appendChild(chip);
  }
  renderPreview();
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
    els.templateComposer.innerHTML = templateToHtml(profile.template || "");
  } else {
    els.profileEditorTitle.textContent = "新建档案";
    els.btnEditorConfirm.textContent = "创建档案";
    els.btnEditorCancel.textContent = "放弃创建";
    els.profileName.value = "";
    els.templateComposer.innerHTML = "";
  }
  els.profileEditor.hidden = false;
  renderPreview();
  els.profileName.focus();
}

function closeEditor() {
  els.profileEditor.hidden = true;
}

async function handleEditorConfirm() {
  const name = els.profileName.value.trim();
  const template = serializeComposer(els.templateComposer);
  let res;
  try {
    if (editorMode === "edit" && editingProfileId) {
      res = await api("/api/profiles/" + editingProfileId, { method: "PUT", body: { name, template } });
    } else {
      res = await api("/api/profiles", { method: "POST", body: { name, template } });
    }
  } catch (err) {
    showEditorError("保存失败：数据没有写进文件，请确认数据文件可写后重试。");
    return;
  }
  if (res && res.error) {
    if (res.error.indexOf("占位符") !== -1) {
      showEditorError("模板里至少要有一个占位符（{时间}、{教室号} 或 {老师}）。");
    } else if (res.error.indexOf("名称") !== -1) {
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

function renderRoomRow(room) {
  const row = document.createElement("div");
  row.className = "profile-row";

  const main = document.createElement("div");
  main.className = "profile-row-main";

  const number = document.createElement("div");
  number.className = "room-number";
  number.textContent = room.number;

  main.appendChild(number);

  const actions = document.createElement("div");
  actions.className = "row-actions";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "link-action";
  editBtn.textContent = "编辑";
  editBtn.addEventListener("click", () => openRoomEditor("edit", room));

  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "link-action link-danger";
  delBtn.textContent = "删除";
  delBtn.addEventListener("click", () => openDeleteConfirm("room", room));

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);

  row.appendChild(main);
  row.appendChild(actions);
  return row;
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
  const rooms = state.rooms.filter((r) => r.category === state.activeRoomCategory);
  els.roomList.innerHTML = "";
  if (rooms.length === 0) {
    els.roomsEmpty.hidden = false;
  } else {
    els.roomsEmpty.hidden = true;
    for (const room of rooms) {
      els.roomList.appendChild(renderRoomRow(room));
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

function buildTimeValues() {
  // 06:00 – 23:45, 15-minute steps → 72 values (format H:MM, no leading zero)
  const values = [];
  for (let m = 360; m <= 1425; m += 15) {
    values.push(Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0"));
  }
  return values;
}

function snapTo15(value) {
  if (!value) return "";
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value).trim());
  if (!m) return value;
  const total = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const snapped = Math.round(total / 15) * 15;
  const clamped = Math.max(360, Math.min(1425, snapped));
  return Math.floor(clamped / 60) + ":" + String(clamped % 60).padStart(2, "0");
}

function wheelHtml(id) {
  const rows = buildTimeValues()
    .map((v) => '<div class="wheel-row" data-value="' + v + '">' + v + "</div>")
    .join("");
  return (
    '<div class="wheel-column" id="' + id + '">' +
    '<div class="wheel-band" aria-hidden="true"></div>' +
    '<div class="wheel-pad"></div>' +
    rows +
    '<div class="wheel-pad"></div>' +
    "</div>"
  );
}

function fillTimeCardPickerHtml() {
  return (
    '<div class="field fill-card">' +
    '<label class="label">上课时间</label>' +
    '<div class="wheel-group">' +
    wheelHtml("fill-time-wheel-start") +
    wheelHtml("fill-time-wheel-end") +
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
    '<label class="label">老师</label>' +
    '<input id="fill-teacher" class="input" type="text" placeholder="例如：王国香">' +
    '<p class="error fill-field-error" data-field="teacher" hidden></p>' +
    "</div>"
  );
}

function renderFill(profile, override) {
  fillProfileId = profile.id;
  els.fillTitle.textContent = profile.name || "";
  els.fillError.hidden = true;
  els.fillError.textContent = "";
  const tpl = profile.template || "";
  const isPicker = inputMode === "picker";
  const cards = [];
  if (tpl.indexOf("{时间}") !== -1) cards.push(isPicker ? fillTimeCardPickerHtml() : fillTimeCardDirectHtml());
  if (tpl.indexOf("{教室号}") !== -1) cards.push(isPicker ? fillRoomCardPickerHtml() : fillRoomCardDirectHtml());
  if (tpl.indexOf("{老师}") !== -1) cards.push(fillTeacherCardHtml());
  els.fillFields.innerHTML = cards.join("");

  const o = override || {};
  const hasOverrideTime = o.start !== undefined && o.end !== undefined;
  const lastTime = hasOverrideTime ? o.start + "-" + o.end : profile.last_time || "";
  const roomVal = o.room !== undefined ? o.room : profile.last_room || "";
  const teacherVal = o.teacher !== undefined ? o.teacher : profile.last_teacher || "";

  if (tpl.indexOf("{时间}") !== -1) {
    if (isPicker) {
      let startVal = "9:00";
      let endVal = "10:30";
      if (lastTime && lastTime.indexOf("-") !== -1) {
        const parts = lastTime.split("-");
        startVal = snapTo15(parts[0]);
        endVal = snapTo15(parts[1]);
      }
      renderTimeWheels(startVal, endVal);
    } else {
      const startEl = document.getElementById("fill-time-start");
      const endEl = document.getElementById("fill-time-end");
      if (lastTime && lastTime.indexOf("-") !== -1) {
        const parts = lastTime.split("-");
        startEl.value = parts[0] || "9:00";
        endEl.value = parts[1] || "10:30";
      } else {
        startEl.value = "9:00";
        endEl.value = "10:30";
      }
    }
  }
  if (tpl.indexOf("{教室号}") !== -1) {
    const exists = roomVal && state.rooms.some((r) => r.number === roomVal);
    if (isPicker) {
      selectedRoomNumber = exists ? roomVal : "";
      renderRoomChips();
    } else {
      document.getElementById("fill-room").value = exists ? roomVal : "";
    }
  }
  if (tpl.indexOf("{老师}") !== -1) {
    document.getElementById("fill-teacher").value = teacherVal;
  }
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
  renderFill(profile);
  showView("fill");
}

function getWheelValue(id) {
  const col = document.getElementById(id);
  return col ? col.dataset.selected || "" : "";
}

function snapWheel(col) {
  const values = buildTimeValues();
  const idx = Math.max(0, Math.min(values.length - 1, Math.round(col.scrollTop / 32)));
  col.scrollTop = idx * 32;
  const selected = values[idx];
  col.dataset.selected = selected;
  col.querySelectorAll(".wheel-row").forEach((row) => {
    row.classList.toggle("selected", row.dataset.value === selected);
  });
}

function renderTimeWheels(startValue, endValue) {
  initTimeWheel("fill-time-wheel-start", startValue);
  initTimeWheel("fill-time-wheel-end", endValue);
}

function initTimeWheel(id, selectedValue) {
  const col = document.getElementById(id);
  if (!col) return;
  const values = buildTimeValues();
  let idx = values.indexOf(selectedValue);
  if (idx < 0) idx = values.indexOf("9:00");
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

function renderRoomChips() {
  const container = els.fillFields.querySelector(".room-chip-container");
  if (!container) return;
  container.innerHTML = "";
  if (state.rooms.length === 0) {
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
  const classRooms = state.rooms.filter((r) => r.category === "class");
  const vipRooms = state.rooms.filter((r) => r.category === "vip");
  if (classRooms.length > 0) {
    container.appendChild(roomGroupHeader("班课教室"));
    const group = document.createElement("div");
    group.className = "room-chip-group";
    classRooms.forEach((r) => group.appendChild(roomChipEl(r)));
    container.appendChild(group);
  }
  if (vipRooms.length > 0) {
    container.appendChild(roomGroupHeader("VIP教室"));
    const group = document.createElement("div");
    group.className = "room-chip-group";
    vipRooms.forEach((r) => group.appendChild(roomChipEl(r)));
    container.appendChild(group);
  }
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
    out.start = getWheelValue("fill-time-wheel-start");
    out.end = getWheelValue("fill-time-wheel-end");
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
  const profile = state.profiles.find((p) => p.id === fillProfileId);
  const v = currentFillValues();
  inputMode = nextMode;
  if (profile) renderFill(profile, v);
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
  const tpl = profile.template || "";
  clearFillFieldErrors();
  els.fillError.hidden = true;

  const values = currentFillValues();
  let last_time = "";
  let last_room = "";
  let last_teacher = "";

  if (tpl.indexOf("{时间}") !== -1) {
    const start = values.start.trim();
    const end = values.end.trim();
    const re = /^(\d{1,2}):(\d{2})$/;
    const sm = re.exec(start);
    const em = re.exec(end);
    if (!sm || !em) {
      showFillFieldError("time", "时间格式不正确，例如 9:00。");
      focusFillInput("fill-time-start");
      return;
    }
    const sh = parseInt(sm[1], 10), sM = parseInt(sm[2], 10);
    const eh = parseInt(em[1], 10), eM = parseInt(em[2], 10);
    if (sh > 23 || sM > 59 || eh > 23 || eM > 59) {
      showFillFieldError("time", "时间格式不正确，例如 9:00。");
      focusFillInput("fill-time-start");
      return;
    }
    if (sh * 60 + sM >= eh * 60 + eM) {
      showFillFieldError("time", "开始时间不能晚于结束时间。");
      focusFillInput("fill-time-end");
      return;
    }
    last_time = normalizeClock(sm[1], sm[2]) + "-" + normalizeClock(em[1], em[2]);
  }

  if (tpl.indexOf("{教室号}") !== -1) {
    const room = values.room.trim();
    if (inputMode === "direct" && !room) {
      showFillFieldError("room", "教室号不能为空。");
      focusFillInput("fill-room");
      return;
    }
    last_room = room;
  }

  if (tpl.indexOf("{老师}") !== -1) {
    const teacher = values.teacher.trim();
    if (!teacher) {
      showFillFieldError("teacher", "老师姓名不能为空。");
      focusFillInput("fill-teacher");
      return;
    }
    last_teacher = teacher;
  }

  let res;
  try {
    res = await api("/api/profiles/" + fillProfileId + "/fill", {
      method: "PUT",
      body: { last_time, last_room, last_teacher },
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
  showView("profiles");
  await renderProfiles();
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
  els.btnFillBack.addEventListener("click", () => showView("profiles"));
  els.btnFillConfirm.addEventListener("click", handleFillConfirm);
  els.fillModeToggle.querySelectorAll(".seg-tab").forEach((tab) => {
    tab.addEventListener("click", () => toggleInputMode(tab.dataset.mode));
  });
  els.templateComposer.addEventListener("input", renderPreview);
  document.querySelectorAll(".chip-btn").forEach((btn) => {
    btn.addEventListener("click", () => insertToken(btn.dataset.token));
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
  updateModeToggle();
  showView("profiles");
  await renderProfiles();
}

document.addEventListener("DOMContentLoaded", init);
