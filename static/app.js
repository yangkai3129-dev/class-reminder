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
  els.profilesView.hidden = !isProfiles;
  els.roomsView.hidden = isProfiles;
  els.navProfiles.classList.toggle("active", isProfiles);
  els.navRooms.classList.toggle("active", !isProfiles);
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
  els.templateComposer.addEventListener("input", renderPreview);
  document.querySelectorAll(".chip-btn").forEach((btn) => {
    btn.addEventListener("click", () => insertToken(btn.dataset.token));
  });
}

async function init() {
  wireEvents();
  showView("profiles");
  await renderProfiles();
}

document.addEventListener("DOMContentLoaded", init);
