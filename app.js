const state = {
  requirements: [],
  statuses: [],
  types: [],
  selectedId: null,
  override: false,
  expanded: new Set(),
  dragId: null,
  maxIdDigits: 1,
  maxCodeChars: 1,
  loadedDbName: "",
  loadedDbPath: "",
  dbDirty: false,
};

const dom = {
  tree: document.getElementById("tree"),
  detailForm: document.getElementById("detailForm"),
  detailEmpty: document.getElementById("detailEmpty"),
  displayCode: document.getElementById("displayCode"),
  dbId: document.getElementById("dbId"),
  viewMeta: document.getElementById("viewMeta"),
  viewTitle: document.getElementById("viewTitle"),
  viewDescription: document.getElementById("viewDescription"),
  viewRationale: document.getElementById("viewRationale"),
  detailView: document.getElementById("detailView"),
  editBtn: document.getElementById("editBtn"),
  editModal: document.getElementById("editModal"),
  editDisplayCode: document.getElementById("editDisplayCode"),
  editDbId: document.getElementById("editDbId"),
  closeEditModal: document.getElementById("closeEditModal"),
  settingsBtn: document.getElementById("settingsBtn"),
  settingsModal: document.getElementById("settingsModal"),
  closeSettingsModal: document.getElementById("closeSettingsModal"),
  loadDbBtn: document.getElementById("loadDbBtn"),
  saveDbBtn: document.getElementById("saveDbBtn"),
  saveAsDbBtn: document.getElementById("saveAsDbBtn"),
  newDbBtn: document.getElementById("newDbBtn"),
  loadDbInput: document.getElementById("loadDbInput"),
  exportBtn: document.getElementById("exportBtn"),
  reqVersion: document.getElementById("reqVersion"),
  reqVersionSave: document.getElementById("reqVersionSave"),
  createModal: document.getElementById("createModal"),
  closeCreateModal: document.getElementById("closeCreateModal"),
  createForm: document.getElementById("createForm"),
  create_display_code: document.getElementById("create_display_code"),
  create_type_id: document.getElementById("create_type_id"),
  create_num_path: document.getElementById("create_num_path"),
  create_parent_id: document.getElementById("create_parent_id"),
  create_status_id: document.getElementById("create_status_id"),
  create_title: document.getElementById("create_title"),
  create_description_md: document.getElementById("create_description_md"),
  create_rationale_md: document.getElementById("create_rationale_md"),
  createError: document.getElementById("createError"),
  createBtn: document.getElementById("createBtn"),
  display_code: document.getElementById("display_code"),
  type_id: document.getElementById("type_id"),
  num_path: document.getElementById("num_path"),
  parent_id: document.getElementById("parent_id"),
  status_id: document.getElementById("status_id"),
  title: document.getElementById("title"),
  description_md: document.getElementById("description_md"),
  rationale_md: document.getElementById("rationale_md"),
  descPreview: document.getElementById("descPreview"),
  ratPreview: document.getElementById("ratPreview"),
  descSuggestions: document.getElementById("descSuggestions"),
  ratSuggestions: document.getElementById("ratSuggestions"),
  overrideMode: document.getElementById("overrideMode"),
  overrideBanner: document.getElementById("overrideBanner"),
  expandAllBtn: document.getElementById("expandAllBtn"),
  collapseAllBtn: document.getElementById("collapseAllBtn"),
  closeDbBtn: document.getElementById("closeDbBtn"),
  newRootBtn: document.getElementById("newRootBtn"),
  saveBtn: document.getElementById("saveBtn"),
  deleteBtn: document.getElementById("deleteBtn"),
  newChildBtn: document.getElementById("newChildBtn"),
  newSiblingBtn: document.getElementById("newSiblingBtn"),
  statusDbPath: document.getElementById("statusDbPath"),
  statusesList: document.getElementById("statusesList"),
  typesList: document.getElementById("typesList"),
  addStatusBtn: document.getElementById("addStatusBtn"),
  addTypeBtn: document.getElementById("addTypeBtn"),
  layout: document.getElementById("layout"),
  splitter: document.getElementById("splitter"),
  statusModal: document.getElementById("statusModal"),
  statusModalTitle: document.getElementById("statusModalTitle"),
  closeStatusModal: document.getElementById("closeStatusModal"),
  statusForm: document.getElementById("statusForm"),
  status_name: document.getElementById("status_name"),
  status_color: document.getElementById("status_color"),
  status_order: document.getElementById("status_order"),
  saveStatusBtn: document.getElementById("saveStatusBtn"),
  typeModal: document.getElementById("typeModal"),
  typeModalTitle: document.getElementById("typeModalTitle"),
  closeTypeModal: document.getElementById("closeTypeModal"),
  typeForm: document.getElementById("typeForm"),
  type_code_input: document.getElementById("type_code_input"),
  type_name: document.getElementById("type_name"),
  type_color: document.getElementById("type_color"),
  type_icon: document.getElementById("type_icon"),
  type_order: document.getElementById("type_order"),
  saveTypeBtn: document.getElementById("saveTypeBtn"),
  themeToggle: document.getElementById("themeToggle"),
  snapshotModal: document.getElementById("snapshotModal"),
  closeSnapshotModal: document.getElementById("closeSnapshotModal"),
  snapshotForm: document.getElementById("snapshotForm"),
  snapshot_version: document.getElementById("snapshot_version"),
  snapshot_theme: document.getElementById("snapshot_theme"),
  snapshotBtn: document.getElementById("snapshotBtn"),
  confirmModal: document.getElementById("confirmModal"),
  confirmMessage: document.getElementById("confirmMessage"),
  confirmOk: document.getElementById("confirmOk"),
  confirmCancel: document.getElementById("confirmCancel"),
};

function updateToolbarHeight() {
  const toolbar = document.querySelector(".toolbar");
  const height = toolbar ? toolbar.getBoundingClientRect().height : 72;
  document.documentElement.style.setProperty("--toolbar-height", `${height}px`);
}

function apiFetch(path, options = {}) {
  return fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  }).then((res) => res.json());
}

function updateSaveControls() {
  dom.saveDbBtn.disabled = !state.dbDirty;
  if (dom.closeDbBtn) {
    const hasLoaded = !!(state.loadedDbName || state.loadedDbPath);
    dom.closeDbBtn.disabled = !hasLoaded && !state.dbDirty;
  }
}

function updateLoadedPathLabels() {
  const label = state.loadedDbPath || state.loadedDbName || "Buffer DB";
  if (dom.statusDbPath) dom.statusDbPath.textContent = label;
}

function loadSettings() {
  const themeReq = fetch("/api/theme")
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      const theme = data?.theme || "light";
      applyTheme(theme);
    });
  const versionReq = fetch("/api/db_version")
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      dom.reqVersion.value = data?.db_version?.requirement_version || "";
    });
  return Promise.all([themeReq, versionReq]).catch(() => {});
}

function markDirty() {
  state.dbDirty = true;
  updateSaveControls();
}

function clearDirty() {
  state.dbDirty = false;
  updateSaveControls();
}

function getCode(req) {
  if (!req) return "";
  return `${req.type_code}${req.num_path}`;
}

function getDisplayLabel(req) {
  const code = getCode(req);
  if (req.display_code && req.display_code.trim()) {
    return `${req.display_code.trim()} (${code})`;
  }
  return code;
}

function buildMaps() {
  state.reqById = new Map(state.requirements.map((r) => [r.id, r]));
  state.codeToId = new Map(
    state.requirements.map((r) => [getCode(r), r.id])
  );
}

function getChildren(parentId) {
  return state.requirements
    .filter((r) => r.parent_id === parentId)
    .sort((a, b) => a.order_index - b.order_index);
}

function renderTree() {
  dom.tree.innerHTML = "";
  buildMaps();
  state.maxIdDigits = Math.max(
    1,
    ...state.requirements.map((r) => String(r.id).length)
  );
  state.maxCodeChars = Math.max(
    1,
    ...state.requirements.map((r) => getDisplayLabel(r).length)
  );
  const roots = getChildren(null);
  roots.forEach((req) => dom.tree.appendChild(renderNode(req, 0)));
}

function renderNode(req, level) {
  const children = getChildren(req.id);
  const hasChildren = children.length > 0;
  const isExpanded = state.expanded.has(req.id);

  const container = document.createElement("div");
  container.className = "tree-node";
  container.style.marginLeft = `${level * 16}px`;

  const item = document.createElement("div");
  item.className = "tree-item";
  if (state.selectedId === req.id) item.classList.add("selected");

  const toggle = document.createElement("div");
  toggle.className = "tree-toggle";
  toggle.textContent = hasChildren ? (isExpanded ? "▾" : "▸") : "";
  toggle.onclick = () => {
    if (!hasChildren) return;
    if (isExpanded) state.expanded.delete(req.id);
    else state.expanded.add(req.id);
    renderTree();
  };

  const label = document.createElement("div");
  label.className = "tree-label";
  label.onclick = () => selectRequirement(req.id);
  label.ondblclick = () => {
    selectRequirement(req.id);
    openEditModal();
  };

  const typeMeta = state.types.find((t) => t.id === req.type_id);
  const dot = document.createElement("span");
  dot.className = "type-dot";
  dot.style.background = typeMeta?.color || "#9aa2b1";

  const text = document.createElement("span");
  text.textContent = getDisplayLabel(req);
  text.className = "req-code";
  text.style.minWidth = `${state.maxCodeChars}ch`;

  const idBadge = document.createElement("span");
  idBadge.className = "db-id";
  idBadge.textContent = `#${req.id}`;
  idBadge.style.minWidth = `${state.maxIdDigits + 1}ch`;

  const title = document.createElement("span");
  title.textContent = req.title ? ` ${req.title}` : "";

  label.appendChild(dot);
  label.appendChild(text);
  label.appendChild(idBadge);
  label.appendChild(title);

  const status = document.createElement("span");
  status.className = "status-badge";
  status.textContent = statusName(req.status_id);
  const statusColor = state.statuses.find((s) => s.id === req.status_id)?.color;
  if (statusColor) {
    status.style.background = statusColor;
  } else {
    status.style.color = "#4a5568";
  }

  item.appendChild(toggle);
  item.appendChild(label);
  item.appendChild(status);
  item.draggable = true;
  item.dataset.reqId = String(req.id);
  item.addEventListener("dragstart", onDragStart);
  item.addEventListener("dragover", onDragOver);
  item.addEventListener("dragenter", onDragEnter);
  item.addEventListener("dragleave", onDragLeave);
  item.addEventListener("drop", onDrop);
  item.addEventListener("dragend", onDragEnd);
  container.appendChild(item);

  if (hasChildren && isExpanded) {
    children.forEach((child) => container.appendChild(renderNode(child, level + 1)));
  }

  return container;
}

function statusName(statusId) {
  return state.statuses.find((s) => s.id === statusId)?.name || "Unknown";
}

function selectRequirement(id) {
  state.selectedId = id;
  dom.detailEmpty.classList.add("hidden");
  dom.detailView.classList.remove("hidden");
  dom.editBtn.disabled = false;
  dom.newChildBtn.disabled = false;
  dom.newSiblingBtn.disabled = false;
  const req = state.reqById.get(id);
  renderView(req);
  renderTree();
}

function renderForm(req) {
  dom.editDisplayCode.textContent = getDisplayLabel(req);
  dom.editDbId.textContent = `#${req.id}`;
  dom.display_code.value = req.display_code || "";
  dom.type_id.value = req.type_id || "";
  dom.num_path.value = req.num_path || "";
  dom.parent_id.value = req.parent_id ?? "";
  dom.status_id.value = req.status_id || "";
  dom.title.value = req.title || "";
  dom.description_md.value = req.description_md || "";
  dom.rationale_md.value = req.rationale_md || "";
  updatePreview();
  updateFieldAccess();
}

function renderView(req) {
  dom.displayCode.textContent = getDisplayLabel(req);
  dom.dbId.textContent = `#${req.id}`;
  const parent = req.parent_id ? state.reqById.get(req.parent_id) : null;
  dom.viewMeta.textContent = [
    `Type: ${req.type_code}`,
    `Number: ${req.num_path}`,
    parent ? `Parent: ${getDisplayLabel(parent)}` : "Parent: none",
    `Status: ${statusName(req.status_id)}`,
  ].join(" | ");
  dom.viewTitle.textContent = req.title || "";
  dom.viewDescription.innerHTML = renderMarkdown(req.description_md);
  dom.viewRationale.innerHTML = renderMarkdown(req.rationale_md || "");
  linkifyPreview(dom.viewDescription);
  linkifyPreview(dom.viewRationale);
}

function updateFieldAccess() {
  const disabled = !state.override;
  dom.type_id.disabled = disabled;
  dom.num_path.disabled = disabled;
  dom.parent_id.disabled = disabled;
  if (dom.create_num_path) {
    dom.create_num_path.disabled = disabled;
  }
}

function updatePreview() {
  dom.descPreview.innerHTML = renderMarkdown(dom.description_md.value);
  dom.ratPreview.innerHTML = renderMarkdown(dom.rationale_md.value);
  linkifyPreview(dom.descPreview);
  linkifyPreview(dom.ratPreview);
}

function renderMarkdown(md) {
  if (!md) return "";
  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>");
  return html;
}

function linkifyPreview(container) {
  const codes = new Set(state.requirements.map((r) => getCode(r)));
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    if (!node.parentElement) return;
    if (["A", "CODE"].includes(node.parentElement.tagName)) return;
    const text = node.nodeValue;
    const regex = /\b(CORE\d+|[A-Z]+\d+(?:\.\d+)*)\b/g;
    let match;
    let lastIndex = 0;
    const parts = [];
    while ((match = regex.exec(text))) {
      const code = match[1];
      if (!codes.has(code)) continue;
      const start = match.index;
      if (start > lastIndex) {
        parts.push(document.createTextNode(text.slice(lastIndex, start)));
      }
      const link = document.createElement("a");
      link.href = "#";
      link.dataset.code = code;
      link.textContent = code;
      parts.push(link);
      lastIndex = start + code.length;
    }
    if (parts.length === 0) return;
    if (lastIndex < text.length) {
      parts.push(document.createTextNode(text.slice(lastIndex)));
    }
    const fragment = document.createDocumentFragment();
    parts.forEach((p) => fragment.appendChild(p));
    node.parentNode.replaceChild(fragment, node);
  });
  container.querySelectorAll("a[data-code]").forEach((link) => {
    link.onclick = (e) => {
      e.preventDefault();
      const id = state.codeToId.get(link.dataset.code);
      if (id) selectRequirement(id);
    };
  });
}

function populateSelects() {
  dom.status_id.innerHTML = "";
  state.statuses.forEach((status) => {
    const option = document.createElement("option");
    option.value = status.id;
    option.textContent = status.name;
    dom.status_id.appendChild(option);
  });

  dom.type_id.innerHTML = "";
  state.types.forEach((type) => {
    const option = document.createElement("option");
    option.value = type.id;
    option.textContent = `${type.type_code} - ${type.name}`;
    dom.type_id.appendChild(option);
  });

  dom.parent_id.innerHTML = "";
  const none = document.createElement("option");
  none.value = "";
  none.textContent = "None";
  dom.parent_id.appendChild(none);

  state.requirements.forEach((req) => {
    const option = document.createElement("option");
    option.value = req.id;
    option.textContent = getDisplayLabel(req);
    dom.parent_id.appendChild(option);
  });

  dom.create_status_id.innerHTML = dom.status_id.innerHTML;
  dom.create_type_id.innerHTML = dom.type_id.innerHTML;
  dom.create_parent_id.innerHTML = dom.parent_id.innerHTML;
}

function renderAdminLists() {
  dom.statusesList.innerHTML = "";
  state.statuses.forEach((status) => {
    const item = document.createElement("div");
    item.className = "admin-item";
    const meta = document.createElement("div");
    meta.className = "meta";
    const dot = document.createElement("span");
    dot.className = "type-dot";
    dot.style.background = status.color || "#9aa2b1";
    const label = document.createElement("span");
    label.textContent = status.name;
    meta.appendChild(dot);
    meta.appendChild(label);
    item.appendChild(meta);
    const actions = document.createElement("div");
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Edit";
    edit.onclick = () => openStatusModal(status);
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "Delete";
    del.onclick = () => deleteStatus(status);
    actions.appendChild(edit);
    actions.appendChild(del);
    item.appendChild(actions);
    dom.statusesList.appendChild(item);
  });

  dom.typesList.innerHTML = "";
  state.types.forEach((type) => {
    const item = document.createElement("div");
    item.className = "admin-item";
    const meta = document.createElement("div");
    meta.className = "meta";
    const dot = document.createElement("span");
    dot.className = "type-dot";
    dot.style.background = type.color || "#9aa2b1";
    const label = document.createElement("span");
    label.textContent = `${type.type_code} - ${type.name}`;
    meta.appendChild(dot);
    meta.appendChild(label);
    item.appendChild(meta);
    const actions = document.createElement("div");
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Edit";
    edit.onclick = () => openTypeModal(type);
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "Delete";
    del.onclick = () => deleteType(type);
    actions.appendChild(edit);
    actions.appendChild(del);
    item.appendChild(actions);
    dom.typesList.appendChild(item);
  });
}

function openEditModal() {
  if (!state.selectedId) return;
  const req = state.reqById.get(state.selectedId);
  renderForm(req);
  dom.editModal.classList.remove("hidden");
}

function closeEditModal() {
  dom.editModal.classList.add("hidden");
}

function openSettingsModal() {
  dom.settingsModal.classList.remove("hidden");
}

function closeSettingsModal() {
  dom.settingsModal.classList.add("hidden");
}

function openStatusModal(status) {
  dom.statusModalTitle.textContent = status ? "Edit Status" : "Add Status";
  dom.statusForm.dataset.statusId = status ? status.id : "";
  dom.status_name.value = status?.name || "";
  dom.status_color.value = status?.color || "";
  dom.status_order.value = status?.order_index ?? 0;
  dom.statusModal.classList.remove("hidden");
}

function closeStatusModal() {
  dom.statusModal.classList.add("hidden");
  dom.statusForm.reset();
  dom.statusForm.dataset.statusId = "";
}

function submitStatusForm(e) {
  e.preventDefault();
  const payload = {
    name: dom.status_name.value.trim(),
    color: dom.status_color.value.trim() || null,
    order_index: Number(dom.status_order.value || 0),
  };
  const statusId = dom.statusForm.dataset.statusId;
  if (!payload.name) return;
  if (statusId) {
    apiFetch(`/api/statuses/${statusId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }).then(() => {
      closeStatusModal();
      markDirty();
      loadAll();
    });
  } else {
    apiFetch("/api/statuses", {
      method: "POST",
      body: JSON.stringify(payload),
    }).then(() => {
      closeStatusModal();
      markDirty();
      loadAll();
    });
  }
}

function openTypeModal(type) {
  if (!state.override) {
    alert("Override mode is required to edit types.");
    return;
  }
  dom.typeModalTitle.textContent = type ? "Edit Type" : "Add Type";
  dom.typeForm.dataset.typeId = type ? type.id : "";
  dom.type_code_input.value = type?.type_code || "";
  dom.type_name.value = type?.name || "";
  dom.type_color.value = type?.color || "";
  dom.type_icon.value = type?.icon || "";
  dom.type_order.value = type?.order_index ?? 0;
  dom.typeModal.classList.remove("hidden");
}

function closeTypeModal() {
  dom.typeModal.classList.add("hidden");
  dom.typeForm.reset();
  dom.typeForm.dataset.typeId = "";
}

function submitTypeForm(e) {
  e.preventDefault();
  if (!state.override) {
    alert("Override mode is required to edit types.");
    return;
  }
  const payload = {
    override: true,
    type_code: dom.type_code_input.value.trim(),
    name: dom.type_name.value.trim(),
    color: dom.type_color.value.trim() || null,
    icon: dom.type_icon.value.trim() || null,
    order_index: Number(dom.type_order.value || 0),
  };
  if (!payload.type_code || !payload.name) return;
  const typeId = dom.typeForm.dataset.typeId;
  if (typeId) {
    apiFetch(`/api/types/${typeId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }).then(() => {
      closeTypeModal();
      markDirty();
      loadAll();
    });
  } else {
    apiFetch("/api/types", {
      method: "POST",
      body: JSON.stringify(payload),
    }).then(() => {
      closeTypeModal();
      markDirty();
      loadAll();
    });
  }
}

function onDragStart(e) {
  state.dragId = Number(e.currentTarget.dataset.reqId);
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", String(state.dragId));
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
}

function onDragEnter(e) {
  e.currentTarget.classList.add("drag-over");
}

function onDragLeave(e) {
  e.currentTarget.classList.remove("drag-over");
}

function onDragEnd(e) {
  e.currentTarget.classList.remove("drag-over");
  state.dragId = null;
}

function onDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove("drag-over");
  const draggedId = state.dragId || Number(e.dataTransfer.getData("text/plain"));
  const targetId = Number(e.currentTarget.dataset.reqId);
  if (!draggedId || draggedId === targetId) return;

  const dragged = state.reqById.get(draggedId);
  const target = state.reqById.get(targetId);
  if (!dragged || !target) return;
  if (dragged.parent_id !== target.parent_id) {
    alert("Drag-and-drop is only supported within the same parent.");
    return;
  }

  const siblings = getChildren(dragged.parent_id);
  const fromIndex = siblings.findIndex((r) => r.id === draggedId);
  const toIndex = siblings.findIndex((r) => r.id === targetId);
  if (fromIndex === -1 || toIndex === -1) return;

  const reordered = siblings.slice();
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);

  Promise.all(
    reordered.map((req, index) =>
      apiFetch(`/api/requirements/${req.id}`, {
        method: "PUT",
        body: JSON.stringify({ order_index: index }),
      })
    )
  ).then(() => {
    markDirty();
    loadAll();
  });
}

function loadAll() {
  return Promise.all([
    apiFetch("/api/requirements"),
    apiFetch("/api/statuses"),
    apiFetch("/api/types"),
  ]).then(([reqs, statuses, types]) => {
    state.requirements = reqs.requirements || [];
    state.statuses = statuses.statuses || [];
    state.types = types.types || [];
    buildMaps();
    populateSelects();
    renderTree();
    renderAdminLists();
  if (state.selectedId && state.reqById.has(state.selectedId)) {
    renderView(state.reqById.get(state.selectedId));
    dom.editBtn.disabled = false;
    dom.newChildBtn.disabled = false;
    dom.newSiblingBtn.disabled = false;
    } else if (state.selectedId) {
      state.selectedId = null;
      dom.detailView.classList.add("hidden");
      dom.editBtn.disabled = true;
      dom.newChildBtn.disabled = true;
      dom.newSiblingBtn.disabled = true;
      dom.detailEmpty.classList.remove("hidden");
    } else {
      dom.editBtn.disabled = true;
      dom.newChildBtn.disabled = true;
      dom.newSiblingBtn.disabled = true;
      dom.detailEmpty.classList.remove("hidden");
    }
    updateSaveControls();
    updateLoadedPathLabels();
  });
}

function getFormPayload() {
  const payload = {
    display_code: dom.display_code.value.trim() || null,
    type_id: Number(dom.type_id.value),
    num_path: dom.num_path.value.trim(),
    parent_id: dom.parent_id.value ? Number(dom.parent_id.value) : null,
    status_id: Number(dom.status_id.value),
    title: dom.title.value.trim(),
    description_md: dom.description_md.value.trim(),
    rationale_md: dom.rationale_md.value.trim() || null,
    override: state.override,
  };
  if (!state.override) {
    delete payload.type_id;
    delete payload.num_path;
    delete payload.parent_id;
  }
  return payload;
}

function openCreateModal(parentId) {
  dom.createForm.dataset.parentId = parentId ?? "";
  dom.create_display_code.value = "";
  dom.create_num_path.value = "";
  dom.create_title.value = "";
  dom.create_description_md.value = "";
  dom.create_rationale_md.value = "";
  const defaultTypeId = parentId
    ? state.reqById.get(parentId).type_id
    : state.types[0]?.id || "";
  dom.create_type_id.value = defaultTypeId;
  dom.create_parent_id.value = parentId ?? "";
  dom.create_status_id.value = state.statuses[0]?.id || "";
  dom.create_num_path.disabled = !state.override;
  dom.createModal.classList.remove("hidden");
}

function closeCreateModal() {
  dom.createModal.classList.add("hidden");
  dom.createForm.reset();
  dom.createForm.dataset.parentId = "";
  if (dom.createError) {
    dom.createError.textContent = "";
    dom.createError.classList.add("hidden");
  }
}

function submitCreateForm(e) {
  e.preventDefault();
  if (dom.createError) {
    dom.createError.textContent = "";
    dom.createError.classList.add("hidden");
  }
  const payload = {
    display_code: dom.create_display_code.value.trim() || null,
    type_id: Number(dom.create_type_id.value),
    num_path: dom.create_num_path.value.trim() || undefined,
    parent_id: dom.create_parent_id.value ? Number(dom.create_parent_id.value) : null,
    status_id: Number(dom.create_status_id.value || state.statuses[0]?.id || 1),
    title: dom.create_title.value.trim() || "New requirement",
    description_md: dom.create_description_md.value.trim() || "New requirement",
    rationale_md: dom.create_rationale_md.value.trim() || null,
    override: state.override,
  };
  if (payload.num_path && !state.override) {
    if (dom.createError) {
      dom.createError.textContent =
        "Number path can only be set in Override mode. Enable Override or leave it empty.";
      dom.createError.classList.remove("hidden");
    }
    return;
  }
  fetch("/api/requirements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then(async (res) => {
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message = data?.error || "Create failed.";
        if (dom.createError) {
          dom.createError.textContent = `Error (${res.status}): ${message}`;
          dom.createError.classList.remove("hidden");
        }
        return;
      }
      closeCreateModal();
      markDirty();
      loadAll();
    })
    .catch(() => {
      if (dom.createError) {
        dom.createError.textContent = "Error: Network request failed.";
        dom.createError.classList.remove("hidden");
      }
    });
}

function saveRequirement(e) {
  e.preventDefault();
  if (!state.selectedId) return;
  const payload = getFormPayload();
  apiFetch(`/api/requirements/${state.selectedId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }).then(() => {
    markDirty();
    loadAll();
  });
}

function deleteRequirement() {
  if (!state.selectedId) return;
  if (!confirm("Delete this requirement and all children?")) return;
  apiFetch(`/api/requirements/${state.selectedId}`, {
    method: "DELETE",
  }).then(() => {
    state.selectedId = null;
    markDirty();
    loadAll();
  });
}

function deleteStatus(status) {
  if (!confirm(`Delete status "${status.name}"?`)) return;
  apiFetch(`/api/statuses/${status.id}`, { method: "DELETE" }).then(() => {
    markDirty();
    loadAll();
  });
}

function deleteType(type) {
  if (!state.override) {
    alert("Override mode is required to delete types.");
    return;
  }
  if (!confirm(`Delete type "${type.type_code}"?`)) return;
  apiFetch(`/api/types/${type.id}`, {
    method: "DELETE",
    body: JSON.stringify({ override: true }),
  }).then(() => {
    markDirty();
    loadAll();
  });
}

function setupSuggestions(textarea, suggestionsEl) {
  textarea.addEventListener("input", () => {
    const cursor = textarea.selectionStart;
    const value = textarea.value.slice(0, cursor);
    const match = value.match(/([A-Z]+\\d+(?:\\.\\d+)*|CORE\\d*)$/);
    if (!match) {
      suggestionsEl.classList.remove("visible");
      suggestionsEl.innerHTML = "";
      return;
    }
    const token = match[1];
    const codes = [...state.codeToId.keys()].filter((c) =>
      c.startsWith(token)
    );
    if (codes.length === 0) {
      suggestionsEl.classList.remove("visible");
      suggestionsEl.innerHTML = "";
      return;
    }
    suggestionsEl.innerHTML = "";
    codes.slice(0, 6).forEach((code) => {
      const item = document.createElement("div");
      item.className = "suggestion-item";
      item.textContent = code;
      item.onclick = () => {
        const start = cursor - token.length;
        const end = cursor;
        textarea.value =
          textarea.value.slice(0, start) + code + textarea.value.slice(end);
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + code.length;
        suggestionsEl.classList.remove("visible");
        updatePreview();
      };
      suggestionsEl.appendChild(item);
    });
    suggestionsEl.classList.add("visible");
  });
}

dom.detailForm.addEventListener("submit", saveRequirement);
dom.deleteBtn.addEventListener("click", deleteRequirement);
dom.newChildBtn.addEventListener("click", () => {
  if (!state.selectedId) return;
  openCreateModal(state.selectedId);
});
dom.newSiblingBtn.addEventListener("click", () => {
  if (!state.selectedId) return;
  const parentId = state.reqById.get(state.selectedId).parent_id;
  openCreateModal(parentId);
});
dom.newRootBtn.addEventListener("click", () => openCreateModal(null));
dom.editBtn.addEventListener("click", openEditModal);
dom.closeEditModal.addEventListener("click", closeEditModal);
dom.settingsBtn.addEventListener("click", openSettingsModal);
dom.closeSettingsModal.addEventListener("click", closeSettingsModal);
dom.exportBtn.addEventListener("click", () => {
  dom.snapshot_version.value = dom.reqVersion.value || "";
  dom.snapshot_theme.checked = document.body.classList.contains("dark");
  dom.snapshotModal.classList.remove("hidden");
});

dom.snapshotForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const version = dom.snapshot_version.value.trim();
  if (!version) return;
  const theme = dom.snapshot_theme.checked ? "dark" : "light";
  fetch(`/api/export?version=${encodeURIComponent(version)}&theme=${theme}`)
    .then((res) => {
      if (!res.ok) throw new Error("Export failed.");
      return res.blob();
    })
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      a.href = url;
      a.download = `requirements_snapshot_v${version}_${stamp}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      dom.snapshotModal.classList.add("hidden");
    })
    .catch((err) => alert(err.message));
});

function setupModalClose(modalEl, closeFn) {
  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) {
      closeFn();
    }
  });
}

function downloadDbFile(filename) {
  fetch("/api/db/export")
    .then((res) => {
      if (!res.ok) throw new Error("Database export failed.");
      return res.blob();
    })
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const safeName = filename || `requirements_${stamp}.ReqDB`;
      const hasExt = /\.reqdb$/i.test(safeName);
      a.href = url;
      a.download = hasExt ? safeName : `${safeName}.ReqDB`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    })
    .catch((err) => alert(err.message));
}

function applySavedFileInfo(fileInfo) {
  if (!fileInfo) return;
  state.loadedDbPath = fileInfo.path || "";
  state.loadedDbName = fileInfo.name || state.loadedDbName;
  updateLoadedPathLabels();
}

function saveAsDb() {
  return fetch("/api/db/save-as", { method: "POST" })
    .then(async (res) => {
      if (!res.ok) throw new Error("Save As not available.");
      return res.json();
    })
    .then((data) => {
      if (data.cancelled) return false;
      applySavedFileInfo({ path: data.path, name: data.name });
      clearDirty();
      return true;
    })
    .catch(() => {
      const suggested = state.loadedDbName || "requirements.ReqDB";
      const name = prompt("Save As (filename)", suggested);
      if (!name) return false;
      downloadDbFile(name);
      state.loadedDbName = name;
      state.loadedDbPath = "";
      updateLoadedPathLabels();
      clearDirty();
      return true;
    });
}

function confirmDialog(message) {
  return new Promise((resolve) => {
    dom.confirmMessage.textContent = message;
    dom.confirmModal.classList.remove("hidden");
    const onOk = () => {
      cleanup();
      resolve(true);
    };
    const onCancel = () => {
      cleanup();
      resolve(false);
    };
    const onBackdrop = (e) => {
      if (e.target === dom.confirmModal) {
        onCancel();
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };
    const cleanup = () => {
      dom.confirmModal.classList.add("hidden");
      dom.confirmOk.removeEventListener("click", onOk);
      dom.confirmCancel.removeEventListener("click", onCancel);
      dom.confirmModal.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKey);
    };
    dom.confirmOk.addEventListener("click", onOk);
    dom.confirmCancel.addEventListener("click", onCancel);
    dom.confirmModal.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKey);
  });
}

async function newDb(confirmMessage) {
  if (state.dbDirty) {
    const message = confirmMessage || "Discard unsaved changes and start a new database?";
    const ok = await confirmDialog(message);
    if (!ok) return;
  }
  fetch("/api/db/new", { method: "POST" })
    .then((res) => {
      if (!res.ok) throw new Error("Failed to create new database.");
      state.loadedDbName = "";
      state.loadedDbPath = "";
      state.selectedId = null;
      dom.reqVersion.value = "";
      dom.detailView.classList.add("hidden");
      dom.detailEmpty.classList.remove("hidden");
      dom.displayCode.textContent = "";
      dom.dbId.textContent = "";
      dom.viewMeta.textContent = "";
      dom.viewTitle.textContent = "";
      if (dom.viewDescription) dom.viewDescription.innerHTML = "";
      dom.viewRationale.innerHTML = "";
      clearDirty();
      updateLoadedPathLabels();
      return loadAll().then(loadSettings);
    })
    .catch((err) => alert(err.message));
}

dom.saveAsDbBtn.addEventListener("click", () => {
  saveAsDb();
});

dom.saveDbBtn.addEventListener("click", () => {
  if (!state.dbDirty) return;
  if (state.loadedDbPath) {
    fetch("/api/db/save", { method: "POST" })
      .then((res) => {
        if (!res.ok) throw new Error("Database save failed.");
        clearDirty();
      })
      .catch((err) => alert(err.message));
    return;
  }
  saveAsDb();
});

dom.loadDbBtn.addEventListener("click", () => {
  dom.loadDbInput.click();
});

dom.newDbBtn.addEventListener("click", () => {
  newDb();
});

dom.closeDbBtn.addEventListener("click", () => {
  newDb("Discard unsaved changes?");
});

dom.loadDbInput.addEventListener("change", async () => {
  const file = dom.loadDbInput.files[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".reqdb")) {
    alert("Only .ReqDB files are supported.");
    dom.loadDbInput.value = "";
    return;
  }
  const buffer = await file.arrayBuffer();
  const headers = { "Content-Type": "application/octet-stream" };
  if (file.path) {
    headers["X-Db-Path"] = file.path;
  }
  headers["X-Db-Name"] = file.name;
  fetch("/api/db/import", {
    method: "POST",
    headers,
    body: buffer,
  })
    .then((res) => {
      if (!res.ok) throw new Error("Database import failed.");
      dom.loadDbInput.value = "";
      state.loadedDbName = file.name;
      state.loadedDbPath = file.path || "";
      clearDirty();
      updateSaveControls();
      updateLoadedPathLabels();
      return loadAll().then(loadSettings);
    })
    .catch((err) => alert(err.message));
});

dom.overrideMode.addEventListener("change", (e) => {
  state.override = e.target.checked;
  dom.overrideBanner.classList.toggle("hidden", !state.override);
  updateFieldAccess();
});

dom.expandAllBtn.addEventListener("click", () => {
  state.expanded = new Set(
    state.requirements.filter((r) => getChildren(r.id).length > 0).map((r) => r.id)
  );
  renderTree();
});

dom.collapseAllBtn.addEventListener("click", () => {
  state.expanded.clear();
  renderTree();
});

dom.description_md.addEventListener("input", updatePreview);
dom.rationale_md.addEventListener("input", updatePreview);

dom.addStatusBtn.addEventListener("click", () => openStatusModal(null));
dom.addTypeBtn.addEventListener("click", () => openTypeModal(null));
dom.closeStatusModal.addEventListener("click", closeStatusModal);
dom.closeTypeModal.addEventListener("click", closeTypeModal);
dom.statusForm.addEventListener("submit", submitStatusForm);
dom.typeForm.addEventListener("submit", submitTypeForm);
dom.closeCreateModal.addEventListener("click", closeCreateModal);
dom.createForm.addEventListener("submit", submitCreateForm);

let reqVersionFlashTimer = null;
let reqVersionFlashValue = "";

function flashReqVersionSaved(value) {
  if (reqVersionFlashTimer) {
    clearTimeout(reqVersionFlashTimer);
    reqVersionFlashTimer = null;
  }
  reqVersionFlashValue = value;
  dom.reqVersion.value = "Saved";
  reqVersionFlashTimer = setTimeout(() => {
    if (dom.reqVersion.value === "Saved") {
      dom.reqVersion.value = reqVersionFlashValue;
    }
    reqVersionFlashTimer = null;
  }, 900);
}
function saveReqVersion() {
  const value = dom.reqVersion.value.trim();
  fetch("/api/db_version", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ db_version: { requirement_version: value } }),
  })
    .then((res) => {
      if (res.ok) {
        flashReqVersionSaved(value);
        markDirty();
      }
    })
    .catch(() => {});
}

dom.reqVersionSave.addEventListener("click", saveReqVersion);
dom.reqVersion.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    saveReqVersion();
  }
});
dom.reqVersion.addEventListener("input", () => {
  if (!reqVersionFlashTimer) return;
  if (dom.reqVersion.value !== "Saved") {
    clearTimeout(reqVersionFlashTimer);
    reqVersionFlashTimer = null;
  }
});
dom.closeSnapshotModal.addEventListener("click", () => {
  dom.snapshotModal.classList.add("hidden");
});
setupModalClose(dom.editModal, closeEditModal);
setupModalClose(dom.settingsModal, closeSettingsModal);
setupModalClose(dom.statusModal, closeStatusModal);
setupModalClose(dom.typeModal, closeTypeModal);
setupModalClose(dom.createModal, closeCreateModal);
setupModalClose(dom.snapshotModal, () => dom.snapshotModal.classList.add("hidden"));

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("dark", isDark);
  dom.themeToggle.checked = isDark;
}

dom.themeToggle.addEventListener("change", (e) => {
  const theme = e.target.checked ? "dark" : "light";
  applyTheme(theme);
  fetch("/api/theme", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ theme }),
  })
    .then((res) => {
      if (!res.ok) return;
    })
    .catch(() => {});
});

document.addEventListener("click", (e) => {
  if (!state.selectedId) return;
  if (!dom.editModal.classList.contains("hidden")) return;
  if (!dom.settingsModal.classList.contains("hidden")) return;
  if (e.target.closest(".tree-item")) return;
  if (e.target.closest(".view-actions")) return;
  if (e.target.closest("button, a, input, select, textarea")) return;
  if (
    e.target.closest(".tree-pane") ||
    e.target.closest(".detail-pane") ||
    e.target === document.body ||
    e.target === document.documentElement
  ) {
    state.selectedId = null;
    dom.detailView.classList.add("hidden");
    dom.editBtn.disabled = true;
    dom.newChildBtn.disabled = true;
    dom.newSiblingBtn.disabled = true;
    dom.detailEmpty.classList.remove("hidden");
    dom.displayCode.textContent = "";
    dom.dbId.textContent = "";
    dom.viewMeta.textContent = "";
    dom.viewTitle.textContent = "";
    if (dom.viewDescription) dom.viewDescription.innerHTML = "";
    dom.viewRationale.innerHTML = "";
    renderTree();
  }
});

setupSuggestions(dom.description_md, dom.descSuggestions);
setupSuggestions(dom.rationale_md, dom.ratSuggestions);

loadSettings().catch(() => {});

let isDragging = false;

dom.splitter.addEventListener("mousedown", () => {
  isDragging = true;
  document.body.style.cursor = "col-resize";
});

window.addEventListener("mouseup", () => {
  if (!isDragging) return;
  isDragging = false;
  document.body.style.cursor = "";
});

window.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  const layoutRect = dom.layout.getBoundingClientRect();
  const min = 240;
  const max = layoutRect.width - 320;
  const next = Math.min(Math.max(e.clientX - layoutRect.left, min), max);
  dom.layout.style.setProperty("--tree-width", `${next}px`);
});

window.addEventListener("resize", () => {
  updateToolbarHeight();
});

updateSaveControls();
updateLoadedPathLabels();
updateToolbarHeight();
loadAll();
