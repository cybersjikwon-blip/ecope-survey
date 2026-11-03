import * as C from './config.js?v=1.0.2';

const $ = (s) => document.querySelector(s);
const won = (n) => n.toLocaleString('ko-KR') + '원';
const LS_DONE = 'ecope_done_' + C.EVENT.id;
const LS_PENDING = 'ecope_pending_' + C.EVENT.id;
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};

window.__appReady = true;
$('#ver').textContent = C.APP_VERSION;

// ---------- 기간 판정 (한국시간 그 날 23:59:59 까지) ----------
const kst = (d, end) => new Date(d + (end ? 'T23:59:59+09:00' : 'T00:00:00+09:00'));
const now = new Date();
const surveyOpen = now >= kst(C.EVENT.surveyStart) && now <= kst(C.EVENT.surveyEnd, true);
const couponOpen = surveyOpen && now <= kst(C.EVENT.couponEnd, true);
const configured = !!(C.firebaseConfig.apiKey && C.firebaseConfig.projectId);

// 유입 경로 (?src=)
const srcParam = new URLSearchParams(location.search).get('src') || '';
const SRC = Object.prototype.hasOwnProperty.call(C.SOURCES, srcParam) ? srcParam : (srcParam ? 'etc' : 'direct');

function show(id) { ['#survey', '#done', '#closed'].forEach((s) => { $(s).hidden = s !== id; }); }

if (!configured) {
  const n = $('#setupNotice');
  n.hidden = false;
  n.textContent = '[관리자 안내] js/config.js 에 Firebase 설정이 아직 없습니다. 지금은 화면 확인만 가능하고 제출은 저장되지 않습니다.';
}

// ---------- 화면 그리기 ----------
function sizeSvg(w, h) {
  const k = 56 / 240, W = Math.round(w * k), H = Math.round(h * k);
  return `<svg width="${56}" height="${56}" viewBox="0 0 56 56" aria-hidden="true"><rect x="${(56 - W) / 2}" y="${56 - H}" width="${W}" height="${H}" fill="#E8EDFB" stroke="#1F47C6" stroke-width="1.5"></rect></svg>`;
}
$('#pickHint').textContent = `(최대 ${C.MAX_PICK}개)`;
$('#sizeList').innerHTML = C.SIZE_OPTIONS.map((o) => `
  <label class="card"><input type="checkbox" name="size" value="${o.id}">${sizeSvg(o.w, o.h)}
  <span><span class="nm">${o.name} cm</span><br><span class="ds">두께 ${o.t} · ${o.desc}</span></span></label>`).join('');
$('#useList').innerHTML = C.USES.map((u) => `<label class="opt"><input type="checkbox" name="use" value="${u}"> ${u}</label>`).join('');
$('#thickList').innerHTML = Object.entries(C.THICK).map(([k, v]) => `<label class="opt"><input type="radio" name="thick" value="${k}"> ${v}</label>`).join('');
$('#qtyList').innerHTML = Object.entries(C.QTY).map(([k, v]) => `<label class="opt"><input type="radio" name="qty" value="${k}"> ${v}</label>`).join('');
$('#chn').innerHTML = C.CHANNELS.map((c) => `<option>${c}</option>`).join('');

const E = C.EVENT;
const condHtml = `<b>대상</b> 에누리하우스 누적 구매 <b>${won(E.couponHistoryAmount)} 이상</b> 고객님
  <ul><li>혜택: 다음 주문 <b>${won(E.couponMinOrder)} 이상</b> 구매 시 <b>${won(E.couponDiscount)} 할인</b> 쿠폰</li>
  <li>구매 내역을 확인한 뒤 순차적으로 지급해 드립니다. (대상이 아니면 지급되지 않아요)</li>
  <li>쿠폰 신청 마감: ${E.couponEnd} · 휴대폰 번호 1개당 1회</li></ul>`;
if (couponOpen) {
  $('#couponSet').hidden = false;
  $('#couponCond').innerHTML = condHtml;
  $('#couponBanner').hidden = false;
  $('#couponBanner').innerHTML = `누적 구매 ${won(E.couponHistoryAmount)} 이상 고객님께는 참여 감사 <b>${won(E.couponDiscount)} 할인쿠폰</b>을 드려요. (${won(E.couponMinOrder)} 이상 구매 시)`;
}
$('#consentText').innerHTML = `<b>개인정보 수집·이용 안내</b>
  <table><tr><th>수집 항목</th><td>이름, 휴대폰 번호, 주 구매처</td></tr>
  <tr><th>목적</th><td>구매 내역 확인 및 할인쿠폰 지급</td></tr>
  <tr><th>보유 기간</th><td>쿠폰 지급(또는 대상 확인) 완료 후 지체 없이 파기, 늦어도 쿠폰 신청 마감 후 3개월 이내 파기</td></tr></table>
  동의하지 않으셔도 설문 참여는 가능하며, 이 경우 쿠폰은 지급되지 않습니다.`;

// 최대 선택 개수 제한
$('#sizeList').addEventListener('change', (e) => {
  const on = document.querySelectorAll('input[name=size]:checked');
  if (on.length > C.MAX_PICK) { e.target.checked = false; $('#e1').textContent = `크기는 최대 ${C.MAX_PICK}개까지 고를 수 있어요.`; }
  else $('#e1').textContent = '';
});
$('#customOn').addEventListener('change', (e) => { $('#customBox').hidden = !e.target.checked; });
$('#couponOn').addEventListener('change', (e) => { $('#couponBox').hidden = !e.target.checked; });
$('#ph').addEventListener('input', (e) => {
  const d = e.target.value.replace(/\D/g, '').slice(0, 11);
  e.target.value = d.length < 4 ? d : d.length < 8 ? `${d.slice(0, 3)}-${d.slice(3)}` : `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`;
});

// ---------- 입력값 모으기 + 검사 ----------
function collect() {
  const err = {};
  const sizes = [...document.querySelectorAll('input[name=size]:checked')].map((i) => i.value);
  let custom = null;
  if ($('#customOn').checked) {
    const w = Number($('#cw').value), h = Number($('#ch').value);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 10 || w > 400 || h < 10 || h > 400) err.e1 = '직접 입력하실 크기의 가로·세로를 10~400cm 사이 숫자로 적어 주세요.';
    else custom = { w: Math.round(w), h: Math.round(h), t: $('#ct').value, note: $('#cn').value.trim().slice(0, 100) };
  }
  if (!sizes.length && !$('#customOn').checked) err.e1 = '크기를 1개 이상 고르거나 직접 입력해 주세요.';
  if (sizes.length > C.MAX_PICK) err.e1 = `크기는 최대 ${C.MAX_PICK}개까지예요.`;
  const uses = [...document.querySelectorAll('input[name=use]:checked')].map((i) => i.value);
  if (!uses.length) err.e2 = '용도를 1개 이상 골라 주세요.';
  const thick = (document.querySelector('input[name=thick]:checked') || {}).value;
  if (!thick) err.e3 = '하나를 골라 주세요.';
  const qty = (document.querySelector('input[name=qty]:checked') || {}).value;
  if (!qty) err.e4 = '하나를 골라 주세요.';

  const coupon = couponOpen && $('#couponOn').checked;
  let name = '', phone = '', channel = '', consent = false;
  if (coupon) {
    name = $('#nm').value.trim();
    phone = $('#ph').value.replace(/\D/g, '');
    channel = $('#chn').value;
    consent = $('#agree').checked;
    if (name.length < 2 || name.length > 20) err.e5 = '주문자 이름을 정확히 적어 주세요.';
    else if (!/^01[016789]\d{7,8}$/.test(phone)) err.e5 = '휴대폰 번호를 정확히 적어 주세요. (예: 010-1234-5678)';
    else if (!consent) err.e5 = '쿠폰을 받으시려면 개인정보 수집·이용에 동의해 주세요.';
  }
  const data = { sizes, custom, uses, thick: thick || '', qty: qty || '', comment: $('#cm').value.trim().slice(0, 500),
    coupon, name, phone, channel, consent, src: SRC };
  return { data, err };
}

// ---------- Firebase ----------
let fbPromise = null;
function loadFb() {
  if (!fbPromise) {
    fbPromise = Promise.all([import(`${C.FB_SDK}/firebase-app.js`), import(`${C.FB_SDK}/firebase-firestore.js`)])
      .then(([app, fs]) => ({ fs, db: fs.getFirestore(app.initializeApp(C.firebaseConfig)) }))
      .catch((e) => { fbPromise = null; throw Object.assign(new Error('sdk-load'), { code: 'sdk-load', cause: e }); });
  }
  return fbPromise;
}
const randId = () => {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', b = new Uint8Array(20);
  crypto.getRandomValues(b);
  return 'r_' + [...b].map((x) => a[x % a.length]).join('');
};
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'timeout' })), ms))]);

async function send(item) {
  if (!configured) throw Object.assign(new Error('not-configured'), { code: 'not-configured' });
  const { fs, db } = await withTimeout(loadFb(), 15000);
  const payload = { ...item.data, v: C.APP_VERSION, status: 'pending', createdAt: fs.serverTimestamp() };
  await withTimeout(fs.setDoc(fs.doc(db, 'responses', item.id), payload), 15000);
}

function finish() {
  ls.set(LS_DONE, '1');
  ls.del(LS_PENDING);
  const c = JSON.parse(ls.get(LS_PENDING + '_c') || 'false');
  $('#doneText').textContent = c
    ? '쿠폰 신청도 접수됐어요. 구매 내역 확인 후 순차적으로 지급해 드릴게요.'
    : '보내주신 의견으로 다음 봉투 크기를 정하겠습니다.';
  ls.del(LS_PENDING + '_c');
  show('#done');
  window.scrollTo(0, 0);
}

function errorText(e, item, isRetry) {
  const code = (e && e.code) || '';
  if (code === 'not-configured') return '아직 설문 준비 중이에요. (관리자: Firebase 설정 필요)';
  if (code === 'permission-denied') {
    return item.data.coupon
      ? '이미 이 휴대폰 번호로 참여하셨어요. 번호당 1회만 참여할 수 있어요.'
      : '입력하신 내용을 저장하지 못했어요. 항목을 다시 확인해 주세요.';
  }
  return `인터넷 연결이 불안정해 아직 저장되지 않았어요. 입력하신 내용은 이 기기에 보관해 두었으니 아래 버튼으로 다시 보내 주세요. 계속 안 되면 ${C.EVENT.contact}으로 알려 주세요.`;
}

async function submitItem(item, isRetry) {
  const btn = $('#submitBtn'), msg = $('#formMsg');
  btn.disabled = true; btn.textContent = '보내는 중…'; msg.className = 'msg'; msg.textContent = '';
  ls.set(LS_PENDING, JSON.stringify(item));
  ls.set(LS_PENDING + '_c', JSON.stringify(item.data.coupon));
  try {
    await send(item);
    finish();
  } catch (e) {
    // 재전송인데 '권한 거부' = 앞서 보낸 것이 이미 저장된 경우 → 성공 처리
    // (검사에서 거부된 응답은 보관하지 않으므로, 재전송에서 거부되면 이미 저장된 것)
    if (isRetry && e.code === 'permission-denied') { finish(); return; }
    if (e.code === 'permission-denied' || e.code === 'not-configured') ls.del(LS_PENDING);
    msg.className = 'msg bad';
    msg.textContent = errorText(e, item, isRetry);
    btn.disabled = false;
    btn.textContent = ls.get(LS_PENDING) ? '다시 보내기' : '설문 제출하기';
    console.warn('[survey] submit failed:', e);
  }
}

$('#f').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const pending = ls.get(LS_PENDING);
  if (pending && $('#submitBtn').textContent === '다시 보내기') { submitItem(JSON.parse(pending), true); return; }
  const { data, err } = collect();
  ['e1', 'e2', 'e3', 'e4', 'e5'].forEach((k) => { $('#' + k).textContent = err[k] || ''; });
  const first = Object.keys(err)[0];
  if (first) { $('#' + first).closest('fieldset').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  submitItem({ id: data.coupon ? 'p_' + data.phone : randId(), data }, false);
});

// ---------- 시작 ----------
if (!surveyOpen) {
  show('#closed');
  const before = now < kst(C.EVENT.surveyStart);
  $('#closedTitle').textContent = before ? '설문 준비 중이에요' : '설문이 마감됐어요';
  $('#closedText').textContent = before ? `${C.EVENT.surveyStart}부터 참여하실 수 있어요.` : '참여해 주신 모든 분께 감사드립니다.';
} else if (ls.get(LS_DONE)) {
  show('#done');
  $('#doneText').textContent = '이미 참여해 주셨어요. 감사합니다!';
} else if (ls.get(LS_PENDING)) {
  // 지난번에 못 보낸 응답이 있으면 자동 재전송
  try { submitItem(JSON.parse(ls.get(LS_PENDING)), true); } catch (e) { ls.del(LS_PENDING); }
}
window.addEventListener('online', () => {
  const p = ls.get(LS_PENDING);
  if (p && !$('#submitBtn').disabled) { try { submitItem(JSON.parse(p), true); } catch (e) {} }
});
