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

// oldId を渡すと、車両IDが変わった場合（部署異動）も元のデータを置き換える
function updateVehicle(vehicle, oldId = vehicle.id) {
  const vehicles = getVehicles();
  const index = vehicles.findIndex((v) => v.id === oldId);
  if (index === -1) return;
  vehicles[index] = vehicle;
  saveVehicles(vehicles);
}

function deleteVehicle(id) {
  saveVehicles(getVehicles().filter((v) => v.id !== id));
}

// 車両ID：部署コード＋連番（例：GA-001）
// 一度発行した番号は、部署異動・売却・廃車・削除のあとも再利用しない（欠番にする）
const DEPT_CODES = {
  "総務部": "GA",
  "営業部": "SL",
  "工事第一課": "C1",
  "工事第二課": "C2",
  "運行管理部": "OP",
};
const ID_COUNTER_KEY = "vehicleIdCounters";

function getIdCounters() {
  const raw = localStorage.getItem(ID_COUNTER_KEY);
  return raw ? JSON.parse(raw) : {};
}

// 現在のIDと旧IDをすべて含めて、使われたことのあるIDか調べる
function isVehicleIdTaken(id) {
  return getVehicles().some((v) => v.id === id || (v.formerIds || []).includes(id));
}

function parseVehicleId(id) {
  const match = /^([A-Z0-9]+)-(\d+)$/.exec(id || "");
  return match ? { prefix: match[1], number: parseInt(match[2], 10) } : null;
}

// 部署の次の番号を返す（まだ発行済みとして記録はしない）
function getNextVehicleId(dept) {
  const prefix = DEPT_CODES[dept] || "V";
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

// ナンバーの表記ゆれ（空白・全角半角・ハイフンの種類）をそろえて比較用の文字列にする
function normalizePlate(plate) {
  return (plate || "")
    .normalize("NFKC")
    .replace(/\s/g, "")
    .replace(/[‐‑‒–—―−ー]/g, "-");
}

// 同じナンバーで登録されている別の車両を返す（売却済・廃車は対象外）
function findDuplicateVehicles(vehicle, vehicles = getVehicles(), excludeId = vehicle.id) {
  const key = normalizePlate(vehicle.plate);
  if (!key || isRetired(vehicle)) return [];
  return vehicles.filter((v) => v.id !== excludeId && !isRetired(v) && normalizePlate(v.plate) === key);
}

// 整合性チェック：要確認の内容を配列で返す（問題なければ空配列）
function getVehicleIssues(vehicle, vehicles = getVehicles()) {
  const issues = [];
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
