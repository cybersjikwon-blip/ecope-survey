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

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtPhone = (p) => (p && p.length >= 10 ? `${p.slice(0, 3)}-${p.slice(3, p.length - 4)}-${p.slice(-4)}` : p || '');
const fmtDate = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '(저장 중)');
const STATUS = { pending: '확인 대기', issued: '지급 완료', rejected: '대상 아님' };
const SIZE_NAME = Object.fromEntries(C.SIZE_OPTIONS.map((o) => [o.id, `${o.name} (${o.t})`]));
const msg = (el, text, kind) => { el.className = 'msg' + (kind ? ' ' + kind : ''); el.textContent = text || ''; };

window.__appReady = true;
$('#ver').textContent = C.APP_VERSION;
const configured = CFG_PROBLEMS.length === 0;
if (!configured) { $('#setupNotice').hidden = false; $('#setupNotice').textContent = 'js/config.js 의 Firebase 설정을 확인해 주세요: ' + CFG_PROBLEMS.join(' / '); }

let A, F, auth, db, rows = [];

async function boot() {
  if (!configured) return;
  try {
    const [app, au, fs] = await Promise.all([
      import(`${C.FB_SDK}/firebase-app.js`), import(`${C.FB_SDK}/firebase-auth.js`), import(`${C.FB_SDK}/firebase-firestore.js`)]);
    const a = app.initializeApp(C.firebaseConfig);
    A = au; F = fs; auth = au.getAuth(a); db = fs.getFirestore(a);
    au.getRedirectResult(auth).catch((e) => msg($('#loginMsg'), '로그인 실패: ' + (e.code || e.message), 'bad'));
    au.onAuthStateChanged(auth, onUser);
  } catch (e) {
    msg($('#loginMsg'), 'Firebase를 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.', 'bad');
    console.error(e);
  }
}

$('#loginBtn').addEventListener('click', async () => {
  if (!configured) { msg($('#loginMsg'), 'js/config.js 설정 문제로 로그인할 수 없어요: ' + CFG_PROBLEMS.join(' / '), 'bad'); return; }
  if (!auth) { msg($('#loginMsg'), 'Firebase를 아직 불러오는 중이거나 불러오지 못했어요. 잠시 후 다시 누르거나 새로고침해 주세요.', 'bad'); boot(); return; }
  const p = new A.GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  try { await A.signInWithPopup(auth, p); }
  catch (e) {
    // 팝업이 막히거나(휴대폰·인앱 브라우저) 지원 안 되면 페이지 이동 방식으로
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(e.code)) {
      await A.signInWithRedirect(auth, p);
    } else if (e.code === 'auth/unauthorized-domain') {
      msg($('#loginMsg'), '이 주소가 Firebase 승인 도메인에 없어요. README 6단계를 확인해 주세요.', 'bad');
    } else if (e.code !== 'auth/popup-closed-by-user') {
      msg($('#loginMsg'), '로그인 실패: ' + e.code, 'bad');
    }
  }
});
$('#logoutBtn').addEventListener('click', () => A.signOut(auth));

function onUser(u) {
  $('#who').textContent = u ? u.email : '';
  const norm = (x) => String(x || '').trim().toLowerCase();
  const admins = (C.ADMIN_EMAILS || []).map(norm).filter(Boolean);
  const ok = u && admins.includes(norm(u.email));
  $('#loginBox').hidden = !!ok;
  $('#dash').hidden = !ok;
  if (u && !ok) {
    const mask = (e) => { const [id, d] = e.split('@'); return (id || '').slice(0, 3) + '***@' + (d || ''); };
    const reg = admins.length ? admins.map(mask).join(', ') : '(없음)';
    const hint = admins.some((e) => e.includes('관리자이메일')) ? ' → config.js 에 아직 예시 이메일이 들어 있어요. 본인 이메일로 바꿔 다시 올려 주세요.'
      : ' → 철자가 다르거나, 수정한 config.js 가 아직 반영 전일 수 있어요 (올린 뒤 최대 10분, Ctrl+Shift+R).';
    msg($('#loginMsg'), `로그인한 계정: ${u.email} / config.js 에 등록된 관리자: ${reg}${hint}`, 'bad');
    A.signOut(auth);
  }
  if (ok) { load(); setupQr(); loadBuyerMeta(); }
}

async function load() {
  msg($('#dashMsg'), '불러오는 중…');
  try {
    const snap = await F.getDocs(F.query(F.collection(db, 'responses'), F.orderBy('createdAt', 'desc')));
    rows = snap.docs.map((d) => { const x = d.data(); return { id: d.id, ...x, at: x.createdAt ? x.createdAt.toDate() : null }; });
    msg($('#dashMsg'), '');
    render();
  } catch (e) {
    msg($('#dashMsg'), e.code === 'permission-denied'
      ? '읽기 권한이 없어요. firestore.rules 의 관리자 이메일이 지금 로그인한 계정과 같은지 확인해 주세요.'
      : '불러오지 못했어요: ' + (e.code || e.message), 'bad');
  }
}
$('#reloadBtn').addEventListener('click', load);
['#fltCoupon', '#fltFrom', '#fltTo', '#fltStatus'].forEach((s) => $(s).addEventListener('change', render));

function filtered() {
  const c = $('#fltCoupon').value, f = $('#fltFrom').value, t = $('#fltTo').value;
  return rows.filter((r) => {
    if (c === 'coupon' && !r.coupon) return false;
    if (c === 'nocoupon' && r.coupon) return false;
    if (f && r.at && r.at < new Date(f + 'T00:00:00')) return false;
    if (t && r.at && r.at > new Date(t + 'T23:59:59')) return false;
    return true;
  });
}

function bars(el, entries, base) {
  if (!base || !entries.length) { el.innerHTML = '<p class="hint">아직 데이터가 없어요.</p>'; return; }
  el.innerHTML = entries.map(([label, n]) => {
    const pct = (n / base) * 100;
    return `<div class="bar"><span>${esc(label)}</span><div class="tr"><div class="fl" style="width:${Math.min(100, pct).toFixed(1)}%"></div></div><span class="n">${pct.toFixed(1)}% (${n})</span></div>`;
  }).join('');
}
function count(list, keyFn, order) {
  const m = new Map();
  list.forEach((r) => [].concat(keyFn(r)).forEach((k) => { if (k !== undefined && k !== null && k !== '') m.set(k, (m.get(k) || 0) + 1); }));
  const out = [...m.entries()];
  if (order) out.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])); else out.sort((a, b) => b[1] - a[1]);
  return out;
}

function render() {
  const L = filtered(), n = L.length;
  const cp = rows.filter((r) => r.coupon);
  $('#kpis').innerHTML = [
    ['응답 수 (현재 보기)', n], ['전체 응답', rows.length], ['쿠폰 신청', cp.length],
    ['확인 대기', cp.filter((r) => r.status === 'pending').length], ['지급 완료', cp.filter((r) => r.status === 'issued').length]
  ].map(([k, v]) => `<div class="kpi">${k}<b>${v}</b></div>`).join('');

  bars($('#chSize'), count(L, (r) => (r.sizes || []).map((s) => SIZE_NAME[s] || s).concat(r.custom ? ['직접 입력'] : [])).sort((a, b) => b[1] - a[1]), n);
  const cus = L.filter((r) => r.custom);
  const r5 = (v) => Math.round(v / 5) * 5;
  bars($('#chCustom'), count(cus, (r) => `${r5(r.custom.w)}×${r5(r.custom.h)}`), cus.length);
  $('#customRaw').innerHTML = cus.map((r) => `<tr><td>${fmtDate(r.at)}</td><td>${r.custom.w}×${r.custom.h}</td><td>${esc(r.custom.t || '모름')}</td><td>${esc(r.custom.note)}</td></tr>`).join('') || '<tr><td colspan="4">없음</td></tr>';
  bars($('#chUse'), count(L, (r) => r.uses || []), n);
  bars($('#chThick'), count(L, (r) => C.THICK[r.thick] || r.thick, Object.values(C.THICK)), n);
  bars($('#chQty'), count(L, (r) => C.QTY[r.qty] || r.qty, Object.values(C.QTY)), n);
  bars($('#chSrc'), count(L, (r) => C.SOURCES[r.src] || (r.src === 'direct' ? '링크 직접' : r.src)), n);
  const cm = L.filter((r) => r.comment);
  $('#comments').innerHTML = cm.map((r) => `<tr><td>${fmtDate(r.at)}</td><td style="white-space:normal">${esc(r.comment)}</td></tr>`).join('') || '<tr><td colspan="2">없음</td></tr>';

  // 쿠폰 표
  const st = $('#fltStatus').value;
  const nameCnt = count(cp.filter((r) => r.name), (r) => r.name);
  const dupNames = new Set(nameCnt.filter(([, c]) => c > 1).map(([k]) => k));
  const list = cp.filter((r) => !st || r.status === st);
  $('#couponRows').innerHTML = list.map((r) => `<tr>
    <td>${fmtDate(r.at)}</td><td>${esc(r.name) || '<span class="hint">(파기됨)</span>'} ${dupNames.has(r.name) ? '<span class="dup">중복?</span>' : ''}</td>
    <td>${esc(fmtPhone(r.phone))}</td><td>${esc(r.channel)}</td><td>${esc(C.SOURCES[r.src] || r.src)}</td>
    <td><select data-id="${esc(r.id)}" aria-label="상태 변경">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${r.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
    <td class="hint" id="s_${esc(r.id)}"></td></tr>`).join('') || '<tr><td colspan="7">쿠폰 신청이 없어요.</td></tr>';
}

$('#couponRows').addEventListener('change', async (e) => {
  const sel = e.target.closest('select[data-id]'); if (!sel) return;
  const id = sel.dataset.id, row = rows.find((r) => r.id === id), prev = row.status;
  const note = document.getElementById('s_' + id);
  note.textContent = '저장 중…';
  try { await F.updateDoc(F.doc(db, 'responses', id), { status: sel.value }); row.status = sel.value; render(); const n2 = document.getElementById('s_' + id); if (n2) n2.textContent = '저장됨'; }
  catch (err) { sel.value = prev; note.textContent = '저장 실패: ' + (err.code || err.message); }
});

// 개인정보 파기: 처리 끝난(지급 완료/대상 아님) 신청자 → 이름·번호 지운 새 문서로 옮기고 원본(번호가 들어간 문서) 삭제
$('#purgeBtn').addEventListener('click', async () => {
  const targets = rows.filter((r) => r.coupon && r.name && (r.status === 'issued' || r.status === 'rejected'));
  if (!targets.length) { msg($('#dashMsg'), '파기할 대상이 없어요. (지급 완료·대상 아님 상태만 파기돼요)'); return; }
  if (!confirm(`${targets.length}명의 이름·휴대폰 번호를 영구 삭제합니다. 설문 답변은 남아요. 진행할까요?\n(먼저 'CSV 받기'로 백업해 두셔도 됩니다)`)) return;
  try {
    for (let i = 0; i < targets.length; i += 200) {
      const b = F.writeBatch(db);
      targets.slice(i, i + 200).forEach((r) => {
        const { id, at, ...data } = r;
        const nid = 'r_' + crypto.randomUUID().replace(/-/g, '').slice(0, 20);
        b.set(F.doc(db, 'responses', nid), { ...data, name: '', phone: '', channel: data.channel || '', purged: true });
        b.delete(F.doc(db, 'responses', id));
      });
      await b.commit();
    }
    await load();
    msg($('#dashMsg'), `${targets.length}명의 개인정보를 파기했어요.`, 'ok');
  } catch (e) { msg($('#dashMsg'), '파기 실패: ' + (e.code || e.message), 'bad'); }
});

// CSV (엑셀에서 한글 깨지지 않게 BOM 포함)
$('#csvBtn').addEventListener('click', () => {
  const head = ['접수일', '선택 크기', '직접 가로', '직접 세로', '직접 두께', '직접 메모', '용도', '두께 선호', '구매 방식', '하고 싶은 말', '쿠폰', '이름', '휴대폰', '구매처', '상태', '유입', '버전'];
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = filtered().map((r) => [fmtDate(r.at), (r.sizes || []).map((s) => SIZE_NAME[s] || s).join(' / '),
    r.custom?.w, r.custom?.h, r.custom?.t, r.custom?.note, (r.uses || []).join(' / '), C.THICK[r.thick] || r.thick, C.QTY[r.qty] || r.qty,
    r.comment, r.coupon ? 'Y' : '', r.name, fmtPhone(r.phone), r.channel, r.coupon ? STATUS[r.status] || r.status : '', C.SOURCES[r.src] || r.src, r.v].map(q).join(','));
  const blob = new Blob(['﻿' + [head.map(q).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `에코PE_설문_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});

// QR
function surveyUrl(src) { const u = new URL('index.html', location.href); u.search = ''; u.hash = ''; if (src) u.searchParams.set('src', src); return u.toString(); }
function setupQr() {
  if ($('#qrSrc').options.length) return;
  $('#qrSrc').innerHTML = Object.entries(C.SOURCES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  $('#qrSrc').addEventListener('change', drawQr);
  drawQr();
}
function drawQr() {
  const url = surveyUrl($('#qrSrc').value);
  $('#qrUrl').textContent = url;
  const box = $('#qr'); box.innerHTML = '';
  if (typeof window.qrcode !== 'function') { box.textContent = 'QR 파일(js/vendor/qrcode.js)을 불러오지 못했어요. 링크를 복사해 QR 생성기를 이용해 주세요.'; return; }
  const q = window.qrcode(0, 'M'); q.addData(url); q.make();
  const n = q.getModuleCount(), cell = 10, pad = 4, size = (n + pad * 2) * cell;
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  cv.style.width = cv.style.height = '300px'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', '설문 링크 QR 코드');
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, size, size); g.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) g.fillRect((c + pad) * cell, (r + pad) * cell, cell, cell);
  box.appendChild(cv);
  $('#qrDown').href = cv.toDataURL('image/png');
  $('#qrDown').download = `설문QR_${$('#qrSrc').value}.png`;
}
$('#copyBtn').addEventListener('click', async () => {
  const url = $('#qrUrl').textContent;
  try { await navigator.clipboard.writeText(url); msg($('#dashMsg'), '링크를 복사했어요.', 'ok'); }
  catch (e) { msg($('#dashMsg'), '자동 복사가 안 돼요. 아래 주소를 길게 눌러 복사해 주세요.', 'bad'); }
});

// ---------- 구매자 명단 (장부 → CSV → 암호값으로 바꿔 Firestore buyers 에 저장) ----------
async function buyerHash(phone) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${C.EVENT.id}:${phone}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',' || ch === '\t') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}
async function readTextSmart(file) {
  const buf = await file.arrayBuffer();
  const utf = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  if (!utf.includes('�')) return utf;
  try { return new TextDecoder('euc-kr').decode(buf); } catch (e) { return utf; } // 엑셀에서 다시 저장한 CSV 대비
}
async function loadBuyerMeta() {
  try {
    const m = await F.getDoc(F.doc(db, 'meta', 'buyers'));
    const d = m.exists() ? m.data() : null;
    $('#buyerKpis').innerHTML = d
      ? [['등록된 구매자', d.count.toLocaleString()], [`쿠폰 대상 (${(C.EVENT.couponHistoryAmount / 10000).toLocaleString()}만원↑)`, d.eligible.toLocaleString()],
         ['마지막으로 올린 날', d.at ? fmtDate(d.at.toDate()) : '-']].map(([k, v]) => `<div class="kpi">${k}<b>${v}</b></div>`).join('')
      : '<p class="hint">아직 올린 명단이 없어요. 명단이 없으면 고객이 확인 단계에서 막힙니다.</p>';
  } catch (e) { $('#buyerKpis').innerHTML = '<p class="hint">명단 정보를 읽지 못했어요: ' + esc(e.code || e.message) + '</p>'; }
}
$('#buyerBtn').addEventListener('click', async () => {
  const f = $('#buyerFile').files[0], out = $('#buyerMsg');
  if (!f) { msg(out, '먼저 장부에서 만든 명단 파일(.csv)을 골라 주세요.', 'bad'); return; }
  let rows;
  try { rows = parseCsv(await readTextSmart(f)); } catch (e) { msg(out, '파일을 읽지 못했어요: ' + e.message, 'bad'); return; }
  if (rows.length < 2) { msg(out, '파일에 명단이 없어요.', 'bad'); return; }
  const head = rows[0].map((h) => String(h).replace(/\s/g, ''));
  let pi = head.findIndex((h) => /연락처|전화|휴대폰|phone/i.test(h));
  let ai = head.findIndex((h) => /누적구매액|구매액|금액|amount/i.test(h));
  if (pi < 0) { msg(out, "'연락처' 칸을 찾지 못했어요. 장부의 [설문용 구매자 명단 내보내기]로 만든 파일인지 확인해 주세요.", 'bad'); return; }
  const agg = new Map(); const st = { safe: 0, bad: 0 };
  rows.slice(1).forEach((r) => {
    let d = String(r[pi] || '').replace(/\D/g, '');
    if (d.length === 10 && d.startsWith('1')) d = '0' + d; // 엑셀이 맨 앞 0을 지운 경우
    if (d.startsWith('050')) { st.safe++; return; }
    if (!/^01[016789]\d{7,8}$/.test(d)) { st.bad++; return; }
    const amt = ai >= 0 ? Number(String(r[ai] || '0').replace(/[^\d.-]/g, '')) || 0 : 0;
    agg.set(d, (agg.get(d) || 0) + amt);
  });
  if (!agg.size) { msg(out, '올릴 수 있는 번호가 없어요.', 'bad'); return; }
  const eligibleCnt = [...agg.values()].filter((v) => v >= C.EVENT.couponHistoryAmount).length;
  if (!confirm(`구매자 ${agg.size.toLocaleString()}명 (쿠폰 대상 ${eligibleCnt.toLocaleString()}명)으로 명단을 바꿉니다.\n제외: 안심번호 ${st.safe} · 형식 오류 ${st.bad}\n\n진행할까요?`)) return;
  $('#buyerBtn').disabled = true;
  try {
    msg(out, '암호값으로 바꾸는 중…');
    const next = new Map();
    for (const [p, amt] of agg) next.set(await buyerHash(p), amt >= C.EVENT.couponHistoryAmount);
    msg(out, '기존 명단과 비교하는 중…');
    const old = await F.getDocs(F.collection(db, 'buyers'));
    const ops = [];
    old.docs.forEach((d) => { if (!next.has(d.id)) ops.push(['del', d.id]); });
    const oldMap = new Map(old.docs.map((d) => [d.id, (d.data() || {}).e === true]));
    next.forEach((e, h) => { if (!oldMap.has(h) || oldMap.get(h) !== e) ops.push(['set', h, e]); });
    for (let i = 0; i < ops.length; i += 400) {
      const b = F.writeBatch(db);
      ops.slice(i, i + 400).forEach((o) => (o[0] === 'del' ? b.delete(F.doc(db, 'buyers', o[1])) : b.set(F.doc(db, 'buyers', o[1]), { e: o[2] })));
      await b.commit();
      msg(out, `저장 중… ${Math.min(i + 400, ops.length).toLocaleString()} / ${ops.length.toLocaleString()}`);
    }
    await F.setDoc(F.doc(db, 'meta', 'buyers'), { count: next.size, eligible: eligibleCnt, at: F.serverTimestamp(), file: f.name.slice(0, 100) });
    $('#buyerFile').value = '';
    msg(out, `완료! 구매자 ${next.size.toLocaleString()}명 (쿠폰 대상 ${eligibleCnt.toLocaleString()}명) · 바뀐 항목 ${ops.length.toLocaleString()}개. 이제 PC의 명단 파일은 지워 주세요.`, 'ok');
    loadBuyerMeta();
  } catch (e) {
    msg(out, '올리지 못했어요: ' + (e.code === 'permission-denied' ? '권한 없음 — firestore.rules 를 새 버전으로 바꿔 게시했는지 확인해 주세요.' : (e.code || e.message)) + ' (다시 누르면 이어서 맞춰 줍니다)', 'bad');
  } finally { $('#buyerBtn').disabled = false; }
});

boot();
