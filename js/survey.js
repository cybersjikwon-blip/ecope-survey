const C = await import('./config.js?t=' + Date.now()); // 매번 최신 설정을 읽음 (GitHub·브라우저 캐시 우회)
function cfgProblems() {
  const f = C.firebaseConfig || {}, out = [];
  ['apiKey', 'authDomain', 'projectId', 'appId'].forEach((k) => {
    if (!f[k]) {
      const typo = Object.keys(f).find((x) => x !== k && x.toLowerCase().includes(k.toLowerCase()));
      out.push(`${k} 값이 없음` + (typo ? ` ('${typo}' 오타 같아요 → '${k}'로 고쳐 주세요)` : ''));
    }
  });
  return out;
}
const CFG_PROBLEMS = cfgProblems();
const BUYER_CHECK = C.BUYER_CHECK !== false;

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
const configured = CFG_PROBLEMS.length === 0;

// 유입 경로 (?src=)
const srcParam = new URLSearchParams(location.search).get('src') || '';
const SRC = Object.prototype.hasOwnProperty.call(C.SOURCES, srcParam) ? srcParam : (srcParam ? 'etc' : 'direct');

function show(id) { ['#survey', '#done', '#closed'].forEach((s) => { const el = $(s); if (el) el.hidden = s !== id; }); }

if (!configured) {
  const n = $('#setupNotice');
  n.hidden = false;
  n.textContent = '[관리자 안내] js/config.js 설정 확인 필요: ' + CFG_PROBLEMS.join(' / ') + ' — 지금은 제출이 저장되지 않습니다.';
}

// ---------- 휴대폰 번호 ----------
const digitsOf = (v) => String(v || '').replace(/\D/g, '');
const validPhone = (d) => /^01[016789]\d{7,8}$/.test(d);
function fmtPhoneInput(el) {
  el.addEventListener('input', () => {
    const d = digitsOf(el.value).slice(0, 11);
    el.value = d.length < 4 ? d : d.length < 8 ? `${d.slice(0, 3)}-${d.slice(3)}` : `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`;
  });
}
// 관리자 페이지와 같은 방식 (설문 코드 + 번호 → SHA-256)
async function buyerHash(phone) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${C.EVENT.id}:${phone}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------- 화면 그리기 ----------
function sizeSvg(w, h) {
  const k = 56 / 240, W = Math.round(w * k), H = Math.round(h * k);
  return `<svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true"><rect x="${(56 - W) / 2}" y="${56 - H}" width="${W}" height="${H}" fill="#E8EDFB" stroke="#1F47C6" stroke-width="1.5"></rect></svg>`;
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
  <li>${BUYER_CHECK ? '구매 내역으로 대상 여부를 확인했어요. 신청하시면 순차적으로 지급해 드립니다.' : '구매 내역을 확인한 뒤 순차적으로 지급해 드립니다. (대상이 아니면 지급되지 않아요)'}</li>
  <li>쿠폰 신청 마감: ${E.couponEnd} · 휴대폰 번호 1개당 1회</li></ul>`;
if (couponOpen) {
  $('#couponCond').innerHTML = condHtml;
  $('#couponBanner').hidden = false;
  $('#couponBanner').innerHTML = `누적 구매 ${won(E.couponHistoryAmount)} 이상 고객님께는 참여 감사 <b>${won(E.couponDiscount)} 할인쿠폰</b>을 드려요. (${won(E.couponMinOrder)} 이상 구매 시)`;
  if (!BUYER_CHECK) $('#couponSet').hidden = false; // 구매자 확인 모드에서는 대상자에게만 보임
}
$('#consentText').innerHTML = `<b>개인정보 수집·이용 안내</b>
  <table><tr><th>수집 항목</th><td>이름, 휴대폰 번호${BUYER_CHECK ? '' : ', 주 구매처'}</td></tr>
  <tr><th>목적</th><td>할인쿠폰 지급${BUYER_CHECK ? '' : ' 및 구매 내역 확인'}</td></tr>
  <tr><th>보유 기간</th><td>쿠폰 지급 완료 후 지체 없이 파기, 늦어도 쿠폰 신청 마감 후 3개월 이내 파기</td></tr></table>
  동의하지 않으셔도 설문 참여는 가능하며, 이 경우 쿠폰은 지급되지 않습니다.`;

// 구매자 확인 모드: 쿠폰 칸의 번호·구매처는 확인한 값 사용
if (BUYER_CHECK) {
  $('#ph').readOnly = true;
  $('#ph').closest('div').querySelector('label[for=ph]').textContent = '휴대폰 번호 (확인된 번호)';
  $('#chn').closest('div').querySelector('label[for=chn]').hidden = true;
  $('#chn').hidden = true;
}

$('#sizeList').addEventListener('change', (e) => {
  const on = document.querySelectorAll('input[name=size]:checked');
  if (on.length > C.MAX_PICK) { e.target.checked = false; $('#e1').textContent = `크기는 최대 ${C.MAX_PICK}개까지 고를 수 있어요.`; }
  else $('#e1').textContent = '';
});
$('#customOn').addEventListener('change', (e) => { $('#customBox').hidden = !e.target.checked; });
$('#couponOn').addEventListener('change', (e) => { $('#couponBox').hidden = !e.target.checked; });
fmtPhoneInput($('#ph'));
fmtPhoneInput($('#gph'));

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
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'timeout' })), ms))]);
const randId = () => {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', b = new Uint8Array(20);
  crypto.getRandomValues(b);
  return 'r_' + [...b].map((x) => a[x % a.length]).join('');
};

// ---------- 구매자 확인 ----------
let buyer = null; // { hash, phone, eligible }
let couponNoticed = false;
function gateMsg(t, kind) { const m = $('#gateMsg'); m.className = 'msg' + (kind ? ' ' + kind : ''); m.textContent = t || ''; }

async function checkBuyer() {
  const phone = digitsOf($('#gph').value);
  if (buyer && buyer.phone === phone) return true;
  if (!validPhone(phone)) { gateMsg('휴대폰 번호를 정확히 적어 주세요. (예: 010-1234-5678)', 'bad'); return false; }
  if (!configured) { gateMsg('아직 설문 준비 중이에요. (관리자: Firebase 설정 필요)', 'bad'); return false; }
  const btn = $('#gateBtn'); btn.disabled = true; btn.textContent = '확인 중…'; gateMsg('확인 중…');
  try {
    const hash = await buyerHash(phone);
    const { fs, db } = await withTimeout(loadFb(), 15000);
    const b = await withTimeout(fs.getDoc(fs.doc(db, 'buyers', hash)), 15000);
    if (!b.exists()) {
      gateMsg(`구매 고객 명단에서 이 번호를 찾지 못했어요. 주문하실 때 입력한 번호인지 확인해 주세요. 안심번호로 주문하셨거나 최근 주문이라 아직 반영되지 않았을 수 있어요. 궁금하시면 ${C.EVENT.contact}으로 알려 주세요.`, 'bad');
      return false;
    }
    const d = await withTimeout(fs.getDoc(fs.doc(db, 'done', hash)), 15000);
    if (d.exists()) { ls.set(LS_DONE, '1'); show('#done'); $('#doneText').textContent = '이 번호로 이미 참여해 주셨어요. 감사합니다!'; window.scrollTo(0, 0); return false; }
    buyer = { hash, phone, eligible: (b.data() || {}).e === true };
    $('#ph').value = `${phone.slice(0, 3)}-${phone.slice(3, phone.length - 4)}-${phone.slice(-4)}`;
    const showCoupon = couponOpen && buyer.eligible;
    if (showCoupon) $('#couponSet').hidden = false;
    gateMsg(showCoupon ? '✓ 구매 고객으로 확인됐어요. 아래에서 감사 쿠폰도 신청하실 수 있어요.' : '✓ 구매 고객으로 확인됐어요. 아래 [설문 제출하기]를 눌러 주세요.', 'ok');
    return true;
  } catch (e) {
    console.warn('[survey] buyer check failed:', e);
    gateMsg(e.code === 'permission-denied'
      ? '확인 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요. (관리자: 보안 규칙 확인 필요)'
      : '인터넷 연결이 불안정해 확인하지 못했어요. 잠시 후 다시 눌러 주세요.', 'bad');
    return false;
  } finally { btn.disabled = false; btn.textContent = '확인'; }
}
$('#gateBtn').addEventListener('click', checkBuyer);
$('#gph').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); checkBuyer(); } });
// 번호를 끝까지 넣으면 바로 확인, 번호를 고치면 확인 취소
$('#gph').addEventListener('input', () => {
  const d = digitsOf($('#gph').value);
  if (buyer && buyer.phone !== d) { buyer = null; if (BUYER_CHECK) { $('#couponSet').hidden = true; $('#couponOn').checked = false; $('#couponBox').hidden = true; } gateMsg(''); }
  if (!buyer && validPhone(d) && d.length === 11) checkBuyer();
});
if (!BUYER_CHECK) { $('#verifySet').hidden = true; $('#buyerNote').hidden = true; }

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

  const couponAllowed = couponOpen && (!BUYER_CHECK || (buyer && buyer.eligible));
  const coupon = couponAllowed && $('#couponOn').checked;
  let name = '', phone = '', channel = '', consent = false;
  if (coupon) {
    name = $('#nm').value.trim();
    phone = BUYER_CHECK ? buyer.phone : digitsOf($('#ph').value);
    channel = BUYER_CHECK ? '스마트스토어' : $('#chn').value;
    consent = $('#agree').checked;
    if (name.length < 2 || name.length > 20) err.e5 = '주문자 이름을 정확히 적어 주세요.';
    else if (!validPhone(phone)) err.e5 = '휴대폰 번호를 정확히 적어 주세요. (예: 010-1234-5678)';
    else if (!consent) err.e5 = '쿠폰을 받으시려면 개인정보 수집·이용에 동의해 주세요.';
  }
  const data = { sizes, custom, uses, thick: thick || '', qty: qty || '', comment: $('#cm').value.trim().slice(0, 500),
    coupon, name, phone, channel, consent, src: SRC, buyer: BUYER_CHECK && buyer ? buyer.hash : '' };
  return { data, err };
}

async function send(item) {
  if (!configured) throw Object.assign(new Error('not-configured'), { code: 'not-configured' });
  const { fs, db } = await withTimeout(loadFb(), 15000);
  const payload = { ...item.data, v: C.APP_VERSION, status: 'pending', createdAt: fs.serverTimestamp() };
  if (item.data.buyer) {
    // 응답과 '참여 완료 표시'를 한 번에 저장 (구매자 1명당 1회)
    const b = fs.writeBatch(db);
    b.set(fs.doc(db, 'responses', item.id), payload);
    b.set(fs.doc(db, 'done', item.data.buyer), { at: fs.serverTimestamp() });
    await withTimeout(b.commit(), 15000);
  } else {
    await withTimeout(fs.setDoc(fs.doc(db, 'responses', item.id), payload), 15000);
  }
}

function finish(coupon) {
  ls.set(LS_DONE, '1');
  ls.del(LS_PENDING);
  $('#doneText').textContent = coupon
    ? '쿠폰 신청도 접수됐어요. 순차적으로 지급해 드릴게요.'
    : '보내주신 의견으로 다음 봉투 크기를 정하겠습니다.';
  show('#done');
  window.scrollTo(0, 0);
}

function errorText(e, item) {
  const code = (e && e.code) || '';
  if (code === 'not-configured') return '아직 설문 준비 중이에요. (관리자: Firebase 설정 필요)';
  if (code === 'permission-denied') {
    if (item.data.buyer) return '이 번호로 이미 참여하셨거나 저장할 수 없는 상태예요. 문제가 계속되면 ' + C.EVENT.contact + '으로 알려 주세요.';
    return item.data.coupon
      ? '이미 이 휴대폰 번호로 참여하셨어요. 번호당 1회만 참여할 수 있어요.'
      : '입력하신 내용을 저장하지 못했어요. 항목을 다시 확인해 주세요.';
  }
  return `인터넷 연결이 불안정해 아직 저장되지 않았어요. 입력하신 내용은 이 기기에 보관해 두었으니 아래 버튼으로 다시 보내 주세요. 계속 안 되면 ${C.EVENT.contact}으로 알려 주세요.`;
}

async function submitItem(item, isRetry) {
  const btn = $('#submitBtn'), msg = $('#formMsg');
  btn.disabled = true; btn.textContent = '보내는 중…'; msg.className = 'msg'; msg.textContent = '';
  if (!item.savedAt) item.savedAt = Date.now();
  ls.set(LS_PENDING, JSON.stringify(item));
  try {
    await send(item);
    finish(item.data.coupon);
  } catch (e) {
    // 검사에서 거부된 응답은 보관하지 않으므로, 재전송에서 거부되면 앞서 보낸 것이 이미 저장된 것
    if (isRetry && e.code === 'permission-denied') { finish(item.data.coupon); return; }
    if (e.code === 'permission-denied' || e.code === 'not-configured') ls.del(LS_PENDING);
    msg.className = 'msg bad';
    msg.textContent = errorText(e, item);
    btn.disabled = false;
    btn.textContent = ls.get(LS_PENDING) ? '다시 보내기' : '설문 제출하기';
    console.warn('[survey] submit failed:', e);
  }
}

$('#f').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const pending = ls.get(LS_PENDING);
  if (pending && $('#submitBtn').textContent === '다시 보내기') { submitItem(JSON.parse(pending), true); return; }
  const { data: d0, err } = collect();
  ['e1', 'e2', 'e3', 'e4', 'e5'].forEach((k) => { $('#' + k).textContent = err[k] || ''; });
  const first = Object.keys(err)[0];
  if (first && first !== 'e5') { $('#' + first).closest('fieldset').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  if (BUYER_CHECK && !buyer) {
    $('#verifySet').scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!digitsOf($('#gph').value)) { gateMsg('마지막으로 구매 고객 확인이 필요해요. 주문하실 때 입력한 휴대폰 번호를 적어 주세요.', 'bad'); return; }
    const okBuyer = await checkBuyer();
    if (!okBuyer) return;
  }
  // 쿠폰 대상인데 쿠폰을 안 골랐으면 한 번 알려 줌 (그래도 그냥 내면 그대로 제출)
  if (BUYER_CHECK && buyer && buyer.eligible && couponOpen && !$('#couponOn').checked && !couponNoticed) {
    couponNoticed = true;
    $('#e5').textContent = `쿠폰 대상 고객님이에요! ${won(C.EVENT.couponDiscount)} 쿠폰을 받으시려면 위 칸을 체크해 주세요. 쿠폰 없이 제출하시려면 [설문 제출하기]를 한 번 더 눌러 주세요.`;
    $('#couponSet').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const { data, err: err2 } = collect();
  ['e1', 'e2', 'e3', 'e4', 'e5'].forEach((k) => { $('#' + k).textContent = err2[k] || ''; });
  const first2 = Object.keys(err2)[0];
  if (first2) { $('#' + first2).closest('fieldset').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  void d0;
  const id = BUYER_CHECK ? 'b_' + buyer.hash : (data.coupon ? 'p_' + data.phone : randId());
  submitItem({ id, data }, false);
});

// ---------- 처음 화면으로 되돌리기 (중간에 나갔다가 시간이 지나 다시 온 경우) ----------
const IDLE_MS = (Number(C.IDLE_RESET_MINUTES) || 15) * 60 * 1000;   // 이 시간 동안 아무 조작이 없으면 처음부터
const PENDING_MAX_MS = 24 * 60 * 60 * 1000;                           // 못 보낸 응답은 하루만 보관
let lastActive = Date.now();
['input', 'change', 'click', 'keydown', 'touchstart'].forEach((ev) => document.addEventListener(ev, () => { lastActive = Date.now(); }, { passive: true }));

function startScreen() {
  if (!surveyOpen) return '#closed';
  if (ls.get(LS_DONE)) return '#done';
  return '#survey';
}
function resetAll() {
  buyer = null;
  couponNoticed = false;
  $('#f').reset();
  $('#gph').value = '';
  $('#ph').value = '';
  ['#customBox', '#couponBox'].forEach((s) => { $(s).hidden = true; });
  if (BUYER_CHECK) $('#couponSet').hidden = true;
  ['e1', 'e2', 'e3', 'e4', 'e5'].forEach((k) => { $('#' + k).textContent = ''; });
  gateMsg('');
  const m = $('#formMsg'); m.className = 'msg'; m.textContent = '';
  const btn = $('#submitBtn'); btn.disabled = false; btn.textContent = '설문 제출하기';
  const scr = startScreen();
  show(scr);
  if (scr === '#done') $('#doneText').textContent = '이미 참여해 주셨어요. 감사합니다!';
  window.scrollTo(0, 0);
  lastActive = Date.now();
}
function resetIfIdle() {
  if (Date.now() - lastActive > IDLE_MS && !$('#submitBtn').disabled) resetAll();
}
// 탭으로 돌아왔을 때 · 뒤로가기로 다시 보였을 때 · 화면을 켜 둔 채 오래 뒀을 때
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') resetIfIdle(); });
window.addEventListener('focus', resetIfIdle);
window.addEventListener('pageshow', (e) => { if (e.persisted) resetIfIdle(); else { $('#f').reset(); $('#gph').value = ''; } });
setInterval(() => { if (document.visibilityState === 'visible') resetIfIdle(); }, 30000);

// 못 보낸 응답: 화면을 붙잡지 않고 뒤에서 조용히 한 번 다시 보내 봄
async function retryPendingQuietly() {
  let item = null;
  try { item = JSON.parse(ls.get(LS_PENDING) || 'null'); } catch (e) { item = null; }
  if (!item || !item.data) { ls.del(LS_PENDING); return; }
  if (!item.savedAt || Date.now() - item.savedAt > PENDING_MAX_MS) { ls.del(LS_PENDING); return; }
  try { await send(item); finish(item.data.coupon); }
  catch (e) {
    if (e.code === 'permission-denied') finish(item.data.coupon);  // 이미 저장된 것
    // 그 밖의 실패는 보관만 해 두고 화면은 처음 그대로
  }
}

// ---------- 시작 ----------
if (!surveyOpen) {
  show('#closed');
  const before = now < kst(C.EVENT.surveyStart);
  $('#closedTitle').textContent = before ? '설문 준비 중이에요' : '설문이 마감됐어요';
  $('#closedText').textContent = before ? `${C.EVENT.surveyStart}부터 참여하실 수 있어요.` : '참여해 주신 모든 분께 감사드립니다.';
} else {
  resetAll();
  if (!ls.get(LS_DONE) && ls.get(LS_PENDING)) retryPendingQuietly();
}
window.addEventListener('online', () => {
  if (ls.get(LS_PENDING) && !$('#submitBtn').disabled && !ls.get(LS_DONE)) retryPendingQuietly();
});
