// 車両カルテ CSVでの一括取込（ひな形の作成・CSVの読み込み・行ごとのチェック）

// ひな形の列。required の列は必須（車検満了日は売却済・廃車なら不要、保険の終了日は保険ありのとき必須）
const IMPORT_COLUMNS = [
  { key: "id", label: "社内車両ID", example: "", note: "空欄なら自動で採番" },
  { key: "model", label: "車種", example: "【記入例】トヨタ ハイエース", required: true },
  { key: "plate", label: "ナンバー", example: "札幌400 さ 12-34", required: true },
  { key: "dept", label: "使用部署", example: "工事第一課", required: true },
  { key: "usage", label: "用途", example: "資材運搬" },
  { key: "status", label: "稼働状態", example: "稼働中", note: "空欄なら稼働中" },
  { key: "shakenExpiresAt", label: "車検満了日", example: "2027/3/31" },
  { key: "ownership", label: "所有／リース", example: "所有", note: "空欄なら所有" },
  { key: "purchaseDate", label: "購入日", example: "2022/4/1" },
  { key: "leaseStart", label: "リース開始日", example: "" },
  { key: "leaseEnd", label: "リース終了日", example: "" },
  { key: "insurance", label: "保険契約", example: "あり", note: "あり／なし（空欄ならなし）" },
  { key: "insuranceCompany", label: "保険会社", example: "シマエナガ損害保険株式会社" },
  { key: "insuranceStart", label: "保険の契約開始日", example: "2026/4/1" },
  { key: "insuranceEnd", label: "保険の契約終了日", example: "2027/3/31" },
  { key: "premiumCycle", label: "保険料の支払方法", example: "年払い", note: "年払い／月払い" },
  { key: "premium", label: "保険料", example: "98400", note: "1回あたりの金額（円）" },
];

const IMPORT_EXAMPLE_MARK = "【記入例】";

function csvEscape(value) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// ひな形のCSV（Excelで文字化けしないよう、先頭にBOMを付けたUTF-8）
function buildImportTemplate() {
  const rows = [IMPORT_COLUMNS.map((c) => c.label), IMPORT_COLUMNS.map((c) => c.example)];
  return "﻿" + rows.map((row) => row.map(csvEscape).join(",")).join("\r\n") + "\r\n";
}

// Excelで保存したCSV（Shift_JIS）とUTF-8のどちらも読めるようにする
function decodeCsv(buffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^﻿/, "");
  } catch (e) {
    return new TextDecoder("shift_jis").decode(buffer);
  }
}

// CSVを行と列の配列にする（"" で囲まれた中のカンマ・改行にも対応）
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

// 日付を YYYY-MM-DD にそろえる（2026/4/1、2026-04-01、2026.4.1、2026年4月1日）。読めなければ null
function normalizeImportDate(value) {
  const text = normalizeText(value);
  if (!text) return "";
  const match = /^(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})日?$/.exec(text);
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// CSVの中身をチェックし、取り込める車両とエラー・注意のある行に分ける
// options: { depts, companies } … 選択式の項目で使える値
function checkImportRows(text, options) {
  const depts = options.depts.map(normalizeText);
  const companies = options.companies.map(normalizeText);
  const rows = parseCsv(text).filter((row) => row.some((cell) => normalizeText(cell)));
  if (!rows.length) return { fatal: "CSVにデータがありません。" };

  const header = rows[0].map((cell) => normalizeText(cell));
  const indexOf = {};
  // 見出しも値と同じく表記ゆれをそろえて比べる（「所有／リース」の全角スラッシュなど）
  IMPORT_COLUMNS.forEach((c) => {
    indexOf[c.key] = header.indexOf(normalizeText(c.label));
  });
  const missingColumns = IMPORT_COLUMNS.filter((c) => c.required && indexOf[c.key] === -1).map((c) => c.label);
  if (missingColumns.length) {
    return { fatal: `ひな形の列が見つかりません：${missingColumns.join("、")}。ダウンロードしたひな形の1行目（列の見出し）はそのまま使ってください。` };
  }

  const existing = getVehicles();
  const usedIds = new Set();
  const seenPlates = new Map();
  const vehicles = [];
  const errors = [];
  const warnings = [];

  rows.slice(1).forEach((row, i) => {
    const line = i + 2; // Excelで見たときの行番号（1行目は見出し）
    const get = (key) => (indexOf[key] === -1 ? "" : normalizeText(row[indexOf[key]] || ""));
    if (get("model").startsWith(IMPORT_EXAMPLE_MARK)) return;

    const problems = [];
    const date = (key, label) => {
      const value = normalizeImportDate(get(key));
      if (value === null) {
        problems.push(`${label}「${get(key)}」を日付として読めません（例：2027/3/31）`);
        return "";
      }
      return value;
    };

    const status = get("status") || "稼働中";
    const ownership = get("ownership") || "所有";
    const insuranceText = get("insurance") || "なし";
    const premiumCycle = get("premiumCycle") || "年払い";
    if (!["稼働中", "休止中", "売却済", "廃車"].includes(status)) problems.push(`稼働状態「${status}」は使えません（稼働中／休止中／売却済／廃車）`);
    if (!["所有", "リース"].includes(ownership)) problems.push(`所有／リース「${ownership}」は使えません（所有／リース）`);
    if (!["あり", "なし"].includes(insuranceText)) problems.push(`保険契約「${insuranceText}」は使えません（あり／なし）`);
    if (!["年払い", "月払い"].includes(premiumCycle)) problems.push(`保険料の支払方法「${premiumCycle}」は使えません（年払い／月払い）`);
    if (get("dept") && !depts.includes(get("dept"))) problems.push(`使用部署「${get("dept")}」は登録されていません（${depts.join("／")}）`);

    const hasInsurance = insuranceText === "あり";
    const isLease = ownership === "リース";
    const vehicle = {
      id: get("id") ? normalizeVehicleId(get("id")) : "",
      model: get("model"),
      plate: formatPlate(get("plate")),
      dept: get("dept"),
      usage: get("usage"),
      status,
      shakenExpiresAt: date("shakenExpiresAt", "車検満了日"),
      ownership,
      purchaseDate: isLease ? "" : date("purchaseDate", "購入日"),
      lease: {
        start: isLease ? date("leaseStart", "リース開始日") : "",
        end: isLease ? date("leaseEnd", "リース終了日") : "",
      },
      insurance: {
        active: hasInsurance,
        company: hasInsurance ? get("insuranceCompany") : "",
        period: {
          start: hasInsurance ? date("insuranceStart", "保険の契約開始日") : "",
          end: hasInsurance ? date("insuranceEnd", "保険の契約終了日") : "",
        },
        premiumCycle: hasInsurance ? premiumCycle : "",
        premium: hasInsurance ? get("premium").replace(/[,円]/g, "") : "",
      },
      disposal: { date: "", partner: "", amount: "", note: "" },
      formerIds: [],
      history: [],
    };

    // 登録フォームと同じ必須チェック・日付の前後チェック
    if (!vehicle.model) problems.push("車種が空欄です");
    if (!vehicle.plate) problems.push("ナンバーが空欄です");
    if (!vehicle.dept) problems.push("使用部署が空欄です");
    if (!isRetired(vehicle) && !vehicle.shakenExpiresAt && !problems.some((p) => p.startsWith("車検満了日"))) problems.push("車検満了日が空欄です");
    if (hasInsurance && !vehicle.insurance.period.end && !problems.some((p) => p.startsWith("保険の契約終了日"))) problems.push("保険契約が「あり」ですが、保険の契約終了日が空欄です");
    if (hasInsurance && vehicle.insurance.company && !companies.includes(vehicle.insurance.company)) problems.push(`保険会社「${vehicle.insurance.company}」は登録されていません（${companies.join("／")}）`);
    if (hasInsurance && vehicle.insurance.premium && !/^\d+$/.test(vehicle.insurance.premium)) problems.push(`保険料「${get("premium")}」は数字で入力してください`);
    [[vehicle.lease, "リース終了日がリース開始日より前です"], [vehicle.insurance.period, "保険の契約終了日が契約開始日より前です"]].forEach(([period, message]) => {
      if (period.start && period.end && period.end < period.start) problems.push(message);
    });
    if (vehicle.id) {
      if (!parseVehicleId(vehicle.id)) problems.push(`社内車両ID「${vehicle.id}」の形が正しくありません（例：V-001）。空欄にすると自動で採番します`);
      else if (isVehicleIdTaken(vehicle.id) || usedIds.has(vehicle.id)) problems.push(`社内車両ID「${vehicle.id}」はすでに使われています`);
    }

    if (problems.length) {
      errors.push({ line, label: vehicle.model || vehicle.plate || "（車種・ナンバーなし）", problems });
      return;
    }
    if (vehicle.id) usedIds.add(vehicle.id);

    // 同じナンバー：取り込みは止めず、取り込み後に「要確認」として表示される
    const plateKey = normalizePlate(vehicle.plate);
    const sameInApp = findDuplicateVehicles(vehicle, existing, null);
    if (sameInApp.length) warnings.push({ line, text: `ナンバー「${vehicle.plate}」の車両が「${sameInApp[0].id}」としてすでに登録されています（取り込み後、要確認になります）` });
    else if (seenPlates.has(plateKey) && !isRetired(vehicle)) warnings.push({ line, text: `ナンバー「${vehicle.plate}」が${seenPlates.get(plateKey)}行目と同じです（取り込み後、要確認になります）` });
    if (!isRetired(vehicle)) seenPlates.set(plateKey, line);

    vehicles.push({ line, vehicle });
  });

  return { vehicles, errors, warnings };
}

// チェック済みの車両を登録する。IDが空欄の車両には、ここで順に番号を振る。登録したIDの配列を返す
function importVehicles(items, historyEntry) {
  const ids = [];
  // CSVに書かれたIDを先に発行済みにして、自動採番の番号とぶつからないようにする
  items.forEach(({ vehicle }) => {
    if (vehicle.id) recordIssuedVehicleId(vehicle.id);
  });
  items.forEach(({ vehicle }) => {
    const v = { ...vehicle, history: [{ ...historyEntry }] };
    if (!v.id) v.id = getNextVehicleId();
    saveVehicle(v);
    recordIssuedVehicleId(v.id);
    ids.push(v.id);
  });
  return ids;
}
