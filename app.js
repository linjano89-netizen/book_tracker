// ══════════════════════════════════════════
// app.js — 단일 번들
// 개선 사항:
//   1. escHtml 단일화 (utils)
//   2. books 배열 불변 패턴 (직접 mutate 제거)
//   3. window.App + 이벤트 위임 혼합 방식
//   4. 차트 ResizeObserver 리사이즈 대응
//   5. 토스트 기반 저장 오류 알림
// ══════════════════════════════════════════


// ════════════════════════════════
// [1] utils — 공통 함수 (escHtml 단일 정의)
// ════════════════════════════════

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}


// ════════════════════════════════
// [5] 토스트 알림
// ════════════════════════════════

(function injectToastStyles() {
  const style = document.createElement('style');
  style.textContent = `
    #toast-container {
      position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
      z-index: 9999; display: flex; flex-direction: column; align-items: center; gap: 8px;
      pointer-events: none;
    }
    .toast {
      font-family: var(--mono); font-size: 12px; padding: 10px 18px;
      border-radius: 8px; border: 1px solid var(--border);
      background: var(--bg2); color: var(--text1);
      opacity: 0; transform: translateY(8px);
      transition: opacity 0.2s, transform 0.2s;
      white-space: nowrap; pointer-events: none;
    }
    .toast.show { opacity: 1; transform: translateY(0); }
    .toast.error { border-color: var(--red); color: var(--red); }
    .toast.success { border-color: var(--green); color: var(--green); }
  `;
  document.head.appendChild(style);
  const container = document.createElement('div');
  container.id = 'toast-container';
  document.body.appendChild(container);
})();

function showToast(msg, type = 'info', duration = 2500) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add('show'));
  });
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  }, duration);
}


// ════════════════════════════════
// storage — localStorage
// ════════════════════════════════

const STORAGE_KEY = 'book_tracker_v1';

function loadBooks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

// [5] alert → 토스트로 교체
function saveBooks(books) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
  } catch (e) {
    showToast('⚠️ 저장에 실패했습니다. 저장 공간을 확인해주세요.', 'error', 4000);
    console.error('saveBooks error:', e);
  }
}


// ════════════════════════════════
// [2] 전역 상태 — 불변 패턴
//   books는 항상 새 배열로 교체하고
//   인덱스로 직접 mutate하는 대신
//   map()으로 새 객체를 반환한다.
// ════════════════════════════════

let _books         = loadBooks();
let _currentFilter = 'all';
let _rateTargetId  = null;
let _editTargetId  = null;

// 읽기 전용 게터 (외부에서 항상 이 함수를 통해 접근)
function getBooks()         { return _books; }
function getCurrentFilter() { return _currentFilter; }
function getRateTargetId()  { return _rateTargetId; }
function getEditTargetId()  { return _editTargetId; }

// 세터
function setBooks(arr)          { _books = arr; }
function setCurrentFilter(f)    { _currentFilter = f; }
function setRateTargetId(id)    { _rateTargetId = id; }
function setEditTargetId(id)    { _editTargetId = id; }

function persist() { saveBooks(_books); }

// [2] 불변 업데이트 헬퍼 — 인덱스 직접 mutate 금지
function updateBookById(id, updater) {
  setBooks(_books.map(b => b.id === Number(id) ? { ...b, ...updater(b) } : b));
}


// ════════════════════════════════
// 카카오 책 검색 API
// ════════════════════════════════

const KAKAO_API_KEY = '1d62c6445cecc229221aa89b812bddd6';
let _searchTimer      = null;
let _selectedBookData = null;

async function kakaoSearchBook(query) {
  if (!query.trim()) return [];
  const url = `https://dapi.kakao.com/v3/search/book?query=${encodeURIComponent(query)}&size=8`;
  try {
    const res  = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` } });
    const data = await res.json();
    return data.documents || [];
  } catch (e) {
    console.error('카카오 검색 오류', e);
    return [];
  }
}

function onSearchInput(val) {
  clearTimeout(_searchTimer);
  if (!val.trim()) { document.getElementById('search-dropdown').style.display = 'none'; return; }
  _searchTimer = setTimeout(() => searchBook(val), 400);
}

async function searchBook(query) {
  const q = query || document.getElementById('f-search').value;
  if (!q.trim()) return;
  const dropdown = document.getElementById('search-dropdown');
  dropdown.innerHTML = '<div style="padding:12px;font-family:var(--mono);font-size:12px;color:var(--text3);">검색 중...</div>';
  dropdown.style.display = 'block';
  const results = await kakaoSearchBook(q);
  if (!results.length) {
    dropdown.innerHTML = '<div style="padding:12px;font-family:var(--mono);font-size:12px;color:var(--text3);">검색 결과가 없습니다</div>';
    return;
  }
  dropdown.innerHTML = results.map((b, i) => {
    const title  = escHtml(b.title);
    const author = escHtml((b.authors || []).join(', '));
    const pages  = b.page ? `${b.page}p` : '페이지 미상';
    const thumb  = b.thumbnail || '';
    return `<div class="search-result-item" data-action="selectBook" data-idx="${i}">
      ${thumb ? `<img src="${thumb}" alt="" style="width:32px;height:46px;object-fit:cover;border-radius:3px;flex-shrink:0;">` : '<div style="width:32px;height:46px;background:var(--bg3);border-radius:3px;flex-shrink:0;"></div>'}
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;font-weight:600;color:var(--text1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${title}</div>
        <div style="font-size:11px;color:var(--text3);font-family:var(--mono);">${author}</div>
        <div style="font-size:10px;color:var(--accent);font-family:var(--mono);">${pages}</div>
      </div>
    </div>`;
  }).join('');
  dropdown._results = results;
}

function selectBook(idx) {
  const dropdown = document.getElementById('search-dropdown');
  const b        = dropdown._results[idx];
  if (!b) return;
  _selectedBookData = b;

  document.getElementById('f-title').value  = b.title || '';
  document.getElementById('f-author').value = (b.authors || []).join(', ');
  if (b.page) {
    document.getElementById('f-total-pages').value = b.page;
  } else {
    document.getElementById('f-total-pages').value = '';
  }
  updateProgress();

  const preview = document.getElementById('book-preview');
  preview.style.display = 'flex';
  document.getElementById('preview-cover').src            = b.thumbnail || '';
  document.getElementById('preview-cover').style.display  = b.thumbnail ? 'block' : 'none';
  document.getElementById('preview-title').textContent    = b.title || '';
  document.getElementById('preview-author').textContent   = (b.authors || []).join(', ');
  document.getElementById('preview-pages').textContent    = b.page ? `총 ${b.page}페이지` : '페이지 정보 없음';

  dropdown.style.display = 'none';
  document.getElementById('f-search').value = '';

  // 키워드 기반 장르 자동 추정
  const text = ((b.title || '') + ' ' + (b.contents || '')).toLowerCase();
  let guessed = '기타';
  if (/소설|novel|fiction|추리|미스터리|스릴러|판타지|sf |로맨스|단편|장편|주인공|등장인물|감동소설|문학상|데뷔작|작가의 첫/.test(text))
    guessed = '소설';
  else if (/습관|성공|자기계발|자기관리|생산성|목표|마인드|리더십|동기|처세|인간관계|화술|설득|대화법|커뮤니케이션|재테크|투자|부자/.test(text))
    guessed = '자기계발';
  else if (/프로그래밍|개발|코딩|알고리즘|인공지능|ai |머신러닝|데이터|과학|기술|수학|의학|공학|it /.test(text))
    guessed = '과학기술';
  else if (/역사|철학|사상|문명|인문학|고대|중세|근대|현대사/.test(text))
    guessed = '역사철학';
  else if (/에세이|일기|회고|르포|인터뷰|기행|여행기|산문/.test(text))
    guessed = '비소설';

  const genreSelect = document.getElementById('f-genre');
  genreSelect.value = guessed;

  // 추정임을 안내하는 힌트 표시
  let hint = document.getElementById('genre-select-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'genre-select-hint';
    hint.style.cssText = 'font-family:var(--mono);font-size:11px;margin-top:4px;';
    genreSelect.parentElement.appendChild(hint);
  }
  hint.style.color = 'var(--text3)';
  hint.textContent = `✦ 키워드로 추정한 장르입니다. 다르다면 직접 바꿔주세요.`;

  // 사용자가 직접 바꾸면 힌트 제거
  function onGenreChange() {
    hint.textContent = '';
    genreSelect.removeEventListener('change', onGenreChange);
  }
  genreSelect.addEventListener('change', onGenreChange);
}

function onStatusChange(val) {
  const wrap = document.getElementById('reading-progress-wrap');
  wrap.style.display = val === 'reading' ? 'block' : 'none';
  if (val === 'reading') updateProgress();
}

function updateProgress() {
  const currentPage = parseInt(document.getElementById('f-current-page').value) || 0;
  const totalPage   = parseInt(document.getElementById('f-total-pages').value)  || 0;
  const pct = totalPage > 0 ? Math.min(Math.round(currentPage / totalPage * 100), 100) : 0;
  document.getElementById('f-progress-pct').textContent = pct + '%';
  document.getElementById('f-progress-bar').style.width  = pct + '%';
}


// ════════════════════════════════
// [4] 차트 — ResizeObserver 리사이즈 대응
// ════════════════════════════════

let _calibFilter   = 10;
let _calibAllRated = [];
let _calibResizeObserver = null;

function setCalibFilter(val) {
  _calibFilter = val;
  document.querySelectorAll('.calib-filter-btn').forEach(btn => {
    btn.classList.toggle('active', String(btn.dataset.filter) === String(val));
  });
  _redrawCalib();
}

function _redrawCalib() {
  const sorted = [..._calibAllRated].sort((a, b) => a.num - b.num);
  const sliced = _calibFilter === 'all' ? sorted : sorted.slice(-_calibFilter);
  _drawCalibInner(sliced);
}

function drawCalibChart(rated) {
  _calibAllRated = rated;
  document.querySelectorAll('.calib-filter-btn').forEach(btn => {
    btn.classList.toggle('active', String(btn.dataset.filter) === String(_calibFilter));
  });

  // [4] ResizeObserver: 캔버스 컨테이너 크기 변화 감지 → 자동 재그리기
  const canvas = document.getElementById('calib-canvas');
  if (_calibResizeObserver) _calibResizeObserver.disconnect();
  _calibResizeObserver = new ResizeObserver(_debounce(() => _redrawCalib(), 150));
  _calibResizeObserver.observe(canvas.parentElement);

  _redrawCalib();
}

// [4] 월별 바차트도 리사이즈 대응
let _monthlyResizeObserver = null;

function _drawCalibInner(sorted) {
  const canvas  = document.getElementById('calib-canvas');
  const emptyEl = document.getElementById('calib-empty');
  const ctx     = canvas.getContext('2d');
  const dpr     = window.devicePixelRatio || 1;
  const W       = canvas.parentElement.clientWidth || 360;
  const H       = 200;
  canvas.width  = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  if (sorted.length < 2) {
    ctx.clearRect(0, 0, W, H);
    emptyEl.style.display = 'flex';
    canvas.style.opacity  = '0.15';
    return;
  }
  emptyEl.style.display = 'none';
  canvas.style.opacity  = '1';

  const isMobile  = W < 420;
  const DOT_R     = isMobile ? 8   : 5;
  const DOT_INNER = isMobile ? 4   : 2.5;
  const HIT_R     = isMobile ? 24  : 14;
  const pad       = { t: 18, r: 16, b: 32, l: 38 };
  const cw        = W - pad.l - pad.r;
  const ch        = H - pad.t - pad.b;
  ctx.clearRect(0, 0, W, H);

  const total = sorted.length;
  const xOf   = i => total === 1 ? pad.l + cw / 2 : pad.l + cw * i / (total - 1);

  // 격자
  ctx.strokeStyle = '#2a2a32'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + ch * i / 4;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cw, y); ctx.stroke();
  }

  // 기대도 점선
  ctx.strokeStyle = '#3a3a45'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
  ctx.beginPath();
  sorted.forEach((b, i) => {
    const px = xOf(i), py = pad.t + ch * (1 - b.expect / 100);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  });
  ctx.stroke(); ctx.setLineDash([]);

  // 만족도 실선
  ctx.strokeStyle = '#c8b89a'; ctx.lineWidth = 2;
  ctx.beginPath();
  sorted.forEach((b, i) => {
    const px = xOf(i), py = pad.t + ch * (1 - b.rating / 100);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  });
  ctx.stroke();

  // 점
  const hitPoints = [];
  sorted.forEach((b, i) => {
    const px = xOf(i), py = pad.t + ch * (1 - b.rating / 100);
    ctx.fillStyle = '#c8b89a';
    ctx.beginPath(); ctx.arc(px, py, DOT_R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0f0f11';
    ctx.beginPath(); ctx.arc(px, py, DOT_INNER, 0, Math.PI * 2); ctx.fill();
    if (!isMobile || total <= 8) {
      ctx.fillStyle = '#5a585e'; ctx.font = '9px DM Mono,monospace'; ctx.textAlign = 'center';
      ctx.fillText(`#${b.num}`, px, py - DOT_R - 4);
    }
    hitPoints.push({ px, py, book: b });
  });

  // 축 레이블
  ctx.fillStyle = '#5a585e'; ctx.font = '10px DM Mono,monospace';
  ctx.textAlign = 'right';
  ctx.fillText('100%', pad.l - 4, pad.t + 4);
  ctx.fillText('0%',   pad.l - 4, pad.t + ch + 4);
  ctx.textAlign = 'center';
  ctx.fillText('등록순 →', pad.l + cw / 2, H - 2);

  // 범례
  ctx.font = '9px DM Mono,monospace';
  ctx.fillStyle = '#c8b89a'; ctx.textAlign = 'left';
  ctx.fillText('── 만족도', pad.l, pad.t - 5);
  ctx.fillStyle = '#5a585e';
  ctx.fillText('- - 기대도', pad.l + 54, pad.t - 5);

  // 툴팁
  const tooltip = document.getElementById('calib-tooltip');
  function showCalibTooltip(hit) {
    const b  = hit.book;
    tooltip.innerHTML =
      `<span style="color:var(--accent)">#${b.num} ${b.title}</span><br>` +
      `기대도 <span style="color:var(--text2)">${b.expect}%</span>　` +
      `만족도 <span style="color:var(--yellow)">${b.rating}%</span><br>` +
      `갭 <span style="color:${b.rating - b.expect >= 0 ? 'var(--green)' : 'var(--red)'}">` +
      `${b.rating - b.expect > 0 ? '+' : ''}${b.rating - b.expect}%p</span>`;
    const tw = Math.min(tooltip.offsetWidth || 160, W - 16);
    const tx = Math.min(Math.max(hit.px - tw / 2, 4), W - tw - 4);
    const ty = hit.py - 72 < 4 ? hit.py + 12 : hit.py - 68;
    tooltip.style.left = tx + 'px'; tooltip.style.top = ty + 'px'; tooltip.style.display = 'block';
  }
  function hideCalibTooltip() { tooltip.style.display = 'none'; }

  canvas.onmousemove = e => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const hit = hitPoints.find(p => Math.hypot(p.px - mx, p.py - my) < HIT_R);
    hit ? (showCalibTooltip(hit), canvas.style.cursor = 'pointer') : (hideCalibTooltip(), canvas.style.cursor = 'default');
  };
  canvas.onmouseleave = () => { hideCalibTooltip(); canvas.style.cursor = 'default'; };
  canvas.ontouchstart = e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const t    = e.touches[0];
    const hit  = hitPoints.find(p => Math.hypot(p.px - (t.clientX - rect.left), p.py - (t.clientY - rect.top)) < HIT_R);
    hit ? showCalibTooltip(hit) : hideCalibTooltip();
  };
  canvas.ontouchend = () => setTimeout(hideCalibTooltip, 2000);
}

function drawGenrePie(books) {
  const genres = ['소설', '비소설', '자기계발', '과학기술', '역사철학', '기타'];
  const genreColors = {
    '소설': '#7a9abf', '비소설': '#7dbf94', '자기계발': '#c8b06a',
    '과학기술': '#9abf9a', '역사철학': '#c8b89a', '기타': '#5a585e'
  };
  const pieCanvas = document.getElementById('genre-pie');
  const pieEmpty  = document.getElementById('genre-pie-empty');
  const legend    = document.getElementById('genre-legend');
  const pieData   = genres.map(g => ({ g, n: books.filter(b => b.genre === g).length })).filter(d => d.n > 0);
  const total     = pieData.reduce((s, d) => s + d.n, 0);
  if (!total) {
    pieCanvas.style.display = 'none'; pieEmpty.style.display = 'flex'; legend.innerHTML = ''; return;
  }
  pieCanvas.style.display = 'block'; pieEmpty.style.display = 'none';
  const ctx = pieCanvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1, S = 160;
  pieCanvas.width = S * dpr; pieCanvas.height = S * dpr;
  pieCanvas.style.width = S + 'px'; pieCanvas.style.height = S + 'px';
  ctx.scale(dpr, dpr); ctx.clearRect(0, 0, S, S);
  const cx = S / 2, cy = S / 2, r = 64, ir = 36;
  let angle = -Math.PI / 2;
  for (const d of pieData) {
    const slice = (d.n / total) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, angle, angle + slice); ctx.closePath();
    ctx.fillStyle = genreColors[d.g] || '#5a585e'; ctx.fill();
    angle += slice;
  }
  ctx.beginPath(); ctx.arc(cx, cy, ir, 0, Math.PI * 2); ctx.fillStyle = '#17171a'; ctx.fill();
  ctx.fillStyle = '#f0ede8'; ctx.font = 'bold 18px DM Mono,monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(total + '권', cx, cy);
  legend.innerHTML = pieData.map(d => {
    const pct = Math.round(d.n / total * 100);
    return `<div style="display:flex;align-items:center;gap:8px;">
      <div style="width:10px;height:10px;border-radius:2px;background:${genreColors[d.g]};flex-shrink:0"></div>
      <span class="genre-badge ${d.g}" style="font-size:10px">${d.g}</span>
      <span style="font-family:var(--mono);font-size:12px;color:var(--text1);margin-left:auto">${d.n}권 <span style="color:var(--text3)">${pct}%</span></span>
    </div>`;
  }).join('');
}

// [4] drawMonthlyBar: ResizeObserver로 캔버스 자동 재그리기
function drawMonthlyBar(books) {
  const done       = books.filter(b => b.status === 'done' && b.ratedAt);
  const monthlyEl  = document.getElementById('monthly-bar');
  const monthEmpty = document.getElementById('monthly-empty');
  if (!done.length) { monthlyEl.style.display = 'none'; monthEmpty.style.display = 'block'; return; }
  monthlyEl.style.display = 'block'; monthEmpty.style.display = 'none';

  if (_monthlyResizeObserver) _monthlyResizeObserver.disconnect();
  _monthlyResizeObserver = new ResizeObserver(_debounce(() => _drawMonthlyInner(books), 150));
  _monthlyResizeObserver.observe(monthlyEl.parentElement);

  _drawMonthlyInner(books);
}

function _drawMonthlyInner(books) {
  const done      = books.filter(b => b.status === 'done' && b.ratedAt);
  const monthlyEl = document.getElementById('monthly-bar');
  if (!monthlyEl || !done.length) return;

  const counts = {};
  done.forEach(b => {
    const d   = new Date(b.ratedAt);
    const key = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    counts[key] = (counts[key] || 0) + 1;
  });
  const labels = Object.keys(counts).sort();
  const vals   = labels.map(k => counts[k]);
  const maxVal = Math.max(...vals);

  const ctx = monthlyEl.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W   = (monthlyEl.parentElement.clientWidth || 360) - 48;
  const H   = 160;
  monthlyEl.width = W * dpr; monthlyEl.height = H * dpr;
  monthlyEl.style.width = W + 'px'; monthlyEl.style.height = H + 'px';
  ctx.scale(dpr, dpr); ctx.clearRect(0, 0, W, H);

  const pad = { t: 28, r: 10, b: 36, l: 30 };
  const cw  = W - pad.l - pad.r, ch = H - pad.t - pad.b;
  const bw  = Math.min(cw / labels.length * 0.6, 40);
  const gap = cw / labels.length;

  ctx.strokeStyle = '#2a2a32'; ctx.lineWidth = 1;
  for (let i = 0; i <= maxVal; i++) {
    const y = pad.t + ch * (1 - i / maxVal);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cw, y); ctx.stroke();
    ctx.fillStyle = '#5a585e'; ctx.font = '9px DM Mono,monospace'; ctx.textAlign = 'right';
    ctx.fillText(i, pad.l - 4, y + 3);
  }
  labels.forEach((label, i) => {
    const x = pad.l + gap * i + gap / 2 - bw / 2;
    const bh = ch * (vals[i] / maxVal), y = pad.t + ch - bh;
    ctx.fillStyle = '#c8b89a';
    ctx.beginPath(); ctx.roundRect(x, y, bw, bh, [4, 4, 0, 0]); ctx.fill();
    ctx.fillStyle = '#f0ede8'; ctx.font = 'bold 11px DM Mono,monospace'; ctx.textAlign = 'center';
    ctx.fillText(vals[i] + '권', x + bw / 2, y - 5);
    ctx.fillStyle = '#5a585e'; ctx.font = '9px DM Mono,monospace';
    ctx.fillText(label, x + bw / 2, H - pad.b + 14);
  });
}

// [4] 공통 디바운스 유틸
function _debounce(fn, delay) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}


// ════════════════════════════════
// render — 책 카드, 대시보드, 도서목록
// ════════════════════════════════

function buildBookHTML(b, num) {
  const statusLabel = { wishlist: '읽고 싶다', reading: '읽는 중', done: '완독' }[b.status] || b.status;
  const ratingHTML  = b.rating
    ? `<span style="font-family:var(--mono);font-size:12px;color:var(--yellow);font-weight:500">${b.rating}%</span> <span style="font-family:var(--mono);font-size:10px;color:var(--text3)">만족도</span>`
    : `<span style="font-family:var(--mono);font-size:11px;color:var(--text3)">평점 없음</span>`;
  const rateBtn = b.rating
    ? `<button class="action-btn rate" data-action="openRateModal" data-id="${b.id}">평점 수정</button>`
    : `<button class="action-btn rate" data-action="openRateModal" data-id="${b.id}">평점 입력</button>`;
  const numLabel = num != null
    ? `<span style="font-family:var(--mono);font-size:10px;color:var(--text3);display:block;margin-bottom:2px">#${num}</span>`
    : '';

  // [3] 인라인 상태 선택기 — data-action 이벤트 위임 방식
  const statusSelector = `
    <div style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap;">
      ${['wishlist', 'reading', 'done'].map(s => {
        const lbl    = { wishlist: '읽고 싶다', reading: '읽는 중', done: '완독' }[s];
        const active = b.status === s;
        return `<button class="inline-status-btn ${active ? 'active-' + s : ''}" data-action="changeStatus" data-id="${b.id}" data-status="${s}"
          style="font-size:10px;font-family:var(--mono);padding:3px 9px;border-radius:10px;border:1px solid ${
            active ? (s === 'reading' ? 'var(--blue)' : s === 'done' ? 'var(--green)' : 'var(--text3)') : 'var(--border)'
          };background:${
            active ? (s === 'reading' ? 'rgba(122,154,191,0.15)' : s === 'done' ? 'rgba(125,191,148,0.15)' : 'rgba(90,88,94,0.15)') : 'none'
          };color:${
            active ? (s === 'reading' ? 'var(--blue)' : s === 'done' ? 'var(--green)' : 'var(--text3)') : 'var(--text3)'
          };cursor:pointer;transition:all 0.13s;">${lbl}</button>`;
      }).join('')}
    </div>`;

  const pageInputHTML = b.status === 'reading'
    ? `<div style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <input type="number" min="0" placeholder="현재 페이지"
          value="${b.currentPage || ''}"
          style="width:90px;font-family:var(--mono);font-size:13px;font-weight:500;color:var(--blue);text-align:center;padding:4px 6px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;outline:none;"
          data-action="inlineUpdatePage" data-id="${b.id}" data-total="${b.totalPages || 0}">
        <input type="number" min="1" placeholder="전체 페이지"
          value="${b.totalPages || ''}"
          style="width:100px;font-family:var(--mono);font-size:13px;color:var(--text2);text-align:center;padding:4px 6px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;outline:none;"
          data-action="inlineUpdateTotal" data-id="${b.id}">
        <span style="font-family:var(--mono);font-size:11px;color:var(--text3)">p</span>
        <span id="ipct-${b.id}" style="font-family:var(--mono);font-size:12px;color:var(--blue);font-weight:500;min-width:32px;">${b.progressPct || 0}%</span>
      </div>
      <div style="margin-top:5px;height:4px;background:var(--bg3);border-radius:2px;overflow:hidden;border:1px solid var(--border);">
        <div id="ibar-${b.id}" style="height:100%;width:${b.progressPct || 0}%;background:var(--blue);border-radius:2px;transition:width 0.3s;"></div>
      </div>`
    : '';

  const coverHTML = b.coverUrl
    ? `<img src="${b.coverUrl}" alt="" style="width:42px;height:60px;object-fit:cover;border-radius:4px;flex-shrink:0;border:1px solid var(--border);">`
    : '';

  return `
    <div class="book-item ${b.status}" id="bi-${b.id}">
      <div class="book-expect">
        ${numLabel}
        ${b.expect}<span style="font-size:12px">%</span>
        <span class="prob-label">기대도</span>
      </div>
      ${coverHTML}
      <div class="book-body">
        <div class="book-title">${escHtml(b.title)}</div>
        ${b.author ? `<div class="book-author">${escHtml(b.author)}</div>` : ''}
        <div class="book-meta">
          <span class="genre-badge ${b.genre}">${b.genre}</span>
          <span>${formatDate(b.createdAt)}</span>
          ${ratingHTML}
        </div>
        ${b.memo   ? `<div class="book-note">"${escHtml(b.memo)}"</div>`   : ''}
        ${b.review ? `<div class="book-note" style="color:var(--text2)">→ ${escHtml(b.review)}</div>` : ''}
        ${statusSelector}
        ${pageInputHTML}
      </div>
      <div class="book-actions">
        ${rateBtn}
        <button class="action-btn" data-action="openAddModal" data-id="${b.id}">수정</button>
        <button class="action-btn" data-action="deleteBook" data-id="${b.id}" style="color:var(--text3)">삭제</button>
      </div>
    </div>`;
}

function renderBookList() {
  const genres   = ['소설', '비소설', '자기계발', '과학기술', '역사철학', '기타'];
  const books    = getBooks();
  const filtered = books.filter(b => {
    const f = getCurrentFilter();
    if (f === 'all') return true;
    if (['wishlist', 'reading', 'done'].includes(f)) return b.status === f;
    if (genres.includes(f)) return b.genre === f;
    return true;
  });
  const el = document.getElementById('book-list');
  el.innerHTML = filtered.length
    ? filtered.map(b => buildBookHTML(b, books.length - books.indexOf(b))).join('')
    : '<div class="empty-state">해당 조건의 책이 없습니다.</div>';
}

function renderDashboard() {
  const books   = getBooks();
  const done    = books.filter(b => b.status === 'done');
  const reading = books.filter(b => b.status === 'reading');
  const rated   = done.filter(b => b.rating !== null);

  const avgRating     = rated.length > 0 ? rated.reduce((s, b) => s + b.rating, 0) / rated.length : null;
  const avgExpect     = books.length > 0 ? books.reduce((s, b) => s + b.expect, 0) / books.length : null;
  const avgExpOfRated = rated.length > 0 ? rated.reduce((s, b) => s + b.expect, 0) / rated.length : null;
  const gap           = (avgRating !== null && avgExpOfRated !== null) ? (avgRating - avgExpOfRated) : null;

  document.getElementById('header-count').textContent = `${books.length}권`;
  document.getElementById('kpi-total').textContent    = books.length;
  document.getElementById('kpi-done').textContent     = done.length;
  document.getElementById('kpi-done-sub').textContent = `읽는 중 ${reading.length}권`;
  document.getElementById('kpi-avgrate').textContent  = avgRating !== null ? avgRating.toFixed(1) + '%'  : '—';
  document.getElementById('kpi-avgexp').textContent   = avgExpect !== null ? avgExpect.toFixed(0) + '%'  : '—';

  const gapEl  = document.getElementById('kpi-gap');
  const gapSub = document.getElementById('kpi-gap-sub');
  if (gap !== null && rated.length >= 3) {
    gapEl.textContent = (gap > 0 ? '+' : '') + gap.toFixed(1) + '%p';
    gapEl.className   = 'kpi-val ' + (Math.abs(gap) < 5 ? '' : gap > 0 ? 'good' : 'warn');
    gapSub.textContent = gap > 5 ? '의외로 좋은 책을 고른다' : gap < -5 ? '기대가 현실보다 높은 편' : '기대와 현실이 잘 맞는다';
    document.getElementById('gap-section').style.display = 'block';
    const pct = Math.min(Math.max((-gap + 30) / 60 * 100, 5), 95);
    document.getElementById('gap-marker').style.left   = pct + '%';
    document.getElementById('gap-desc').textContent    =
      `기대 ${avgExpOfRated.toFixed(1)}% → 실제 ${avgRating.toFixed(1)}% (차이 ${gap > 0 ? '+' : ''}${gap.toFixed(1)}%p)`;
    document.getElementById('gap-explain').textContent =
      gap > 20   ? '기대보다 훨씬 좋은 책을 자주 만납니다. 책 선구안이 좋은 편입니다.'
      : gap > 5  ? '기대보다 만족도가 높은 편입니다.'
      : gap < -20 ? '책에 대한 기대가 실제 만족도보다 많이 높습니다. 기대치를 낮추는 것도 방법입니다.'
      : gap < -5 ? '기대에 비해 만족도가 낮은 편입니다.'
      :             '기대와 실제 만족도가 비교적 잘 맞습니다.';
  } else {
    document.getElementById('gap-section').style.display = 'none';
    gapEl.textContent  = '—';
    gapSub.textContent = `완독 ${Math.max(0, 3 - rated.length)}권 더 필요`;
  }

  const ratedWithNum = rated.map(b => ({ ...b, num: books.length - books.indexOf(b) }));
  drawCalibChart(ratedWithNum);

  const recentEl = document.getElementById('recent-list');
  recentEl.innerHTML = books.slice(0, 5).length
    ? books.slice(0, 5).map(b => buildBookHTML(b, books.length - books.indexOf(b))).join('')
    : '<div class="empty-state">아직 기록이 없습니다.</div>';
}

function renderAll() {
  const active = document.querySelector('.panel.active');
  if (active?.id === 'panel-dashboard') renderDashboard();
  if (active?.id === 'panel-books')     renderBookList();
  if (active?.id === 'panel-stats')     renderStats();
}


// ════════════════════════════════
// stats
// ════════════════════════════════

const GENRES = ['소설', '비소설', '자기계발', '과학기술', '역사철학', '기타'];

function switchStatTab(name) {
  document.getElementById('subpanel-stats1').style.display = name === 'stats1' ? 'block' : 'none';
  document.getElementById('subpanel-stats2').style.display = name === 'stats2' ? 'block' : 'none';
  document.getElementById('subtab-stats1').classList.toggle('active', name === 'stats1');
  document.getElementById('subtab-stats2').classList.toggle('active', name === 'stats2');
  if (name === 'stats2') renderStats2();
}

function renderStats() {
  drawGenrePie(getBooks());
  _renderGenreTable();
  _renderExpBucketTable();
}

function _renderGenreTable() {
  const books = getBooks();
  const tbody = document.getElementById('genre-stat-body');
  const rows  = [];
  for (const g of GENRES) {
    const inG   = books.filter(b => b.genre === g);
    if (!inG.length) continue;
    const rated  = inG.filter(b => b.rating !== null);
    const avgExp = inG.reduce((s, b) => s + b.expect, 0) / inG.length;
    const avgRat = rated.length > 0 ? rated.reduce((s, b) => s + b.rating, 0) / rated.length : null;
    const gap    = avgRat !== null ? (avgRat - avgExp) : null;
    const gapStr = gap !== null
      ? `<span style="color:${Math.abs(gap) < 5 ? 'var(--text2)' : gap > 0 ? 'var(--blue)' : 'var(--yellow)'}">${gap > 0 ? '+' : ''}${gap.toFixed(1)}%p</span>`
      : '—';
    rows.push(`<tr>
      <td><span class="genre-badge ${g}">${g}</span></td>
      <td class="val">${inG.length}권 <span style="color:var(--text3);font-size:10px">(평점 ${rated.length})</span></td>
      <td class="val">${avgExp.toFixed(0)}%</td>
      <td class="val">${avgRat !== null ? avgRat.toFixed(1) + '%' : '—'}</td>
      <td>${gapStr}</td>
    </tr>`);
  }
  tbody.innerHTML = rows.length ? rows.join('')
    : '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:20px;font-family:var(--mono);font-size:12px;">데이터 없음</td></tr>';
}

function _renderExpBucketTable() {
  const buckets = [
    { min: 0,  max: 30,  label: '~30%' },
    { min: 30, max: 50,  label: '30~50%' },
    { min: 50, max: 70,  label: '50~70%' },
    { min: 70, max: 85,  label: '70~85%' },
    { min: 85, max: 101, label: '85%~' },
  ];
  const rated = getBooks().filter(b => b.rating !== null);
  const pbody = document.getElementById('exp-stat-body');
  const prows = [];
  for (const bk of buckets) {
    const inB = rated.filter(r => r.expect >= bk.min && r.expect < bk.max);
    if (!inB.length) continue;
    const avgRat = inB.reduce((s, b) => s + b.rating, 0) / inB.length;
    const midExp = (bk.min + bk.max) / 2;
    const gap    = avgRat - midExp;
    const gapStr = `<span style="color:${Math.abs(gap) < 5 ? 'var(--text2)' : gap > 0 ? 'var(--blue)' : 'var(--yellow)'}">${gap > 0 ? '+' : ''}${gap.toFixed(1)}%p</span>`;
    prows.push(`<tr>
      <td class="val">${bk.label}</td><td class="val">${inB.length}</td>
      <td class="val">${avgRat.toFixed(1)}%</td><td>${gapStr}</td>
    </tr>`);
  }
  pbody.innerHTML = prows.length ? prows.join('')
    : '<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:20px;font-family:var(--mono);font-size:12px;">데이터 없음</td></tr>';
}

function renderStats2() {
  const books   = getBooks();
  const rated   = books.filter(b => b.rating !== null);
  const withGap = rated.map(b => ({ ...b, gap: b.rating - b.expect, num: books.length - books.indexOf(b) }));
  const topGood = [...withGap].sort((a, b) => b.gap - a.gap).slice(0, 3);
  const topBad  = [...withGap].sort((a, b) => a.gap - b.gap).slice(0, 3);

  const topHTML = list => list.length
    ? list.map(b => `
      <div class="book-item ${b.status}" style="padding:12px 16px;">
        <div class="book-expect">
          <span style="font-family:var(--mono);font-size:10px;color:var(--text3);display:block">#${b.num}</span>
          ${b.expect}<span style="font-size:12px">%</span>
          <span class="prob-label">기대도</span>
        </div>
        <div class="book-body">
          <div class="book-title">${escHtml(b.title)}</div>
          ${b.author ? `<div class="book-author">${escHtml(b.author)}</div>` : ''}
          <div class="book-meta">
            <span class="genre-badge ${b.genre}">${b.genre}</span>
            <span style="font-family:var(--mono);font-size:12px;color:var(--yellow)">${b.rating}% 만족도</span>
            <span style="font-family:var(--mono);font-size:12px;color:${b.gap >= 0 ? 'var(--green)' : 'var(--red)'};font-weight:500">${b.gap > 0 ? '+' : ''}${b.gap}%p</span>
          </div>
        </div>
      </div>`).join('')
    : '<div class="empty-state" style="padding:30px">완독한 책이 3권 이상이면 표시됩니다</div>';

  document.getElementById('top-good').innerHTML = topHTML(topGood);
  document.getElementById('top-bad').innerHTML  = topHTML(topBad);
  drawMonthlyBar(books);

  const total    = books.length;
  const doneLen  = books.filter(b => b.status === 'done').length;
  const reading  = books.filter(b => b.status === 'reading').length;
  const wishlist = books.filter(b => b.status === 'wishlist').length;
  const pct      = total > 0 ? Math.round(doneLen / total * 100) : 0;

  document.getElementById('completion-stat').innerHTML = total === 0
    ? '<div class="empty-state" style="padding:20px">기록된 책이 없습니다</div>'
    : `<div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:11px;color:var(--text3);margin-bottom:6px">
          <span>완독률</span><span style="color:var(--text1);font-size:14px;font-weight:700">${pct}%</span>
        </div>
        <div style="height:8px;background:var(--bg3);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:var(--green);border-radius:4px;transition:width 0.4s"></div>
        </div>
      </div>
      <div style="display:flex;gap:16px;flex-wrap:wrap">
        <div style="font-family:var(--mono);font-size:12px"><span style="color:var(--green)">●</span> 완독 <strong style="color:var(--text1)">${doneLen}권</strong></div>
        <div style="font-family:var(--mono);font-size:12px"><span style="color:var(--blue)">●</span> 읽는 중 <strong style="color:var(--text1)">${reading}권</strong></div>
        <div style="font-family:var(--mono);font-size:12px"><span style="color:var(--text3)">●</span> 읽고 싶다 <strong style="color:var(--text1)">${wishlist}권</strong></div>
      </div>`;
}


// ════════════════════════════════
// UI — 탭, 모달, 필터
// ════════════════════════════════

function _syncMobileStatSubtabs(name) {
  const bar = document.getElementById('mobile-stat-subtabs');
  if (!bar) return;
  // 통계 패널 활성 시에만 표시
  bar.classList.toggle('visible', name === 'stats');
  // 서브탭 활성 표시
  const s1 = document.getElementById('mst-stats1');
  const s2 = document.getElementById('mst-stats2');
  if (s1 && s2) {
    s1.classList.toggle('active', _lastStatPanel === 'stats1');
    s2.classList.toggle('active', _lastStatPanel === 'stats2');
  }
}

let _lastStatPanel = 'stats1';

function toggleStatsDropdown() {
  // 모바일(768px 이하): 드롭다운 대신 탭 패널로 전환
  if (window.innerWidth <= 768) {
    switchTab('stats');
  } else {
    document.getElementById('stats-dropdown').classList.toggle('open');
  }
}
function closeStatsDropdown() {
  const dd = document.getElementById('stats-dropdown');
  if (dd) dd.classList.remove('open');
}

function switchStatPanel(name) {
  _lastStatPanel = name;
  closeStatsDropdown();
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-stats').classList.add('active');
  document.getElementById('stats-tab-btn').classList.add('active');
  document.getElementById('subpanel-stats1').style.display = name === 'stats1' ? 'block' : 'none';
  document.getElementById('subpanel-stats2').style.display = name === 'stats2' ? 'block' : 'none';
  document.querySelectorAll('.dropdown-item').forEach((el, i) => {
    el.classList.toggle('active', (i === 0 && name === 'stats1') || (i === 1 && name === 'stats2'));
  });
  const lbl = document.getElementById('stat-panel-label');
  if (lbl) lbl.textContent = { stats1: '📊 통계 1', stats2: '📈 통계 2' }[name] || '';
  _syncMobileStatSubtabs('stats');
  if (name === 'stats1') renderStats();
  if (name === 'stats2') renderStats2();
}

function switchTab(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  closeStatsDropdown();
  document.getElementById('panel-' + name).classList.add('active');
  if (name === 'dashboard') { document.querySelectorAll('.tab')[0].classList.add('active'); renderDashboard(); }
  if (name === 'books')     { document.querySelectorAll('.tab')[1].classList.add('active'); renderBookList(); }
  if (name === 'stats')     { document.getElementById('stats-tab-btn').classList.add('active'); switchStatPanel(_lastStatPanel); return; }
  _syncMobileStatSubtabs(name);
}

function openAddModal(id = null) {
  setEditTargetId(id);
  _selectedBookData = null;
  document.getElementById('f-search').value = '';
  document.getElementById('search-dropdown').style.display = 'none';
  document.getElementById('book-preview').style.display    = 'none';
  if (id) {
    const b = getBooks().find(x => x.id === Number(id));
    if (!b) return;
    document.getElementById('add-modal-title').textContent  = '책 수정';
    document.getElementById('f-title').value   = b.title;
    document.getElementById('f-author').value  = b.author || '';
    document.getElementById('f-genre').value   = b.genre;
    document.getElementById('f-expect').value  = b.expect;
    document.getElementById('f-status').value  = b.status;
    document.getElementById('f-memo').value    = b.memo || '';
    document.getElementById('f-total-pages').value  = b.totalPages || '';
    document.getElementById('f-current-page').value = b.currentPage || '';
    document.getElementById('reading-progress-wrap').style.display = b.status === 'reading' ? 'block' : 'none';
    updateProgress();
  } else {
    document.getElementById('add-modal-title').textContent  = '책 추가';
    document.getElementById('f-title').value   = '';
    document.getElementById('f-author').value  = '';
    document.getElementById('f-genre').value   = '자기계발';
    document.getElementById('f-expect').value  = 50;
    document.getElementById('f-status').value  = 'wishlist';
    document.getElementById('f-memo').value    = '';
    document.getElementById('f-current-page').value = '';
    document.getElementById('f-total-pages').value  = '';
    document.getElementById('f-progress-pct').textContent  = '0%';
    document.getElementById('f-progress-bar').style.width  = '0%';
    document.getElementById('reading-progress-wrap').style.display = 'none';
    document.querySelectorAll('#add-modal .quick-btn').forEach(b => b.classList.remove('active'));
  }
  document.getElementById('add-modal').classList.add('open');
  setTimeout(() => document.getElementById('f-search').focus(), 100);
}

function closeAddModal() {
  document.getElementById('add-modal').classList.remove('open');
  setEditTargetId(null);
}

function saveBook() {
  const title = document.getElementById('f-title').value.trim();
  if (!title) { showToast('제목을 입력해주세요.', 'error'); return; }
  const status      = document.getElementById('f-status').value;
  const currentPage = parseInt(document.getElementById('f-current-page').value) || 0;
  const totalPages  = parseInt(document.getElementById('f-total-pages').value)  || 0;
  const progressPct = totalPages > 0 ? Math.min(Math.round(currentPage / totalPages * 100), 100) : 0;
  const coverUrl    = _selectedBookData?.thumbnail || '';

  const editId = getEditTargetId();
  if (editId) {
    // [2] map() 불변 업데이트
    updateBookById(editId, () => ({
      title,
      author:      document.getElementById('f-author').value.trim(),
      genre:       document.getElementById('f-genre').value,
      expect:      parseInt(document.getElementById('f-expect').value) || 50,
      status,
      memo:        document.getElementById('f-memo').value.trim(),
      currentPage, totalPages, progressPct,
      ...(coverUrl && { coverUrl }),
    }));
  } else {
    // [2] unshift 대신 새 배열로 교체
    setBooks([{
      id: Date.now(), title,
      author:      document.getElementById('f-author').value.trim(),
      genre:       document.getElementById('f-genre').value,
      expect:      parseInt(document.getElementById('f-expect').value) || 50,
      status,
      memo:        document.getElementById('f-memo').value.trim(),
      rating: null, review: '',
      currentPage, totalPages, progressPct,
      coverUrl,
      createdAt: new Date().toISOString(), ratedAt: null,
    }, ...getBooks()]);
  }
  persist();
  closeAddModal();
  renderAll();
  showToast('저장했습니다.', 'success');
}

function openRateModal(id) {
  const b = getBooks().find(x => x.id === Number(id));
  if (!b) return;
  setRateTargetId(Number(id));
  document.getElementById('rate-modal-desc').innerHTML =
    `<strong style="color:var(--text1)">${escHtml(b.title)}</strong>` +
    (b.author ? ` <span style="color:var(--text3)">— ${escHtml(b.author)}</span>` : '') +
    `<br><span style="font-family:var(--mono);font-size:11px;color:var(--text3)">기대도 ${b.expect}% · ${b.genre}</span>` +
    (b.rating ? `<br><span style="font-family:var(--mono);font-size:11px;color:var(--yellow)">현재 만족도: ${b.rating}%</span>` : '');
  document.getElementById('rate-review').value = b.review || '';
  document.getElementById('f-rating').value    = b.rating || '';
  document.querySelectorAll('#rate-modal .quick-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('rate-modal').classList.add('open');
}

function closeRateModal() {
  document.getElementById('rate-modal').classList.remove('open');
  setRateTargetId(null);
}

function submitRate() {
  const val = parseInt(document.getElementById('f-rating').value);
  if (!val || val < 1 || val > 100) { showToast('만족도를 입력해주세요. (1~100%)', 'error'); return; }
  // [2] 불변 업데이트
  updateBookById(getRateTargetId(), () => ({
    rating:  val,
    review:  document.getElementById('rate-review').value.trim(),
    status:  'done',
    ratedAt: new Date().toISOString(),
  }));
  persist();
  closeRateModal();
  renderAll();
  showToast('만족도를 기록했습니다.', 'success');
}

function deleteBook(id) {
  if (!confirm('이 책을 삭제할까요?')) return;
  // [2] filter()로 새 배열 반환
  setBooks(getBooks().filter(x => x.id !== Number(id)));
  persist();
  renderAll();
}

function setFilter(f, btn) {
  setCurrentFilter(f);
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderBookList();
}

function setExpect(val) {
  document.getElementById('f-expect').value = val;
  document.querySelectorAll('#add-modal .quick-btn').forEach(b => {
    b.classList.toggle('active', b.textContent === val + '%');
  });
}
function clampExpect(el) {
  let v = parseInt(el.value); if (isNaN(v)) return;
  if (v < 1) el.value = 1; if (v > 100) el.value = 100;
  document.querySelectorAll('#add-modal .quick-btn').forEach(b => {
    b.classList.toggle('active', b.textContent === el.value + '%');
  });
}
function setRating(val) {
  document.getElementById('f-rating').value = val;
  document.querySelectorAll('#rate-modal .quick-btn').forEach(b => {
    b.classList.toggle('active', b.textContent === val + '%');
  });
}
function clampRating(el) {
  let v = parseInt(el.value); if (isNaN(v)) return;
  if (v < 1) el.value = 1; if (v > 100) el.value = 100;
  document.querySelectorAll('#rate-modal .quick-btn').forEach(b => {
    b.classList.toggle('active', b.textContent === el.value + '%');
  });
}
function openGlossary()  { document.getElementById('glossary-modal').classList.add('open'); }
function closeGlossary() { document.getElementById('glossary-modal').classList.remove('open'); }

// [2] 인라인 상태 변경 (이벤트 위임에서 호출)
function changeStatus(id, status) {
  updateBookById(id, () => ({ status }));
  persist();
  renderAll();
}

// [2] 인라인 페이지 업데이트 (이벤트 위임에서 호출)
function inlineUpdatePage(id, currentPageVal, totalPagesVal) {
  const currentPage = parseInt(currentPageVal) || 0;
  const totalPages  = parseInt(totalPagesVal)  || 0;
  const progressPct = totalPages > 0 ? Math.min(Math.round(currentPage / totalPages * 100), 100) : 0;
  updateBookById(id, () => ({ currentPage, progressPct }));
  persist();
  // DOM만 업데이트 (리렌더 없이)
  const pctEl = document.getElementById(`ipct-${id}`);
  const barEl = document.getElementById(`ibar-${id}`);
  if (pctEl) pctEl.textContent = progressPct + '%';
  if (barEl) barEl.style.width = progressPct + '%';
}

function inlineUpdateTotal(id, totalPagesVal) {
  const el          = document.querySelector(`[data-action="inlineUpdatePage"][data-id="${id}"]`);
  const currentPage = el ? parseInt(el.value) || 0 : 0;
  const totalPages  = parseInt(totalPagesVal) || 0;
  const progressPct = totalPages > 0 ? Math.min(Math.round(currentPage / totalPages * 100), 100) : 0;
  updateBookById(id, () => ({ totalPages, progressPct }));
  persist();
  const pctEl = document.getElementById(`ipct-${id}`);
  const barEl = document.getElementById(`ibar-${id}`);
  if (pctEl) pctEl.textContent = progressPct + '%';
  if (barEl) barEl.style.width = progressPct + '%';
}


// ════════════════════════════════
// [3] 이벤트 위임 — 동적으로 생성되는 책 카드 버튼들
// ════════════════════════════════

document.addEventListener('click', function (e) {
  // 통계 드롭다운 닫기
  const dd = document.getElementById('stats-dropdown');
  if (dd && !dd.contains(e.target)) closeStatsDropdown();

  // data-action 위임 처리
  const target = e.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;
  const id     = target.dataset.id;

  switch (action) {
    case 'openRateModal': openRateModal(id);           break;
    case 'openAddModal':  openAddModal(id);            break;
    case 'deleteBook':    deleteBook(id);              break;
    case 'changeStatus':  changeStatus(id, target.dataset.status); break;
    case 'selectBook':    selectBook(Number(target.dataset.idx));   break;
  }
});

// input 이벤트 위임 (인라인 페이지 입력)
document.addEventListener('input', function (e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  const id     = Number(target.dataset.id);

  if (action === 'inlineUpdatePage') {
    inlineUpdatePage(id, target.value, target.dataset.total);
  }
  if (action === 'inlineUpdateTotal') {
    inlineUpdateTotal(id, target.value);
  }
});


// ════════════════════════════════
// window.App — HTML의 직접 onclick은 모달/탭/필터처럼
// 정적 버튼에만 최소한으로 남긴다.
// 동적 카드 버튼은 이벤트 위임으로 처리.
// ════════════════════════════════

window.App = {
  // 탭 & 패널
  switchTab, switchStatTab, switchStatPanel, toggleStatsDropdown,
  // 모달
  openAddModal, closeAddModal, saveBook,
  openRateModal, closeRateModal, submitRate,
  // 필터
  setFilter,
  // 기대도/평점 퀵버튼
  setExpect, clampExpect,
  setRating, clampRating,
  // 용어집
  openGlossary, closeGlossary,
  // 캘리브레이션 차트 필터
  setCalibFilter,
  // 책 검색
  onSearchInput, searchBook,
  // 상태 변경 & 진행률 (모달 내부)
  onStatusChange, updateProgress,
};


// ════════════════════════════════
// 초기화
// ════════════════════════════════

// 모달 외부 클릭 닫기
document.getElementById('add-modal').addEventListener('click',
  function (e) { if (e.target === this) closeAddModal(); });
document.getElementById('rate-modal').addEventListener('click',
  function (e) { if (e.target === this) closeRateModal(); });
document.getElementById('glossary-modal').addEventListener('click',
  function (e) { if (e.target === this) closeGlossary(); });

renderDashboard();
