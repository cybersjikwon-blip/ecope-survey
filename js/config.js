// =====================================================================
//  에코PE 사이즈 설문 — 설정 파일 (이 파일만 고치면 됩니다)
// =====================================================================

// 버전: 파일을 고쳐서 다시 올릴 때마다 숫자를 올리고,
// index.html · admin.html 의 "?v=" 뒤 숫자도 같이 바꿔 주세요 (브라우저 캐시 갱신용).
export const APP_VERSION = '1.0.1';

// Firebase 콘솔 → 프로젝트 설정 → 내 앱(웹) 에서 복사해 붙여넣기
export const firebaseConfig = {
  apiKey: "AIzaSyDu319varonEXP5lxeGrkSwwBh9NQ8WOOU",
  authDomain: "plastic-vote.firebaseapp.com",
  projectId: "plastic-vote",
  storageBucket: "plastic-vote.firebasestorage.app",
  messagingSenderId: "800621259206",
  appId: "1:800621259206:web:ec1723dea90ce409ee2ac7",
  measurementId: "G-X58BQNJK68"
};

// 결과를 볼 수 있는 관리자 구글 계정 (firestore.rules 에도 똑같이 적어야 함)
export const ADMIN_EMAILS = ['관리자이메일@gmail.com'];

// Firebase SDK 주소 (바꾸지 마세요)
export const FB_SDK = 'https://www.gstatic.com/firebasejs/10.12.2';

// 설문·쿠폰 기간 (YYYY-MM-DD, 한국시간 기준 그 날 23:59까지)
export const EVENT = {
  id: '2026-size-survey',
  surveyStart: '2026-11-01',
  surveyEnd: '2026-12-31',
  couponEnd: '2026-12-31',
  couponHistoryAmount: 300000, // 누적 구매 N원 이상 고객 (기간 제한 없음)
  couponMinOrder: 100000,      // N원 이상 구매 시
  couponDiscount: 3000,        // N원 할인
  contact: '스마트스토어 톡톡'
};

// 보여줄 크기 후보 (5개 권장). id 는 한 번 정하면 바꾸지 마세요 (집계 기준).
export const SIZE_OPTIONS = [
  { id: 's85x110',   w: 85,  h: 110, t: '0.06', name: '85 × 110',              desc: '부피 큰 이불·패딩, 100L 통' },
  { id: 's100x150t', w: 100, h: 150, t: '0.07', name: '100 × 150 (두꺼운 버전)', desc: '무거운 이삿짐·캠핑 용품' },
  { id: 's120x180',  w: 120, h: 180, t: '0.06', name: '120 × 180',             desc: '토퍼·큰 이불·이사 짐' },
  { id: 's70x130',   w: 70,  h: 130, t: '0.04', name: '70 × 130',              desc: '롱패딩·롱코트 옷걸이째 커버' },
  { id: 's90x120',   w: 90,  h: 120, t: '0.05', name: '90 × 120',              desc: '대형 분리수거·업소용' }
];
export const MAX_PICK = 2;

export const USES = ['이불·침구 보관', '의류 보관', '이사·대형 짐', '분리수거·쓰레기', '업소·매장용', '캠핑·아웃도어', '기타'];
export const THICK = { thin: '얇아도 저렴한 게 좋아요', thick: '비싸도 두껍고 튼튼한 게 좋아요', any: '상관없어요' };
export const QTY = { single: '필요할 때 낱장으로', bundle: '100장 묶음으로', both: '둘 다' };
export const CHANNELS = ['스마트스토어', '11번가', 'G마켓·옥션', '쿠팡', '기타'];
// 유입 경로 (링크 뒤 ?src=값) — 관리자 페이지에서 경로별 QR 을 만들 수 있음
export const SOURCES = { detail: '상세페이지 QR', box: '택배 박스 전단', talk: '톡톡 메시지', review: '리뷰 답글', etc: '기타' };
