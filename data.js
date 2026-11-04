// 車両カルテ データ操作（localStorageへの保存・取得など）

const STORAGE_KEY = "vehicles";

function getVehicles() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveVehicles(vehicles) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles));
}

function saveVehicle(vehicle) {
  const vehicles = getVehicles();
  vehicles.push(vehicle);
  saveVehicles(vehicles);
}

function updateVehicle(vehicle) {
  const vehicles = getVehicles();
  const index = vehicles.findIndex((v) => v.id === vehicle.id);
  if (index === -1) return;
  vehicles[index] = vehicle;
  saveVehicles(vehicles);
}

function deleteVehicle(id) {
  saveVehicles(getVehicles().filter((v) => v.id !== id));
}

// 車両ID：全社通しの連番（例：V-001）。登録したあとは、部署異動があっても変えない
// 一度発行した番号は、売却・廃車・削除・統合のあとも再利用しない（欠番にする）
// 以前の採番ルールで登録した「GA-001」などのIDは、そのまま使い続ける
const VEHICLE_ID_PREFIX = "V";
const ID_COUNTER_KEY = "vehicleIdCounters";

function getIdCounters() {
  const raw = localStorage.getItem(ID_COUNTER_KEY);
  return raw ? JSON.parse(raw) : {};
}

// 現在のIDと旧ID（統合で欠番になったIDなど）をすべて含めて、使われたことのあるIDか調べる
function isVehicleIdTaken(id) {
  return getVehicles().some((v) => v.id === id || (v.formerIds || []).includes(id));
}

function parseVehicleId(id) {
  const match = /^([A-Z0-9]+)-(\d+)$/.exec(id || "");
  return match ? { prefix: match[1], number: parseInt(match[2], 10) } : null;
}

// 次の番号を返す（まだ発行済みとして記録はしない）
function getNextVehicleId() {
  const prefix = VEHICLE_ID_PREFIX;
  let max = getIdCounters()[prefix] || 0;
  getVehicles().forEach((v) => {
    [v.id, ...(v.formerIds || [])].forEach((id) => {
      const parsed = parseVehicleId(id);
      if (parsed && parsed.prefix === prefix) max = Math.max(max, parsed.number);
    });
  });
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

// 保存したIDを発行済みとして記録する
function recordIssuedVehicleId(id) {
  const parsed = parseVehicleId(id);
  if (!parsed) return;
  const counters = getIdCounters();
  counters[parsed.prefix] = Math.max(counters[parsed.prefix] || 0, parsed.number);
  localStorage.setItem(ID_COUNTER_KEY, JSON.stringify(counters));
}

// 売却済・廃車は保有台数や期限アラートの対象外
function isRetired(vehicle) {
  return vehicle.status === "売却済" || vehicle.status === "廃車";
}

// 登録の取り消し：誤って登録した車両は削除せず、取り消した記録を残して普段の表示から外す
function isCancelled(vehicle) {
  return !!vehicle.cancellation;
}

// cancellation に { date, time, reason, editor } を渡すと取り消し、null を渡すと元に戻す
function setVehicleCancellation(id, cancellation, historyEntry) {
  const vehicles = getVehicles();
  const vehicle = vehicles.find((v) => v.id === id);
  if (!vehicle) return;
  vehicle.cancellation = cancellation;
  vehicle.history = [historyEntry, ...(vehicle.history || [])];
  saveVehicles(vehicles);
}

// 入力の表記ゆれをそろえる（保存時に使う）
// 英数字・記号・スペースは半角に、連続するスペースは1つにまとめ、前後のスペースは取る
const DASH_PATTERN = /[‐‑‒–—―−ー]/g;

function normalizeText(value) {
  return (value || "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

// 車両ID：半角大文字にそろえ、スペースは取り除く（例：「ｖ－００１」→「V-001」）
function normalizeVehicleId(id) {
  return normalizeText(id).replace(/\s/g, "").replace(DASH_PATTERN, "-").toUpperCase();
}

// ナンバー：ハイフンの種類もそろえる（例：「札幌４００　さ　２１－８７」→「札幌400 さ 21-87」）
function formatPlate(plate) {
  return normalizeText(plate).replace(DASH_PATTERN, "-");
}

// ナンバーの比較用の文字列（スペースの有無も無視する）
function normalizePlate(plate) {
  return formatPlate(plate).replace(/\s/g, "");
}

// 検索用の文字列：全角半角・大文字小文字・スペースの有無・ハイフンの種類を無視する
function normalizeForSearch(text) {
  return normalizeText(text).replace(/\s/g, "").replace(DASH_PATTERN, "-").toLowerCase();
}

// 同じナンバーで登録されている別の車両を返す（売却済・廃車・登録取消は対象外）
function findDuplicateVehicles(vehicle, vehicles = getVehicles(), excludeId = vehicle.id) {
  const key = normalizePlate(vehicle.plate);
  if (!key || isRetired(vehicle) || isCancelled(vehicle)) return [];
  return vehicles.filter(
    (v) => v.id !== excludeId && !isRetired(v) && !isCancelled(v) && normalizePlate(v.plate) === key
  );
}

// 整合性チェック：要確認の内容を配列で返す（問題なければ空配列）
function getVehicleIssues(vehicle, vehicles = getVehicles()) {
  const issues = [];
  if (isCancelled(vehicle)) return issues;
  if (isRetired(vehicle) && vehicle.insurance && vehicle.insurance.active) {
    issues.push({
      type: "insurance",
      title: "保険契約の終了状況を確認してください",
      detail: `車両状態が「${vehicle.status}」ですが、保険契約は「有効」のままになっています。`,
    });
  }
  findDuplicateVehicles(vehicle, vehicles).forEach((other) => {
    issues.push({
      type: "duplicate",
      duplicateId: other.id,
      title: "重複登録の疑いがあります",
      detail: `同じナンバー「${vehicle.plate}」の車両が、${other.dept}の「${other.id}」としても登録されています。`,
    });
  });
  return issues;
}

// 重複登録の統合：keepId の車両を残し、removeId の車両を削除する
// 削除する車両のIDは欠番として旧IDに残し、変更履歴は日時順にまとめて引き継ぐ
function mergeVehicles(keepId, removeId, historyEntry) {
  const vehicles = getVehicles();
  const keep = vehicles.find((v) => v.id === keepId);
  const remove = vehicles.find((v) => v.id === removeId);
  if (!keep || !remove) return;

  keep.formerIds = [...(keep.formerIds || []), remove.id, ...(remove.formerIds || [])];
  const carriedOver = (remove.history || []).map((entry) => ({
    ...entry,
    note: `［${remove.id}の履歴］${entry.note}`,
  }));
  const sortKey = (entry) => `${entry.date} ${entry.time || ""}`;
  keep.history = [...(keep.history || []), ...carriedOver].sort((a, b) =>
    sortKey(b).localeCompare(sortKey(a))
  );
  keep.history.unshift(historyEntry);

  saveVehicles(vehicles.filter((v) => v.id !== removeId).map((v) => (v.id === keepId ? keep : v)));
}

// 1日1回の要確認アラート：最後に表示した日付を記録する
const ISSUE_ALERT_KEY = "lastIssueAlertDate";

function getLastIssueAlertDate() {
  return localStorage.getItem(ISSUE_ALERT_KEY);
}

function setLastIssueAlertDate(dateString) {
  localStorage.setItem(ISSUE_ALERT_KEY, dateString);
}

// 登録・編集フォームの下書き：新規登録は "new"、編集は "edit:車両ID" のキーで1件ずつ保存する
const DRAFT_KEY = "vehicleDrafts";

function getDrafts() {
  const raw = localStorage.getItem(DRAFT_KEY);
  return raw ? JSON.parse(raw) : {};
}

function saveDraft(key, draft) {
  const drafts = getDrafts();
  drafts[key] = draft;
  localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
}

function deleteDraft(key) {
  const drafts = getDrafts();
  delete drafts[key];
  localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
}
