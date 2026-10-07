// 車両カルテ 動作確認用サンプルデータ
// 本番運用時は index.html からこのファイルの読み込みと「サンプルデータを追加」ボタンを外す

// 今日から days 日後の日付（YYYY-MM-DD、過去ならマイナス）
function dateFromToday(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function sampleInsurance(company, startDays, endDays, premiumCycle, premium) {
  return {
    active: true,
    company,
    period: { start: dateFromToday(startDays), end: dateFromToday(endDays) },
    premiumCycle,
    premium: String(premium),
  };
}

const NO_INSURANCE = { active: false, company: "", period: { start: "", end: "" }, premiumCycle: "", premium: "" };
const NO_LEASE = { start: "", end: "" };

// 期限・整合性チェックの確認ポイントを各車両のコメントに記載
function buildSampleVehicles() {
  return [
    // 車検期限が近い（あと20日）
    {
      model: "トヨタ ハイエース", plate: "札幌400 さ 21-87", dept: "工事第一課", usage: "資材運搬",
      status: "稼働中", shakenExpiresAt: dateFromToday(20),
      ownership: "所有", purchaseDate: "2021-05-18", lease: NO_LEASE,
      insurance: sampleInsurance("シマエナガ損害保険株式会社", -189, 175, "年払い", 98400),
      history: [
        { date: "2026-04-01", time: "10:12", note: "保険料を「92,400円」から「98,400円」に変更", editor: "佐藤（総務部）" },
        { date: "2021-05-18", note: "新規登録", editor: "鈴木（総務部）" },
      ],
    },
    // 保険期限が近い（あと12日）・リース・月払い・営業部から部署異動（旧IDは欠番）
    {
      model: "日産 NV350キャラバン", plate: "函館300 ち 4-15", dept: "工事第二課", formerDept: "営業部", usage: "現場移動",
      status: "稼働中", shakenExpiresAt: dateFromToday(300),
      ownership: "リース", purchaseDate: "", lease: { start: dateFromToday(-900), end: dateFromToday(195) },
      insurance: sampleInsurance("丹頂総合保険株式会社", -353, 12, "月払い", 8200),
      history: [
        { date: "2025-07-14", time: "16:40", idChange: true, note: "使用部署を「営業部」から「工事第二課」に変更\n用途を「営業回り」から「現場移動」に変更", editor: "中村（工事第二課）" },
        { date: "2024-04-22", note: "新規登録", editor: "伊藤（営業部）" },
      ],
    },
    // 保険期限を過ぎている（5日超過）
    {
      model: "三菱ふそう キャンター", plate: "旭川100 か 30-02", dept: "運行管理部", usage: "巡回",
      status: "稼働中", shakenExpiresAt: dateFromToday(140),
      ownership: "所有", purchaseDate: "2019-09-02", lease: NO_LEASE,
      insurance: sampleInsurance("美唄PIPA保険サービス", -370, -5, "年払い", 132000),
      history: [
        { date: "2019-09-02", note: "新規登録", editor: "渡辺（運行管理部）" },
      ],
    },
    // 整合性チェック：売却済なのに保険が有効
    {
      model: "いすゞ エルフ", plate: "札幌100 あ 12-34", dept: "総務部", usage: "資材配送",
      status: "売却済", shakenExpiresAt: dateFromToday(45),
      ownership: "所有", purchaseDate: "2018-06-15", lease: NO_LEASE,
      disposal: { date: dateFromToday(-12), partner: "北斗オートセンター株式会社", amount: "420000", note: "後継車両への入替のため売却" },
      insurance: sampleInsurance("シマエナガ損害保険株式会社", -190, 175, "年払い", 104500),
      history: [
        { date: dateFromToday(-12), time: "14:05", note: "稼働状態を「稼働中」から「売却済」に変更", editor: "佐藤（総務部）" },
        { date: "2024-03-08", note: "接触事故が発生し、保険を使用して修理を実施（修理費用：148,000円）", editor: "山田（工事第一課）" },
        { date: "2018-06-15", note: "新規登録", editor: "田中（総務部）" },
      ],
    },
    // 車検期限を過ぎている（3日超過）・リース・月払い
    {
      model: "トヨタ プリウス", plate: "札幌500 ひ 77-01", dept: "営業部", usage: "営業回り",
      status: "稼働中", shakenExpiresAt: dateFromToday(-3),
      ownership: "リース", purchaseDate: "", lease: { start: dateFromToday(-1080), end: dateFromToday(380) },
      insurance: sampleInsurance("丹頂総合保険株式会社", -125, 240, "月払い", 6900),
      history: [
        { date: "2023-10-02", note: "新規登録", editor: "小林（営業部）" },
      ],
    },
    // 特に問題なし
    {
      model: "ホンダ N-BOX", plate: "室蘭580 え 8-46", dept: "営業部", usage: "営業回り",
      status: "稼働中", shakenExpiresAt: dateFromToday(400),
      ownership: "所有", purchaseDate: "2023-02-10", lease: NO_LEASE,
      insurance: sampleInsurance("シマエナガ損害保険株式会社", -277, 88, "年払い", 52800),
      history: [
        { date: "2025-11-19", time: "09:30", note: "保険会社を「丹頂総合保険株式会社」から「シマエナガ損害保険株式会社」に変更", editor: "伊藤（営業部）" },
        { date: "2023-02-10", note: "新規登録", editor: "小林（営業部）" },
      ],
    },
    // 休止中・保険契約なし
    {
      model: "スズキ エブリイ", plate: "苫小牧480 せ 19-63", dept: "総務部", usage: "郵便・備品の運搬",
      status: "休止中", shakenExpiresAt: dateFromToday(600),
      ownership: "所有", purchaseDate: "2020-03-27", lease: NO_LEASE,
      insurance: NO_INSURANCE,
      history: [
        { date: "2026-03-31", time: "17:15", note: "稼働状態を「稼働中」から「休止中」に変更\n保険契約を「あり」から「なし」に変更", editor: "佐藤（総務部）" },
        { date: "2020-03-27", note: "新規登録", editor: "鈴木（総務部）" },
      ],
    },
    // 保険（あと27日）と車検（あと28日）の両方が近い・リース
    {
      model: "日野 デュトロ", plate: "帯広100 は 55-20", dept: "工事第一課", usage: "重機・資材運搬",
      status: "稼働中", shakenExpiresAt: dateFromToday(28),
      ownership: "リース", purchaseDate: "", lease: { start: dateFromToday(-1400), end: dateFromToday(425) },
      insurance: sampleInsurance("美唄PIPA保険サービス", -338, 27, "年払い", 156000),
      history: [
        { date: "2022-11-30", note: "新規登録", editor: "高橋（工事第一課）" },
      ],
    },
    // 特に問題なし（送迎用マイクロバス）
    {
      model: "トヨタ コースター", plate: "札幌200 す 3-08", dept: "運行管理部", usage: "送迎",
      status: "稼働中", shakenExpiresAt: dateFromToday(210),
      ownership: "所有", purchaseDate: "2020-11-25", lease: NO_LEASE,
      insurance: sampleInsurance("シマエナガ損害保険株式会社", -65, 300, "年払い", 214000),
      history: [
        { date: "2025-06-03", time: "11:48", note: "ナンバーを「札幌200 す 3-07」から「札幌200 す 3-08」に変更", editor: "渡辺（運行管理部）" },
        { date: "2020-11-25", note: "新規登録", editor: "渡辺（運行管理部）" },
      ],
    },
    // 車検期限が近い（あと9日）・月払い
    {
      model: "ダイハツ ハイゼットトラック", plate: "北見480 け 62-91", dept: "工事第二課", usage: "現場資材の運搬",
      status: "稼働中", shakenExpiresAt: dateFromToday(9),
      ownership: "所有", purchaseDate: "2022-08-08", lease: NO_LEASE,
      insurance: sampleInsurance("丹頂総合保険株式会社", -235, 130, "月払い", 4300),
      history: [
        { date: "2022-08-08", note: "新規登録", editor: "中村（工事第二課）" },
      ],
    },
    // 特に問題なし（中型バス）・リース
    {
      model: "いすゞ エルガミオ", plate: "札幌200 か 18-52", dept: "運行管理部", usage: "路線運行（委託）",
      status: "稼働中", shakenExpiresAt: dateFromToday(155),
      ownership: "リース", purchaseDate: "", lease: { start: dateFromToday(-760), end: dateFromToday(1065) },
      insurance: sampleInsurance("美唄PIPA保険サービス", -98, 267, "年払い", 287000),
      history: [
        { date: "2025-12-01", time: "08:55", note: "保険料を「269,000円」から「287,000円」に変更", editor: "渡辺（運行管理部）" },
        { date: "2024-09-09", note: "新規登録", editor: "佐藤（総務部）" },
      ],
    },
    // 売却済・保険も解約済（整合性チェックには該当しない）
    {
      model: "日産 アトラス", plate: "函館100 そ 47-73", dept: "工事第一課", usage: "資材運搬",
      status: "売却済", shakenExpiresAt: dateFromToday(-60),
      ownership: "所有", purchaseDate: "2015-04-20", lease: NO_LEASE,
      disposal: { date: "2026-07-24", partner: "株式会社十勝トラック販売", amount: "185000", note: "走行距離が多く老朽化したため売却" },
      insurance: NO_INSURANCE,
      history: [
        { date: "2026-07-31", time: "15:20", note: "保険契約を「あり」から「なし」に変更", editor: "佐藤（総務部）" },
        { date: "2026-07-24", time: "13:02", note: "稼働状態を「稼働中」から「売却済」に変更", editor: "高橋（工事第一課）" },
        { date: "2015-04-20", note: "新規登録", editor: "田中（総務部）" },
      ],
    },
    // 休止中だが保険は継続中（冬季の除雪シーズン前に再稼働予定）
    {
      model: "トヨタ ランドクルーザー", plate: "旭川300 ほ 90-11", dept: "工事第二課", usage: "冬季の現場巡回",
      status: "休止中", shakenExpiresAt: dateFromToday(330),
      ownership: "所有", purchaseDate: "2021-12-03", lease: NO_LEASE,
      insurance: sampleInsurance("丹頂総合保険株式会社", -301, 64, "年払い", 118800),
      history: [
        { date: "2026-04-15", time: "10:37", note: "稼働状態を「稼働中」から「休止中」に変更", editor: "中村（工事第二課）" },
        { date: "2021-12-03", note: "新規登録", editor: "中村（工事第二課）" },
      ],
    },
    // 保険期限が近い（あと4日）・月払い
    {
      model: "マツダ ボンゴバン", plate: "釧路400 ろ 26-38", dept: "営業部", usage: "商品配送",
      status: "稼働中", shakenExpiresAt: dateFromToday(250),
      ownership: "所有", purchaseDate: "2022-01-17", lease: NO_LEASE,
      insurance: sampleInsurance("シマエナガ損害保険株式会社", -361, 4, "月払い", 7600),
      history: [
        { date: "2022-01-17", note: "新規登録", editor: "伊藤（営業部）" },
      ],
    },
    // 整合性チェック：重複登録の疑い（運行管理部のコースターを総務部も登録。ナンバーの空白・全角の書き方が違っても同じと判定）
    {
      model: "トヨタ コースター", plate: "札幌２００す３－０８", dept: "総務部", usage: "来客・職員の送迎",
      status: "稼働中", shakenExpiresAt: dateFromToday(210),
      ownership: "所有", purchaseDate: "2020-11-25", lease: NO_LEASE,
      insurance: sampleInsurance("シマエナガ損害保険株式会社", -65, 300, "年払い", 214000),
      history: [
        { date: dateFromToday(-2), time: "13:48", note: "新規登録", editor: "鈴木（総務部）" },
      ],
    },
    // 整合性チェック：事故で廃車にしたが、保険が有効のまま（解約・入替の手続き待ち）
    {
      model: "トヨタ タウンエーストラック", plate: "旭川400 む 71-24", dept: "工事第一課", usage: "現場資材の運搬",
      status: "廃車", shakenExpiresAt: dateFromToday(190),
      ownership: "所有", purchaseDate: "2022-06-06", lease: NO_LEASE,
      disposal: { date: dateFromToday(-6), partner: "道央リサイクルセンター株式会社", amount: "", note: "追突事故でフレームを損傷し全損" },
      insurance: sampleInsurance("美唄PIPA保険サービス", -128, 237, "年払い", 88600),
      history: [
        { date: dateFromToday(-6), time: "11:22", note: "稼働状態を「稼働中」から「廃車」に変更", editor: "高橋（工事第一課）" },
        { date: dateFromToday(-21), time: "18:03", note: "国道12号で追突事故。フレーム損傷により修理不能と判断され、全損扱いとなる（車両保険を使用）", editor: "山田（工事第一課）" },
        { date: "2022-06-06", note: "新規登録", editor: "高橋（工事第一課）" },
      ],
    },
    // 特に問題なし（軽自動車）・リース
    {
      model: "スズキ スペーシア", plate: "札幌580 ゆ 5-29", dept: "総務部", usage: "庁舎・取引先への連絡",
      status: "稼働中", shakenExpiresAt: dateFromToday(520),
      ownership: "リース", purchaseDate: "", lease: { start: dateFromToday(-210), end: dateFromToday(1615) },
      insurance: sampleInsurance("丹頂総合保険株式会社", -210, 155, "月払い", 3900),
      history: [
        { date: dateFromToday(-210), time: "09:10", note: "新規登録", editor: "鈴木（総務部）" },
      ],
    },
  ];
}

// 既存データは残し、空いている車両IDを順に割り当てて追加する。追加したIDの配列を返す
// formerDept がある車両は、異動元の部署で番号を発行してから異動先の番号に振り直す（異動元の番号は欠番になる）
function addSampleVehicles() {
  const addedIds = [];
  buildSampleVehicles().forEach((vehicle) => {
    vehicle.formerIds = [];
    if (vehicle.formerDept) {
      const oldId = getNextVehicleId(vehicle.formerDept);
      recordIssuedVehicleId(oldId);
      vehicle.formerIds.push(oldId);
    }
    vehicle.id = getNextVehicleId(vehicle.dept);
    recordIssuedVehicleId(vehicle.id);

    vehicle.history.forEach((entry) => {
      if (!entry.idChange) return;
      const oldId = vehicle.formerIds[0];
      entry.note = `車両IDを「${oldId}」から「${vehicle.id}」に変更（部署異動のため。「${oldId}」は欠番）\n${entry.note}`;
      delete entry.idChange;
    });
    delete vehicle.formerDept;

    saveVehicle(vehicle);
    addedIds.push(vehicle.id);
  });
  return addedIds;
}
