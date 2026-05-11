// ══════════════════════════════════════════
// charts.js — Canvas 차트 전부
// ══════════════════════════════════════════

// ── 시간순 기대도 vs 만족도 추이 (Calibration 차트) ──

// 현재 필터 상태 모듈 내 보존
let _calibFilter = 10; // 5 | 10 | 20 | 'all'
let _calibAllRated = [];

export function setCalibFilter(val) {
  _calibFilter = val;
  // 필터 버튼 활성 표시
  document.querySelectorAll('.calib-filter-btn').forEach(btn => {
    btn.classList.toggle('active', String(btn.dataset.filter) === String(val));
  });
  _redrawCalib();
}

function _redrawCalib() {
  const sorted = [..._calibAllRated].sort((a, b) => a.num - b.num);
  const sliced = _calibFilter === 'all'
    ? sorted
    : sorted.slice(-_calibFilter); // 최신 N권 = 뒤에서 N개
  _drawCalibInner(sliced);
}

export function drawCalibChart(rated) {
  _calibAllRated = rated;
  // 초기 필터 버튼 활성 표시
  document.querySelectorAll('.calib-filter-btn').forEach(btn => {
    btn.classList.toggle('active', String(btn.dataset.filter) === String(_calibFilter));
  });
  _redrawCalib();
}

function _drawCalibInner(sorted) {
  const canvas  = document.getElementById('calib-canvas');
  const emptyEl = document.getElementById('calib-empty');
  const ctx     = canvas.getContext('2d');
  const dpr     = window.devicePixelRatio || 1;
  const W = canvas.parentElement.clientWidth || 360;
  const H = 200;
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

  const isMobile = W < 420;
  // 모바일은 점을 크게, 레이블 간격 조절
  const DOT_R     = isMobile ? 8  : 5;
  const DOT_INNER = isMobile ? 4  : 2.5;
  const HIT_R     = isMobile ? 24 : 14;

  const pad = { t: 18, r: 16, b: 32, l: 38 };
  const cw  = W - pad.l - pad.r;
  const ch  = H - pad.t - pad.b;
  ctx.clearRect(0, 0, W, H);

  const total = sorted.length;

  // 격자 (가로선만)
  ctx.strokeStyle = '#2a2a32'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + ch * i / 4;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cw, y); ctx.stroke();
  }

  const xOf = (i) => total === 1 ? pad.l + cw / 2 : pad.l + cw * i / (total - 1);

  // 기대도 점선
  ctx.strokeStyle = '#3a3a45'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
  ctx.beginPath();
  sorted.forEach((b, i) => {
    const px = xOf(i);
    const py = pad.t + ch * (1 - b.expect / 100);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  });
  ctx.stroke();
  ctx.setLineDash([]);

  // 만족도 실선
  ctx.strokeStyle = '#c8b89a'; ctx.lineWidth = 2;
  ctx.beginPath();
  sorted.forEach((b, i) => {
    const px = xOf(i);
    const py = pad.t + ch * (1 - b.rating / 100);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  });
  ctx.stroke();

  // 점 + 레이블 (모바일: 점만, 마우스오버/탭으로 툴팁)
  const hitPoints = [];
  sorted.forEach((b, i) => {
    const px = xOf(i);
    const py = pad.t + ch * (1 - b.rating / 100);

    ctx.fillStyle = '#c8b89a';
    ctx.beginPath(); ctx.arc(px, py, DOT_R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0f0f11';
    ctx.beginPath(); ctx.arc(px, py, DOT_INNER, 0, Math.PI * 2); ctx.fill();

    // 레이블: 모바일은 점이 많지 않을 때만 표시
    if (!isMobile || total <= 8) {
      ctx.fillStyle = '#5a585e';
      ctx.font = '9px DM Mono, monospace'; ctx.textAlign = 'center';
      ctx.fillText(`#${b.num}`, px, py - DOT_R - 4);
    }

    hitPoints.push({ px, py, book: b });
  });

  // 축 레이블
  ctx.fillStyle = '#5a585e'; ctx.font = '10px DM Mono, monospace';
  ctx.textAlign = 'right';
  ctx.fillText('100%', pad.l - 4, pad.t + 4);
  ctx.fillText('0%',   pad.l - 4, pad.t + ch + 4);
  ctx.textAlign = 'center';
  ctx.fillText('등록순 →', pad.l + cw / 2, H - 2);

  // 범례
  ctx.font = '9px DM Mono, monospace';
  ctx.fillStyle = '#c8b89a'; ctx.textAlign = 'left';
  ctx.fillText('── 만족도', pad.l, pad.t - 5);
  ctx.fillStyle = '#5a585e';
  ctx.fillText('- - 기대도', pad.l + 54, pad.t - 5);

  // ── 툴팁 공통 표시 함수 ──
  const tooltip = document.getElementById('calib-tooltip');

  function showTooltip(hit, cx, cy) {
    const b = hit.book;
    tooltip.innerHTML =
      `<span style="color:var(--accent)">#${b.num} ${b.title}</span><br>` +
      `기대도 <span style="color:var(--text2)">${b.expect}%</span>　` +
      `만족도 <span style="color:var(--yellow)">${b.rating}%</span><br>` +
      `갭 <span style="color:${b.rating - b.expect >= 0 ? 'var(--green)' : 'var(--red)'}">` +
      `${b.rating - b.expect > 0 ? '+' : ''}${b.rating - b.expect}%p</span>`;
    // 툴팁이 캔버스 밖으로 안 나가게
    const tw = Math.min(tooltip.offsetWidth || 160, W - 16);
    const tx = Math.min(Math.max(cx - tw / 2, 4), W - tw - 4);
    const ty = cy - 72 < 4 ? cy + 12 : cy - 68;
    tooltip.style.left    = tx + 'px';
    tooltip.style.top     = ty + 'px';
    tooltip.style.display = 'block';
  }
  function hideTooltip() {
    tooltip.style.display = 'none';
  }

  // ── 마우스 이벤트 (데스크톱) ──
  canvas.onmousemove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = hitPoints.find(p => Math.hypot(p.px - mx, p.py - my) < HIT_R);
    if (hit) {
      showTooltip(hit, hit.px, hit.py);
      canvas.style.cursor = 'pointer';
    } else {
      hideTooltip();
      canvas.style.cursor = 'default';
    }
  };
  canvas.onmouseleave = () => { hideTooltip(); canvas.style.cursor = 'default'; };

  // ── 터치 이벤트 (모바일) ──
  canvas.ontouchstart = (e) => {
    e.preventDefault(); // 스크롤 방지
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const tx = touch.clientX - rect.left;
    const ty = touch.clientY - rect.top;
    const hit = hitPoints.find(p => Math.hypot(p.px - tx, p.py - ty) < HIT_R);
    if (hit) {
      showTooltip(hit, hit.px, hit.py);
    } else {
      hideTooltip();
    }
  };
  canvas.ontouchend = () => {
    // 모바일은 탭 후 잠깐 보이다가 사라지게
    setTimeout(hideTooltip, 2000);
  };
}

// ── 장르 파이(도넛) 차트 ──
export function drawGenrePie(books) {
  const genres = ['소설','비소설','자기계발','과학기술','역사철학','기타'];
  const genreColors = {
    '소설':   '#7a9abf',
    '비소설': '#7dbf94',
    '자기계발':'#c8b06a',
    '과학기술':'#9abf9a',
    '역사철학':'#c8b89a',
    '기타':   '#5a585e',
  };

  const pieCanvas = document.getElementById('genre-pie');
  const pieEmpty  = document.getElementById('genre-pie-empty');
  const legend    = document.getElementById('genre-legend');
  const pieData   = genres.map(g => ({ g, n: books.filter(b => b.genre === g).length })).filter(d => d.n > 0);
  const total     = pieData.reduce((s, d) => s + d.n, 0);

  if (total === 0) {
    pieCanvas.style.display = 'none';
    pieEmpty.style.display  = 'flex';
    legend.innerHTML = '';
    return;
  }

  pieCanvas.style.display = 'block';
  pieEmpty.style.display  = 'none';
  const ctx = pieCanvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const S   = 160;
  pieCanvas.width  = S * dpr; pieCanvas.height = S * dpr;
  pieCanvas.style.width = S + 'px'; pieCanvas.style.height = S + 'px';
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, S, S);

  const cx = S / 2, cy = S / 2, r = 64, ir = 36;
  let angle = -Math.PI / 2;
  for (const d of pieData) {
    const slice = (d.n / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = genreColors[d.g] || '#5a585e';
    ctx.fill();
    angle += slice;
  }
  // 도넛 구멍
  ctx.beginPath();
  ctx.arc(cx, cy, ir, 0, Math.PI * 2);
  ctx.fillStyle = '#17171a';
  ctx.fill();
  // 가운데 총 권수
  ctx.fillStyle = '#f0ede8';
  ctx.font = `bold 18px DM Mono, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(total + '권', cx, cy);

  // 범례
  legend.innerHTML = pieData.map(d => {
    const pct = Math.round(d.n / total * 100);
    return `<div style="display:flex;align-items:center;gap:8px;">
      <div style="width:10px;height:10px;border-radius:2px;background:${genreColors[d.g]};flex-shrink:0"></div>
      <span class="genre-badge ${d.g}" style="font-size:10px">${d.g}</span>
      <span style="font-family:var(--mono);font-size:12px;color:var(--text1);margin-left:auto">${d.n}권 <span style="color:var(--text3)">${pct}%</span></span>
    </div>`;
  }).join('');

  return genreColors;
}

// ── 월별 완독 바차트 ──
export function drawMonthlyBar(books) {
  const done      = books.filter(b => b.status === 'done' && b.ratedAt);
  const monthlyEl  = document.getElementById('monthly-bar');
  const monthEmpty = document.getElementById('monthly-empty');

  if (!done.length) {
    monthlyEl.style.display  = 'none';
    monthEmpty.style.display = 'block';
    return;
  }

  monthlyEl.style.display  = 'block';
  monthEmpty.style.display = 'none';

  const counts = {};
  done.forEach(b => {
    const d   = new Date(b.ratedAt);
    const key = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}`;
    counts[key] = (counts[key] || 0) + 1;
  });
  const labels = Object.keys(counts).sort();
  const vals   = labels.map(k => counts[k]);
  const maxVal = Math.max(...vals);

  const ctx = monthlyEl.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W   = monthlyEl.parentElement.clientWidth - 48;
  const H   = 160;
  monthlyEl.width  = W * dpr; monthlyEl.height = H * dpr;
  monthlyEl.style.width = W + 'px'; monthlyEl.style.height = H + 'px';
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const pad = { t: 10, r: 10, b: 36, l: 30 };
  const cw  = W - pad.l - pad.r;
  const ch  = H - pad.t - pad.b;
  const bw  = Math.min(cw / labels.length * 0.6, 40);
  const gap = cw / labels.length;

  // 가로 격자
  ctx.strokeStyle = '#2a2a32'; ctx.lineWidth = 1;
  for (let i = 0; i <= maxVal; i++) {
    const y = pad.t + ch * (1 - i / maxVal);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cw, y); ctx.stroke();
    ctx.fillStyle = '#5a585e'; ctx.font = '9px DM Mono, monospace'; ctx.textAlign = 'right';
    ctx.fillText(i, pad.l - 4, y + 3);
  }

  // 바
  labels.forEach((label, i) => {
    const x  = pad.l + gap * i + gap / 2 - bw / 2;
    const bh = ch * (vals[i] / maxVal);
    const y  = pad.t + ch - bh;
    ctx.fillStyle = '#c8b89a';
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, [4, 4, 0, 0]);
    ctx.fill();
    // 값
    ctx.fillStyle = '#f0ede8'; ctx.font = 'bold 11px DM Mono, monospace'; ctx.textAlign = 'center';
    ctx.fillText(vals[i] + '권', x + bw / 2, y - 5);
    // 월 레이블
    ctx.fillStyle = '#5a585e'; ctx.font = '9px DM Mono, monospace';
    ctx.fillText(label, x + bw / 2, H - pad.b + 14);
  });
}
