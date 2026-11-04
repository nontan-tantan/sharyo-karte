// 車両カルテ 画面ロジック（画面切り替え・登録編集フォームなど）

const views = document.querySelectorAll(".view");
let currentVehicleId = null;
let currentView = "dashboard";

function showView(name) {
  currentView = name;
  views.forEach((view) => {
    view.hidden = view.id !== `view-${name}`;
  });
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("is-current", link.dataset.view === name);
  });
  window.scrollTo(0, 0);
}

// スクロールしたら、固定したヘッダーの下に影を付けて内容と区別する
const appHeader = document.querySelector(".app-header");
window.addEventListener("scroll", () => {
  appHeader.classList.toggle("is-scrolled", window.scrollY > 0);
}, { passive: true });

function todayString() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

function nowTimeString() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

// 変更履歴：編集前後で変わった項目を「〇〇を「A」から「B」に変更」の形で返す
// 比較・変更履歴に使う項目の定義 [項目名, 値の取り出し, 表示形式, 対象となる条件]
function vehicleFieldDefinitions(after) {
  const ins = (v) => v.insurance || {};
  const dis = (v) => v.disposal || {};
  return [
    ["車種", (v) => v.model],
    ["ナンバー", (v) => v.plate],
    ["使用部署", (v) => v.dept],
    ["用途", (v) => v.usage],
    ["稼働状態", (v) => v.status],
    [after.status === "廃車" ? "廃車日" : "売却日", (v) => dis(v).date, formatDate, isRetired],
    [after.status === "廃車" ? "引取業者" : "売却先", (v) => dis(v).partner, null, isRetired],
    ["売却金額", (v) => dis(v).amount, formatYen, (v) => v.status === "売却済"],
    ["売却・廃車の理由・メモ", (v) => dis(v).note, null, isRetired],
    ["車検満了日", (v) => v.shakenExpiresAt, formatDate],
    ["所有／リースの区分", (v) => v.ownership],
    ["購入日", (v) => v.purchaseDate, formatDate, (v) => v.ownership !== "リース"],
    ["リース開始日", (v) => v.lease && v.lease.start, formatDate, (v) => v.ownership === "リース"],
    ["リース終了日", (v) => v.lease && v.lease.end, formatDate, (v) => v.ownership === "リース"],
    ["保険契約", (v) => (ins(v).active ? "あり" : "なし")],
    ["保険会社", (v) => ins(v).company, null, (v) => ins(v).active],
    ["保険の契約開始日", (v) => ins(v).period && ins(v).period.start, formatDate, (v) => ins(v).active],
    ["保険の契約終了日", (v) => ins(v).period && ins(v).period.end, formatDate, (v) => ins(v).active],
    ["保険料の支払方法", (v) => ins(v).premiumCycle || "年払い", null, (v) => ins(v).active],
    ["保険料", (v) => ins(v).premium, formatYen, (v) => ins(v).active],
  ];
}

function showFieldValue(value, format) {
  return format ? format(value) : value || "未入力";
}

function describeChanges(before, after) {
  const changes = [];
  vehicleFieldDefinitions(after).forEach(([label, get, format, applies]) => {
    // 保存後の状態で入力欄が非表示になる項目（例：リースに変えたときの購入日）は比べない
    if (applies && !applies(after)) return;
    const oldValue = get(before) || "";
    const newValue = get(after) || "";
    if (oldValue === newValue) return;
    changes.push(`${label}を「${showFieldValue(oldValue, format)}」から「${showFieldValue(newValue, format)}」に変更`);
  });
  return changes;
}

function updateOwnershipFields() {
  const isLease = document.getElementById("ownership-lease").checked;
  document.getElementById("owned-fields").hidden = isLease;
  document.getElementById("lease-fields").hidden = !isLease;
}

// 売却済・廃車のときだけ売却・廃車の情報欄を表示し、状態に合わせて項目名を切り替える
function updateDisposalFields() {
  const status = document.getElementById("field-status").value;
  const isScrapped = status === "廃車";
  // 売却済・廃車の車両は、車検満了日がなくても保存できる
  document.getElementById("shaken-req").hidden = isRetired({ status });
  document.getElementById("disposal-fields").hidden = !isRetired({ status });
  document.getElementById("label-disposal-date").textContent = isScrapped ? "廃車日" : "売却日";
  document.getElementById("label-disposal-partner").textContent = isScrapped ? "引取業者" : "売却先";
  document.getElementById("row-disposal-amount").hidden = isScrapped;
  document.getElementById("field-disposal-partner").placeholder = isScrapped
    ? "例：道央リサイクルセンター株式会社"
    : "例：北斗オートセンター株式会社";
  document.getElementById("field-disposal-note").placeholder = isScrapped
    ? "例：追突事故で全損"
    : "例：車両入替のため下取り";
}

function updateInsuranceFields() {
  const hasInsurance = document.getElementById("field-has-insurance").checked;
  document.getElementById("insurance-fields").hidden = !hasInsurance;
}

function clearFormError() {
  const errorEl = document.getElementById("form-error");
  errorEl.hidden = true;
  errorEl.textContent = "";
}

function showFormError(message) {
  const errorEl = document.getElementById("form-error");
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function fillForm(vehicle) {
  document.getElementById("field-model").value = vehicle.model || "";
  document.getElementById("field-plate").value = vehicle.plate || "";
  document.getElementById("field-dept").value = vehicle.dept || "総務部";
  document.getElementById("field-usage").value = vehicle.usage || "";
  document.getElementById("field-status").value = vehicle.status || "稼働中";
  document.getElementById("field-shaken").value = vehicle.shakenExpiresAt || "";

  const disposal = vehicle.disposal || {};
  document.getElementById("field-disposal-date").value = disposal.date || "";
  document.getElementById("field-disposal-partner").value = disposal.partner || "";
  document.getElementById("field-disposal-amount").value = disposal.amount || "";
  document.getElementById("field-disposal-note").value = disposal.note || "";

  const isLease = vehicle.ownership === "リース";
  document.getElementById(isLease ? "ownership-lease" : "ownership-owned").checked = true;
  document.getElementById("field-purchase-date").value = vehicle.purchaseDate || "";
  document.getElementById("field-lease-start").value = (vehicle.lease && vehicle.lease.start) || "";
  document.getElementById("field-lease-end").value = (vehicle.lease && vehicle.lease.end) || "";

  const hasInsurance = !!(vehicle.insurance && vehicle.insurance.active);
  document.getElementById("field-has-insurance").checked = hasInsurance;
  document.getElementById("field-insurance-company").value = (vehicle.insurance && vehicle.insurance.company) || "";
  document.getElementById("field-insurance-start").value = (vehicle.insurance && vehicle.insurance.period && vehicle.insurance.period.start) || "";
  document.getElementById("field-insurance-end").value = (vehicle.insurance && vehicle.insurance.period && vehicle.insurance.period.end) || "";
  document.getElementById("field-premium-cycle").value = (vehicle.insurance && vehicle.insurance.premiumCycle) || "年払い";
  document.getElementById("field-insurance-premium").value = (vehicle.insurance && vehicle.insurance.premium) || "";
}

// 操作者：最後に入力した部署・名前を、ブラウザのタブを閉じるまで引き継ぐ
// （共用パソコンで別の人の名前が残り続けないよう、localStorage ではなく sessionStorage に保存する）
const LAST_EDITOR_KEY = "lastEditor";

function getLastEditor() {
  try {
    const raw = sessionStorage.getItem(LAST_EDITOR_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setLastEditor(dept, name) {
  try {
    sessionStorage.setItem(LAST_EDITOR_KEY, JSON.stringify({ dept, name }));
  } catch (e) {
    // 保存できない環境では引き継がない
  }
}

function fillLastEditor(deptId, nameId) {
  const last = getLastEditor();
  if (!last) return;
  document.getElementById(deptId).value = last.dept;
  document.getElementById(nameId).value = last.name;
}

function enterFormMode(mode) {
  document.getElementById("vehicle-form").reset();
  clearFormError();
  const editing = mode === "edit" && currentVehicleId;
  document.getElementById("form-title").textContent = editing ? `車両の編集（${currentVehicleId}）` : "新規登録";
  fillLastEditor("field-editor-dept", "field-editor-name");

  const idField = document.getElementById("field-id");

  if (mode === "edit" && currentVehicleId) {
    const vehicle = getVehicles().find((v) => v.id === currentVehicleId);
    if (vehicle) fillForm(vehicle);
    idField.value = currentVehicleId;
    idField.readOnly = true;
  } else {
    idField.value = getNextVehicleId();
    idField.readOnly = false;
  }
  idField.dataset.autoId = idField.value;

  updateOwnershipFields();
  updateInsuranceFields();
  updateDisposalFields();

  formDraftKey = mode === "edit" && currentVehicleId ? `edit:${currentVehicleId}` : "new";
  formInitialState = readFormState();
}

// 下書き：入力のたびに自動保存し、ウィンドウを閉じても残るようにする

let formDraftKey = null;
let formInitialState = null;

function readFormState() {
  const state = {};
  document.querySelectorAll("#vehicle-form input[id], #vehicle-form select[id]").forEach((el) => {
    state[el.id] = el.type === "checkbox" || el.type === "radio" ? el.checked : el.value;
  });
  return state;
}

function writeFormState(state) {
  Object.entries(state).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === "checkbox" || el.type === "radio") el.checked = value;
    else el.value = value;
  });
}

function isFormDirty() {
  return formInitialState !== null && JSON.stringify(readFormState()) !== JSON.stringify(formInitialState);
}

function autosaveDraft() {
  if (!formDraftKey) return;
  if (!isFormDirty()) {
    deleteDraft(formDraftKey);
    return;
  }
  const idField = document.getElementById("field-id");
  saveDraft(formDraftKey, {
    mode: idField.readOnly ? "edit" : "new",
    vehicleId: idField.readOnly ? idField.value : "",
    model: document.getElementById("field-model").value.trim(),
    autoId: idField.dataset.autoId,
    savedAt: `${todayString()} ${nowTimeString()}`,
    state: readFormState(),
  });
}

function restoreDraft(draft) {
  writeFormState(draft.state);
  const idField = document.getElementById("field-id");
  if (idField.readOnly) {
    // 編集：下書きのあとに統合でIDが変わっていても、今のIDで編集する
    idField.value = currentVehicleId;
  } else {
    idField.dataset.autoId = draft.autoId;
    // 下書きのあとに同じIDが使われていたら、空いている番号に振り直す
    if (isVehicleIdTaken(idField.value)) {
      idField.value = getNextVehicleId();
      idField.dataset.autoId = idField.value;
    }
  }
  updateOwnershipFields();
  updateInsuranceFields();
  updateDisposalFields();
}

// フォームを開いたとき、下書きがあれば続きから入力するか確認する
async function offerDraftRestore() {
  const draft = getDrafts()[formDraftKey];
  if (!draft) return;
  const choice = await askChoice({
    title: "入力途中の下書きがあります",
    message: `${draft.savedAt} に保存した下書きがあります。続きから入力しますか？`,
    choices: [
      { value: "discard", label: "下書きを破棄して入力し直す", kind: "secondary" },
      { value: "restore", label: "続きから入力する", kind: "primary" },
    ],
  });
  if (choice === "restore") restoreDraft(draft);
  else if (choice === "discard") deleteDraft(formDraftKey);
}

// 入力途中でフォームを離れるときの確認。移動してよければ true を返す
async function confirmLeaveForm() {
  if (currentView !== "form" || !isFormDirty()) return true;
  const choice = await askChoice({
    title: "保存していない入力があります",
    message: "入力した内容はまだ保存されていません。下書きとして残しておくと、あとで続きから入力できます。",
    choices: [
      { value: "back", label: "入力に戻る", kind: "secondary" },
      { value: "discard", label: "破棄して移動", kind: "secondary" },
      { value: "keep", label: "下書きとして残して移動", kind: "primary" },
    ],
  });
  if (choice === "keep") {
    autosaveDraft();
  } else if (choice === "discard") {
    deleteDraft(formDraftKey);
  } else {
    return false;
  }
  formDraftKey = null;
  formInitialState = null;
  return true;
}

// フォームを閉じて元の画面（編集なら車両詳細、新規なら車両一覧）に戻る
function closeForm() {
  const isEditing = document.getElementById("field-id").readOnly;
  if (isEditing) {
    openVehicleDetail(currentVehicleId);
  } else {
    renderVehicleList();
    showView("list");
  }
}

let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3000);
}

const vehicleForm = document.getElementById("vehicle-form");
vehicleForm.addEventListener("input", autosaveDraft);
vehicleForm.addEventListener("change", autosaveDraft);
window.addEventListener("beforeunload", autosaveDraft);

document.getElementById("form-save-draft").addEventListener("click", () => {
  const dirty = isFormDirty();
  autosaveDraft();
  formDraftKey = null;
  formInitialState = null;
  closeForm();
  showToast(dirty ? "下書きを保存しました。ダッシュボードから続きを入力できます。" : "変更がないため、下書きは保存しませんでした。");
});

document.querySelectorAll('input[name="ownership"]').forEach((radio) => {
  radio.addEventListener("change", updateOwnershipFields);
});
document.getElementById("field-has-insurance").addEventListener("change", updateInsuranceFields);
document.getElementById("field-status").addEventListener("change", updateDisposalFields);

document.getElementById("form-cancel").addEventListener("click", async () => {
  if (!(await confirmLeaveForm())) return;
  closeForm();
});

document.getElementById("vehicle-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFormError();

  const idField = document.getElementById("field-id");
  const id = idField.readOnly ? idField.value : normalizeVehicleId(idField.value);
  const editorName = normalizeText(document.getElementById("field-editor-name").value);
  const editorDept = document.getElementById("field-editor-dept").value;
  const editor = editorName ? `${editorName}（${editorDept}）` : "";

  if (!id) {
    showFormError("社内車両IDを入力してください。");
    return;
  }
  if (!editorName) {
    showFormError("操作者名を入力してください。");
    return;
  }

  const isEditing = idField.readOnly;

  if (!isEditing && isVehicleIdTaken(id)) {
    showFormError(`車両ID「${id}」はすでに使われています。別のIDを入力してください。`);
    return;
  }

  const isLease = document.getElementById("ownership-lease").checked;
  const hasInsurance = document.getElementById("field-has-insurance").checked;

  const vehicle = {
    id,
    model: normalizeText(document.getElementById("field-model").value),
    plate: formatPlate(document.getElementById("field-plate").value),
    dept: document.getElementById("field-dept").value,
    usage: normalizeText(document.getElementById("field-usage").value),
    status: document.getElementById("field-status").value,
    shakenExpiresAt: document.getElementById("field-shaken").value,
    ownership: isLease ? "リース" : "所有",
    purchaseDate: isLease ? "" : document.getElementById("field-purchase-date").value,
    lease: {
      start: isLease ? document.getElementById("field-lease-start").value : "",
      end: isLease ? document.getElementById("field-lease-end").value : "",
    },
    insurance: {
      active: hasInsurance,
      company: hasInsurance ? document.getElementById("field-insurance-company").value.trim() : "",
      period: {
        start: hasInsurance ? document.getElementById("field-insurance-start").value : "",
        end: hasInsurance ? document.getElementById("field-insurance-end").value : "",
      },
      premiumCycle: hasInsurance ? document.getElementById("field-premium-cycle").value : "",
      premium: hasInsurance ? document.getElementById("field-insurance-premium").value : "",
    },
    history: [],
  };

  // 必須項目（期限アラートに使う日付も含む）と、日付の前後をチェックする
  const missing = [
    [!vehicle.model, "車種"],
    [!vehicle.plate, "ナンバー"],
    [!isRetired(vehicle) && !vehicle.shakenExpiresAt, "車検満了日"],
    [hasInsurance && !vehicle.insurance.period.end, "保険の契約期間（終了）"],
  ].filter(([isMissing]) => isMissing).map(([, label]) => label);
  if (missing.length) {
    showFormError(`次の項目を入力してください：${missing.join("、")}`);
    return;
  }
  const reversed = [
    [vehicle.lease, "リース終了日がリース開始日より前になっています。"],
    [vehicle.insurance.period, "保険の契約期間（終了）が契約期間（開始）より前になっています。"],
  ].find(([period]) => period.start && period.end && period.end < period.start);
  if (reversed) {
    showFormError(reversed[1]);
    return;
  }

  const isSold = vehicle.status === "売却済";
  vehicle.disposal = isRetired(vehicle)
    ? {
        date: document.getElementById("field-disposal-date").value,
        partner: normalizeText(document.getElementById("field-disposal-partner").value),
        amount: isSold ? document.getElementById("field-disposal-amount").value : "",
        note: normalizeText(document.getElementById("field-disposal-note").value),
      }
    : { date: "", partner: "", amount: "", note: "" };

  // 同じナンバーの車両がすでにあれば、統合するかどうかを確認する
  let mergeTargetId = null;
  const duplicates = findDuplicateVehicles(vehicle, getVehicles(), isEditing ? id : null);
  if (duplicates.length) {
    const other = duplicates[0];
    const choice = await askChoice({
      title: "同じナンバーの車両が登録されています",
      message: `ナンバー「${other.plate}」の車両が、${other.dept}の「${other.id}」（${other.model || "車種未入力"}）としてすでに登録されています。同じ車両を重複して登録していませんか？`,
      choices: [
        { value: "back", label: "戻って修正する", kind: "secondary" },
        { value: "separate", label: "別の車両として保存", kind: "secondary" },
        { value: "merge", label: "保存して統合へ進む", kind: "primary" },
      ],
    });
    if (choice !== "separate" && choice !== "merge") return;
    if (choice === "merge") mergeTargetId = other.id;
  }

  // 重複は上で確認済みのため、それ以外の要確認だけを確認する
  const issues = getVehicleIssues(vehicle).filter((issue) => issue.type !== "duplicate");
  if (issues.length) {
    const lines = issues.map((issue) => `・${issue.title}\n　${issue.detail}`).join("\n");
    const ok = window.confirm(`この内容は「要確認」になります。\n\n${lines}\n\nこのまま保存しますか？`);
    if (!ok) return;
  }

  if (isEditing) {
    const existing = getVehicles().find((v) => v.id === id);
    vehicle.history = existing ? existing.history || [] : [];
    vehicle.formerIds = existing ? existing.formerIds || [] : [];
    const changes = existing ? describeChanges(existing, vehicle) : [];

    vehicle.history.unshift({
      date: todayString(),
      time: nowTimeString(),
      note: changes.length ? changes.join("\n") : "内容の変更なしで保存",
      editor,
    });
    updateVehicle(vehicle);
  } else {
    vehicle.formerIds = [];
    vehicle.history = [{ date: todayString(), time: nowTimeString(), note: "新規登録", editor }];
    saveVehicle(vehicle);
  }
  recordIssuedVehicleId(vehicle.id);
  setLastEditor(editorDept, editorName);
  deleteDraft(formDraftKey);
  formDraftKey = null;
  formInitialState = null;

  openVehicleDetail(vehicle.id);
  if (mergeTargetId) openMergeDialog(vehicle.id, mergeTargetId);
});

function statusPillClass(status) {
  if (status === "登録取消") return "status-cancelled";
  if (status === "売却済" || status === "廃車") return "status-sold";
  if (status === "休止中") return "status-paused";
  return "status-active";
}

// 車両詳細（車両カルテ）

function formatDate(dateString) {
  if (!dateString) return "未入力";
  const [y, m, d] = dateString.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}

function formatPeriod(start, end) {
  if (!start && !end) return "未入力";
  return `${formatDate(start)} 〜 ${formatDate(end)}`;
}

function formatYen(value) {
  if (value === "" || value == null) return "未入力";
  return `${Number(value).toLocaleString("ja-JP")}円`;
}

// 支払方法が未設定の古いデータは年払いとして扱う
function formatPremium(premium, cycle) {
  if (premium === "" || premium == null) return "未入力";
  if (cycle === "月払い") {
    return `月払い ${formatYen(premium)}（年額換算 ${formatYen(Number(premium) * 12)}）`;
  }
  return `年払い ${formatYen(premium)}`;
}

// 売却済・廃車の車両だけ、基本情報タブに売却・廃車の情報を表示する
function disposalRows(vehicle) {
  if (!isRetired(vehicle)) return [];
  const disposal = vehicle.disposal || {};
  if (vehicle.status === "廃車") {
    return [
      ["廃車日", formatDate(disposal.date)],
      ["引取業者", disposal.partner],
      ["理由・メモ", disposal.note],
    ];
  }
  return [
    ["売却日", formatDate(disposal.date)],
    ["売却先", disposal.partner],
    ["売却金額", formatYen(disposal.amount)],
    ["理由・メモ", disposal.note],
  ];
}

function fillFieldGrid(dl, rows) {
  dl.innerHTML = "";
  rows.forEach(([label, value]) => {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value || "未入力";
    dl.appendChild(dt);
    dl.appendChild(dd);
  });
}

function showDetailTab(name) {
  document.querySelectorAll(".tab-button").forEach((button) => {
    const selected = button.dataset.tab === name;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", selected);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.hidden = panel.id !== `panel-${name}`;
  });
}

function renderVehicleDetail() {
  const vehicle = getVehicles().find((v) => v.id === currentVehicleId);
  if (!vehicle) return;

  document.getElementById("detail-id").textContent = vehicle.id;
  document.getElementById("detail-model").textContent = vehicle.model || "（車種未入力）";
  document.getElementById("detail-meta").textContent =
    [vehicle.plate, vehicle.dept].filter(Boolean).join("　／　");

  const cancelled = isCancelled(vehicle);
  const statusText = cancelled ? "登録取消" : vehicle.status || "";
  const statusPill = document.getElementById("detail-status");
  statusPill.className = `status-pill ${statusPillClass(statusText)}`;
  statusPill.textContent = statusText;

  // 取り消した登録は編集できないようにし、取り消しの記録と「元に戻す」を表示する
  document.getElementById("detail-cancelled").hidden = !cancelled;
  document.getElementById("detail-edit").hidden = cancelled;
  document.getElementById("detail-cancel").hidden = cancelled;
  if (cancelled) {
    const c = vehicle.cancellation;
    document.getElementById("detail-cancelled-detail").textContent =
      `${c.date} ${c.time}　${c.editor}　理由：${c.reason}`;
  }

  const issues = getVehicleIssues(vehicle);
  const warning = document.getElementById("detail-warning");
  const warningText = document.getElementById("detail-warning-text");
  warningText.innerHTML = "";
  issues.forEach((issue) => {
    const strong = document.createElement("strong");
    strong.textContent = `要確認：${issue.title}`;
    const p = document.createElement("div");
    p.textContent = issue.detail;
    if (issue.type === "duplicate") {
      const mergeButton = document.createElement("button");
      mergeButton.type = "button";
      mergeButton.className = "btn-link warn-action";
      mergeButton.textContent = `「${issue.duplicateId}」と統合する`;
      mergeButton.addEventListener("click", () => openMergeDialog(vehicle.id, issue.duplicateId));
      p.appendChild(mergeButton);
    }
    warningText.appendChild(strong);
    warningText.appendChild(p);
  });
  warning.hidden = issues.length === 0;

  const formerIds = vehicle.formerIds || [];
  fillFieldGrid(document.getElementById("detail-basic"), [
    ...(formerIds.length ? [["旧車両ID", `${formerIds.join("、")}（欠番）`]] : []),
    ["車種", vehicle.model],
    ["ナンバー", vehicle.plate],
    ["使用部署", vehicle.dept],
    ["用途", vehicle.usage],
    ["稼働状態", vehicle.status],
    ...disposalRows(vehicle),
    ["車検満了日", formatDate(vehicle.shakenExpiresAt)],
  ]);

  const lease = vehicle.lease || {};
  fillFieldGrid(document.getElementById("detail-own"),
    vehicle.ownership === "リース"
      ? [["区分", "リース"], ["契約期間", formatPeriod(lease.start, lease.end)]]
      : [["区分", "所有"], ["購入日", formatDate(vehicle.purchaseDate)]]
  );

  const insurance = vehicle.insurance || {};
  const period = insurance.period || {};
  fillFieldGrid(document.getElementById("detail-insurance"),
    insurance.active
      ? [
          ["契約状況", "有効"],
          ["保険会社", insurance.company],
          ["契約期間", formatPeriod(period.start, period.end)],
          ["保険料", formatPremium(insurance.premium, insurance.premiumCycle)],
        ]
      : [["契約状況", "契約なし"]]
  );

  renderHistory(vehicle.history || []);

  showDetailTab("basic");
}

function renderHistory(history) {
  document.getElementById("history-count").textContent = `全${history.length}件`;
  const list = document.getElementById("history-list");
  list.innerHTML = "";

  if (!history.length) {
    const li = document.createElement("li");
    li.className = "item-empty";
    li.textContent = "変更履歴はまだありません";
    list.appendChild(li);
    return;
  }

  history.forEach((entry) => {
    const li = document.createElement("li");
    li.className = "history-item";

    const meta = document.createElement("div");
    meta.className = "meta";
    const when = document.createElement("span");
    when.textContent = entry.time ? `${entry.date} ${entry.time}` : entry.date;
    const who = document.createElement("span");
    who.textContent = `入力：${entry.editor || "不明"}`;
    meta.appendChild(when);
    meta.appendChild(who);

    const note = document.createElement("div");
    note.className = "note";
    note.textContent = entry.note;

    li.appendChild(meta);
    li.appendChild(note);
    list.appendChild(li);
  });
}

function openVehicleDetail(id) {
  currentVehicleId = id;
  renderVehicleDetail();
  showView("detail");
}

document.querySelectorAll(".tab-button").forEach((button) => {
  button.addEventListener("click", () => showDetailTab(button.dataset.tab));
});

function populateUsageFilter() {
  const select = document.getElementById("filter-usage");
  const current = select.value;
  select.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "用途：すべて";
  select.appendChild(allOption);

  const usages = Array.from(new Set(getVehicles().map((v) => v.usage).filter(Boolean))).sort();
  usages.forEach((usage) => {
    const option = document.createElement("option");
    option.value = usage;
    option.textContent = usage;
    select.appendChild(option);
  });

  if (usages.includes(current)) select.value = current;
}

function createCell(text, className) {
  const td = document.createElement("td");
  td.className = className;
  td.textContent = text || "";
  return td;
}

function renderVehicleList() {
  populateUsageFilter();

  const dept = document.getElementById("filter-dept").value;
  const usage = document.getElementById("filter-usage").value;
  const status = document.getElementById("filter-status").value;
  const ownership = document.getElementById("filter-ownership").value;
  const keyword = normalizeForSearch(document.getElementById("filter-keyword").value);

  const allVehicles = getVehicles();
  const showCancelled = status === "登録取消";
  const listed = allVehicles.filter((v) => isCancelled(v) === showCancelled);
  const vehicles = listed.filter((v) => {
    if (dept && v.dept !== dept) return false;
    if (usage && v.usage !== usage) return false;
    if (status && !showCancelled && v.status !== status) return false;
    if (ownership && v.ownership !== ownership) return false;
    if (keyword) {
      const haystack = normalizeForSearch(`${v.id} ${(v.formerIds || []).join(" ")} ${v.model} ${v.plate}`);
      if (!haystack.includes(keyword)) return false;
    }
    return true;
  });

  const tbody = document.getElementById("vehicle-table-body");
  tbody.innerHTML = "";

  vehicles.forEach((v) => {
    const tr = document.createElement("tr");
    tr.appendChild(createCell(v.id, "col-id"));
    tr.appendChild(createCell(v.model, "col-model"));
    tr.appendChild(createCell(v.plate, "col-plate"));
    tr.appendChild(createCell(v.dept, "col-dept"));
    tr.appendChild(createCell(v.usage, "col-usage"));

    const statusText = isCancelled(v) ? "登録取消" : v.status || "";
    const statusTd = document.createElement("td");
    statusTd.className = "col-status";
    const pill = document.createElement("span");
    pill.className = `status-pill ${statusPillClass(statusText)}`;
    pill.textContent = statusText;
    statusTd.appendChild(pill);
    tr.appendChild(statusTd);

    const flagTd = document.createElement("td");
    flagTd.className = "flag-cell col-flag";
    const issues = getVehicleIssues(v, allVehicles);
    if (issues.length) {
      const flag = document.createElement("span");
      flag.className = "issue-flag";
      flag.textContent = "⚠ 要確認";
      flag.title = issues.map((issue) => issue.title).join("\n");
      flagTd.appendChild(flag);
    }
    tr.appendChild(flagTd);

    tr.addEventListener("click", () => openVehicleDetail(v.id));
    tbody.appendChild(tr);
  });

  document.getElementById("list-result-count").textContent = showCancelled
    ? `登録を取り消した車両　${vehicles.length}件を表示`
    : `全${listed.length}件中　${vehicles.length}件を表示`;
}

["filter-dept", "filter-usage", "filter-status", "filter-ownership"].forEach((id) => {
  document.getElementById(id).addEventListener("change", renderVehicleList);
});
document.getElementById("filter-keyword").addEventListener("input", renderVehicleList);

document.querySelectorAll("[data-view]").forEach((el) => {
  el.addEventListener("click", async () => {
    if (!(await confirmLeaveForm())) return;
    const target = el.dataset.view;

    if (target === "form") {
      enterFormMode(el.dataset.mode || "new");
      showView("form");
      offerDraftRestore();
      return;
    }

    if (target === "list") {
      renderVehicleList();
    }

    if (target === "dashboard") {
      renderDashboard();
    }

    showView(target);
  });
});

// ダッシュボード

const EXPIRY_ALERT_DAYS = 30;

// 今日から期限日までの日数（過ぎていればマイナス）
function daysUntil(dateString) {
  const [y, m, d] = dateString.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / (24 * 60 * 60 * 1000));
}

function expiryBadgeText(days) {
  if (days < 0) return `${-days}日超過`;
  if (days === 0) return "今日まで";
  return `あと${days}日`;
}

// 期限日が30日以内か過ぎている車両を、期限の近い順に返す（売却済・廃車・登録取消は除く）
function getExpiringVehicles(vehicles, getDate) {
  return vehicles
    .filter((v) => !isRetired(v) && !isCancelled(v))
    .map((v) => ({ vehicle: v, date: getDate(v) }))
    .filter((item) => item.date)
    .map((item) => ({ ...item, days: daysUntil(item.date) }))
    .filter((item) => item.days <= EXPIRY_ALERT_DAYS)
    .sort((a, b) => a.days - b.days);
}

function renderEmptyRow(list) {
  const li = document.createElement("li");
  li.className = "item-empty";
  li.textContent = "該当する車両はありません";
  list.appendChild(li);
}

function renderExpiryList(listId, countId, items, dateLabel) {
  const list = document.getElementById(listId);
  list.innerHTML = "";
  document.getElementById(countId).textContent = `${items.length}件`;
  if (!items.length) {
    renderEmptyRow(list);
    return;
  }

  items.forEach(({ vehicle, date, days }) => {
    const li = document.createElement("li");
    const row = document.createElement("button");
    row.type = "button";
    row.className = "item-row";

    const main = document.createElement("div");
    main.className = "item-main";
    const id = document.createElement("div");
    id.className = "id";
    id.textContent = vehicle.id;
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = vehicle.model || "（車種未入力）";
    const sub = document.createElement("div");
    sub.className = "sub";
    sub.textContent = `${[vehicle.dept, vehicle.usage].filter(Boolean).join(" ／ ")}　${dateLabel}：${formatDate(date)}`;
    main.appendChild(id);
    main.appendChild(name);
    main.appendChild(sub);

    const badge = document.createElement("span");
    badge.className = days < 0 ? "item-badge is-overdue" : "item-badge";
    badge.textContent = expiryBadgeText(days);

    row.appendChild(main);
    row.appendChild(badge);
    row.addEventListener("click", () => openVehicleDetail(vehicle.id));
    li.appendChild(row);
    list.appendChild(li);
  });
}

function renderIssueList(flagged) {
  const list = document.getElementById("issues-list");
  list.innerHTML = "";
  document.getElementById("issues-count").textContent = `${flagged.length}件`;
  if (!flagged.length) {
    renderEmptyRow(list);
    return;
  }

  flagged.forEach(({ vehicle, issues }) => {
    const li = document.createElement("li");
    const row = document.createElement("button");
    row.type = "button";
    row.className = "item-row";

    const icon = document.createElement("span");
    icon.className = "alert-icon";
    icon.textContent = "!";

    const text = document.createElement("div");
    text.className = "alert-text";
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = `${vehicle.id}　${vehicle.model || "（車種未入力）"}${vehicle.dept ? `（${vehicle.dept}）` : ""}`;
    text.appendChild(name);
    issues.forEach((issue) => {
      const desc = document.createElement("div");
      desc.className = "desc";
      desc.textContent = `${issue.detail}${issue.title}。`;
      text.appendChild(desc);
    });

    row.appendChild(icon);
    row.appendChild(text);
    row.addEventListener("click", () => openVehicleDetail(vehicle.id));
    li.appendChild(row);
    list.appendChild(li);
  });
}

// 編集の下書きの車両が、統合でIDが変わっていても見つけられるようにする
function findVehicleForDraft(vehicleId, vehicles) {
  return vehicles.find((v) => v.id === vehicleId || (v.formerIds || []).includes(vehicleId));
}

function renderDrafts(vehicles) {
  const notice = document.getElementById("draft-notice");
  const list = document.getElementById("draft-list");
  list.innerHTML = "";

  const entries = Object.entries(getDrafts()).filter(([key, draft]) => {
    if (draft.mode !== "edit") return true;
    if (findVehicleForDraft(draft.vehicleId, vehicles)) return true;
    deleteDraft(key); // 車両が見つからない下書きは片付ける
    return false;
  });
  notice.hidden = entries.length === 0;

  entries.forEach(([key, draft]) => {
    const li = document.createElement("li");
    li.className = "draft-item";

    const text = document.createElement("div");
    const name = document.createElement("div");
    name.className = "draft-name";
    name.textContent = draft.mode === "edit"
      ? `${draft.vehicleId}　${draft.model || "（車種未入力）"} の編集`
      : `新規登録　${draft.model || "（車種未入力）"}`;
    const when = document.createElement("div");
    when.className = "draft-when";
    when.textContent = `${draft.savedAt} に保存`;
    text.appendChild(name);
    text.appendChild(when);

    const actions = document.createElement("div");
    actions.className = "draft-actions";
    const discard = document.createElement("button");
    discard.type = "button";
    discard.className = "btn-link";
    discard.textContent = "破棄";
    discard.addEventListener("click", () => {
      if (!window.confirm("この下書きを破棄します。よろしいですか？")) return;
      deleteDraft(key);
      renderDashboard();
    });
    const resume = document.createElement("button");
    resume.type = "button";
    resume.className = "btn btn-primary btn-small";
    resume.textContent = "続きを入力";
    resume.addEventListener("click", () => {
      if (draft.mode === "edit") {
        currentVehicleId = findVehicleForDraft(draft.vehicleId, getVehicles()).id;
      }
      enterFormMode(draft.mode);
      showView("form");
      restoreDraft(draft);
      // 車両IDが変わっていた場合は、新しいIDの下書きとして保存し直す
      if (key !== formDraftKey) deleteDraft(key);
      autosaveDraft();
    });
    actions.appendChild(discard);
    actions.appendChild(resume);

    li.appendChild(text);
    li.appendChild(actions);
    list.appendChild(li);
  });
}

function renderDashboard() {
  const vehicles = getVehicles();
  renderDrafts(vehicles);
  const owned = vehicles.filter((v) => !isRetired(v) && !isCancelled(v));

  const insuranceItems = getExpiringVehicles(vehicles, (v) =>
    v.insurance && v.insurance.active && v.insurance.period ? v.insurance.period.end : ""
  );
  const shakenItems = getExpiringVehicles(vehicles, (v) => v.shakenExpiresAt);
  const flagged = vehicles
    .map((v) => ({ vehicle: v, issues: getVehicleIssues(v, vehicles) }))
    .filter((item) => item.issues.length);

  document.getElementById("sum-owned").textContent = owned.length;
  document.getElementById("sum-active").textContent = owned.filter((v) => v.status === "稼働中").length;
  document.getElementById("sum-paused").textContent = owned.filter((v) => v.status === "休止中").length;
  document.getElementById("sum-insurance").textContent = insuranceItems.length;
  document.getElementById("sum-shaken").textContent = shakenItems.length;
  document.getElementById("sum-issues").textContent = flagged.length;

  // 期限・要確認が0件のときは注意の色を使わず、要確認のアイコンはチェックにする
  [["sum-insurance", insuranceItems], ["sum-shaken", shakenItems], ["sum-issues", flagged]].forEach(([id, items]) => {
    document.getElementById(id).closest(".summary-item").classList.toggle("is-zero", items.length === 0);
  });
  document.getElementById("sum-issues-icon").setAttribute("href", flagged.length ? "#i-alert" : "#i-check");

  renderExpiryList("insurance-list", "insurance-count", insuranceItems, "保険終了日");
  renderExpiryList("shaken-list", "shaken-count", shakenItems, "車検満了日");
  renderIssueList(flagged);
}

// 1日1回の要確認アラート（その日に初めて開いたときだけ表示）

function showDailyIssueAlert() {
  const today = todayString();
  if (getLastIssueAlertDate() === today) return;

  const allVehicles = getVehicles();
  const flagged = allVehicles.filter((v) => getVehicleIssues(v, allVehicles).length);
  if (!flagged.length) return;

  const dialog = document.getElementById("issue-alert");
  const list = document.getElementById("issue-alert-list");
  list.innerHTML = "";

  flagged.forEach((v) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "issue-alert-item";

    const name = document.createElement("span");
    name.className = "issue-alert-name";
    name.textContent = `${v.id}　${v.model || "（車種未入力）"}　${v.plate || ""}`;
    const titles = document.createElement("span");
    titles.className = "issue-alert-titles";
    titles.textContent = getVehicleIssues(v, allVehicles).map((issue) => issue.title).join(" ／ ");

    button.appendChild(name);
    button.appendChild(titles);
    button.addEventListener("click", () => {
      dialog.close();
      openVehicleDetail(v.id);
    });
    li.appendChild(button);
    list.appendChild(li);
  });

  setLastIssueAlertDate(today);
  dialog.showModal();
}

document.getElementById("issue-alert-close").addEventListener("click", () => {
  document.getElementById("issue-alert").close();
});

// 選択肢つきの確認ダイアログ。選んだ value を返す（Escキーで閉じたときは null）
function askChoice({ title, message, choices }) {
  const dialog = document.getElementById("choice-dialog");
  document.getElementById("choice-title").textContent = title;
  document.getElementById("choice-message").textContent = message;
  const actions = document.getElementById("choice-actions");
  actions.innerHTML = "";

  return new Promise((resolve) => {
    choices.forEach(({ value, label, kind }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `btn btn-${kind || "secondary"}`;
      button.textContent = label;
      button.addEventListener("click", () => {
        dialog.close();
        resolve(value);
      });
      actions.appendChild(button);
    });
    dialog.addEventListener("cancel", () => resolve(null), { once: true });
    dialog.showModal();
  });
}

// 重複登録の統合

let mergePair = null;

function registeredDate(vehicle) {
  const history = vehicle.history || [];
  return history.length ? history[history.length - 1].date : "";
}

function openMergeDialog(idA, idB) {
  const vehicles = getVehicles();
  const a = vehicles.find((v) => v.id === idA);
  const b = vehicles.find((v) => v.id === idB);
  if (!a || !b) return;
  mergePair = [a, b];

  // 初期値は先に登録されていたほうを残す
  const defaultKeepId = (registeredDate(b) || "9999") < (registeredDate(a) || "9999") ? b.id : a.id;

  const options = document.getElementById("merge-options");
  options.innerHTML = "";
  mergePair.forEach((v) => {
    const label = document.createElement("label");
    label.className = "merge-option";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "merge-keep";
    radio.value = v.id;
    radio.checked = v.id === defaultKeepId;
    const text = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = `${v.id} を残す`;
    const sub = document.createElement("span");
    sub.className = "merge-option-sub";
    sub.textContent = `${v.dept}　${v.model || "（車種未入力）"}　${v.plate}　登録日：${registeredDate(v) || "不明"}`;
    text.appendChild(title);
    text.appendChild(sub);
    label.appendChild(radio);
    label.appendChild(text);
    options.appendChild(label);
  });

  // 内容が違う項目を一覧にする
  const diffs = vehicleFieldDefinitions(a).filter(([, get, format]) =>
    showFieldValue(get(a) || "", format) !== showFieldValue(get(b) || "", format)
  );
  const diffBox = document.getElementById("merge-diffs");
  diffBox.innerHTML = "";
  const caption = document.createElement("p");
  caption.className = "merge-caption";
  caption.textContent = diffs.length
    ? "内容が異なる項目（統合後は「残す車両」の内容になります。必要なら統合後に編集してください）"
    : "2台の登録内容は、車両ID以外すべて同じです。";
  diffBox.appendChild(caption);
  if (diffs.length) {
    const table = document.createElement("table");
    table.className = "merge-table";
    const head = document.createElement("tr");
    ["項目", a.id, b.id].forEach((text) => {
      const th = document.createElement("th");
      th.textContent = text;
      head.appendChild(th);
    });
    table.appendChild(head);
    diffs.forEach(([label, get, format]) => {
      const tr = document.createElement("tr");
      [label, showFieldValue(get(a) || "", format), showFieldValue(get(b) || "", format)].forEach((text) => {
        const td = document.createElement("td");
        td.textContent = text;
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    diffBox.appendChild(table);
  }

  // 操作者の部署プルダウンは登録フォームと同じ選択肢を使う
  const deptSelect = document.getElementById("merge-editor-dept");
  deptSelect.innerHTML = document.getElementById("field-editor-dept").innerHTML;
  document.getElementById("merge-editor-name").value = "";
  fillLastEditor("merge-editor-dept", "merge-editor-name");
  document.getElementById("merge-error").hidden = true;

  document.getElementById("merge-dialog").showModal();
}

document.getElementById("merge-cancel").addEventListener("click", () => {
  document.getElementById("merge-dialog").close();
});

document.getElementById("merge-submit").addEventListener("click", () => {
  const errorEl = document.getElementById("merge-error");
  const editorName = normalizeText(document.getElementById("merge-editor-name").value);
  if (!editorName) {
    errorEl.textContent = "操作者名を入力してください。";
    errorEl.hidden = false;
    return;
  }
  const editorDept = document.getElementById("merge-editor-dept").value;
  const editor = `${editorName}（${editorDept}）`;
  setLastEditor(editorDept, editorName);
  const keepId = document.querySelector('input[name="merge-keep"]:checked').value;
  const remove = mergePair.find((v) => v.id !== keepId);

  mergeVehicles(keepId, remove.id, {
    date: todayString(),
    time: nowTimeString(),
    note: `${remove.dept}の「${remove.id}」を統合（同じナンバーの重複登録のため。「${remove.id}」は欠番）`,
    editor,
  });

  document.getElementById("merge-dialog").close();
  openVehicleDetail(keepId);
});

// 登録の取り消し／取り消しを元に戻す（理由と操作者を変更履歴に残す）

function openCancelDialog() {
  const vehicle = getVehicles().find((v) => v.id === currentVehicleId);
  if (!vehicle) return;
  const restoring = isCancelled(vehicle);
  document.getElementById("cancel-title").textContent = restoring ? "取り消しを元に戻す" : "登録の取り消し";
  document.getElementById("cancel-note").textContent = restoring
    ? `「${vehicle.id}」の登録を元に戻し、一覧やダッシュボードに再び表示します。`
    : `「${vehicle.id}」（${vehicle.model || "車種未入力"}）の登録を取り消します。間違えて登録した車両に使ってください。取り消した車両は一覧やダッシュボードに表示されなくなりますが、記録は残り、あとから元に戻せます。売却・廃車した車両は、取り消さずに稼働状態を変更してください。`;
  document.getElementById("cancel-reason-label").textContent = restoring ? "元に戻す理由（任意）" : "取り消す理由";
  document.getElementById("cancel-reason").placeholder = restoring ? "例：誤って取り消したため" : "例：二重に登録したため";
  document.getElementById("cancel-reason").value = "";
  const submit = document.getElementById("cancel-submit");
  submit.textContent = restoring ? "元に戻す" : "取り消す";
  submit.dataset.restoring = restoring ? "1" : "";

  const deptSelect = document.getElementById("cancel-editor-dept");
  deptSelect.innerHTML = document.getElementById("field-editor-dept").innerHTML;
  document.getElementById("cancel-editor-name").value = "";
  fillLastEditor("cancel-editor-dept", "cancel-editor-name");
  document.getElementById("cancel-error").hidden = true;
  document.getElementById("cancel-dialog").showModal();
}

document.getElementById("detail-cancel").addEventListener("click", openCancelDialog);
document.getElementById("detail-restore").addEventListener("click", openCancelDialog);
document.getElementById("cancel-close").addEventListener("click", () => {
  document.getElementById("cancel-dialog").close();
});

document.getElementById("cancel-submit").addEventListener("click", (event) => {
  const restoring = !!event.currentTarget.dataset.restoring;
  const errorEl = document.getElementById("cancel-error");
  const reason = normalizeText(document.getElementById("cancel-reason").value);
  const editorName = normalizeText(document.getElementById("cancel-editor-name").value);
  const editorDept = document.getElementById("cancel-editor-dept").value;
  const missing = [[!restoring && !reason, "取り消す理由"], [!editorName, "操作者名"]]
    .filter(([isMissing]) => isMissing).map(([, label]) => label);
  if (missing.length) {
    errorEl.textContent = `次の項目を入力してください：${missing.join("、")}`;
    errorEl.hidden = false;
    return;
  }
  const editor = `${editorName}（${editorDept}）`;
  setLastEditor(editorDept, editorName);
  const entry = { date: todayString(), time: nowTimeString(), editor };

  if (restoring) {
    setVehicleCancellation(currentVehicleId, null, {
      ...entry,
      note: reason ? `登録の取り消しを元に戻す（理由：${reason}）` : "登録の取り消しを元に戻す",
    });
    showToast("登録の取り消しを元に戻しました。");
  } else {
    setVehicleCancellation(currentVehicleId, { ...entry, reason }, { ...entry, note: `登録を取り消し（理由：${reason}）` });
    deleteDraft(`edit:${currentVehicleId}`);
    showToast("登録を取り消しました。車両一覧の稼働状態で「登録取消」を選ぶと確認できます。");
  }
  document.getElementById("cancel-dialog").close();
  renderVehicleDetail();
});

// 動作確認用：サンプルデータの追加（sample-data.js を外したときはボタンごと無効）
document.getElementById("add-sample").addEventListener("click", () => {
  if (typeof addSampleVehicles !== "function") return;
  const ok = window.confirm("動作確認用のサンプル車両17台を追加します。今あるデータはそのまま残ります。よろしいですか？");
  if (!ok) return;
  const ids = addSampleVehicles();
  renderDashboard();
  window.alert(`サンプル車両を${ids.length}台追加しました（${ids[0]}〜${ids[ids.length - 1]}）。`);
});

renderDashboard();
showView("dashboard");
showDailyIssueAlert();
