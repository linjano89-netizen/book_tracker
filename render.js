// ══════════════════════════════════════════
// render.js — 책 카드, 대시보드, 도서목록 렌더
// ══════════════════════════════════════════

import { books, currentFilter } from './data.js';
import { drawCalibChart } from './charts.js';

// ── 유틸 ──
export function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

// ── 책 카드 HTML ──
export function buildBookHTML(b, num) {
  const statusLabel = { wishlist: '읽고 싶다', reading: '읽는 중', done: '완독' }[b.status] || b.status;
  const ratingHTML  = b.rating
    ? `<span style="font-family:var(--mono);font-size:12px;color:var(--yellow);font-weight:500">${b.rating}%</span> <span style="font-family:var(--mono);font-size:10px;color:var(--text3)">만족도</span>`
    : `<span style="font-family:var(--mono);font-size:11px;color:var(--text3)">평점 없음</span>`;

  const rateBtn = b.rating
    ? `<button class="action-btn rate" onclick="App.openRateModal(${b.id})">평점 수정</button>`
    : `<button class="action-btn rate" onclick="App.openRateModal(${b.id})">평점 입력</button>`;

  const numLabel = num != null
    ? `<span style="font-family:var(--mono);font-size:10px;color:var(--text3);display:block;margin-bottom:2px">#${num}</span>`
    : '';

  return `
    <div class="book-item ${b.status}" id="bi-${b.id}">
      <div class="book-expect">
        ${numLabel}
        ${b.expect}<span style="font-size:12px">%</span>
        <span class="prob-label">기대도</span>
      </div>
      <div class="book-body">
        <div class="book-title">${escHtml(b.title)}</div>
        ${b.author ? `<div class="book-author">${escHtml(b.author)}</div>` : ''}
        <div class="book-meta">
          <span class="genre-badge ${b.genre}">${b.genre}</span>
          <span class="status-badge ${b.status}">${statusLabel}</span>
          <span>${formatDate(b.createdAt)}</span>
          ${ratingHTML}
        </div>
        ${b.memo   ? `<div class="book-note">"${escHtml(b.memo)}"</div>`   : ''}
        ${b.review ? `<div class="book-note" style="color:var(--text2)">→ ${escHtml(b.review)}</div>` : ''}
      </div>
      <div class="book-actions">
        ${rateBtn}
        <button class="action-btn" onclick="App.openAddModal(${b.id})">수정</button>
        <button class="action-btn" onclick="App.deleteBook(${b.id})" style="color:var(--text3)">삭제</button>
      </div>
    </div>`;
}

// ── 도서 목록 ──
export function renderBookList() {
  const genres = ['소설','비소설','자기계발','과학기술','역사철학','기타'];
  const filtered = books.filter(b => {
    if (currentFilter === 'all') return true;
    if (['wishlist','reading','done'].includes(currentFilter)) return b.status === currentFilter;
    if (genres.includes(currentFilter)) return b.genre === currentFilter;
    return true;
  });
  const el = document.getElementById('book-list');
  el.innerHTML = filtered.length
    ? filtered.map(b => {
        const num = books.length - books.indexOf(b);
        return buildBookHTML(b, num);
      }).join('')
    : '<div class="empty-state">해당 조건의 책이 없습니다.</div>';
}

// ── 대시보드 ──
export function renderDashboard() {
  const done    = books.filter(b => b.status === 'done');
  const reading = books.filter(b => b.status === 'reading');
  const rated   = done.filter(b => b.rating !== null);

  const avgRating     = rated.length > 0 ? rated.reduce((s,b) => s + b.rating, 0) / rated.length : null;
  const avgExpect     = books.length > 0 ? books.reduce((s,b) => s + b.expect, 0) / books.length : null;
  const avgExpOfRated = rated.length > 0 ? rated.reduce((s,b) => s + b.expect, 0) / rated.length : null;
  const gap           = (avgRating !== null && avgExpOfRated !== null) ? (avgRating - avgExpOfRated) : null;

  document.getElementById('header-count').textContent = `${books.length}권`;
  document.getElementById('kpi-total').textContent    = books.length;
  document.getElementById('kpi-done').textContent     = done.length;
  document.getElementById('kpi-done-sub').textContent = `읽는 중 ${reading.length}권`;
  document.getElementById('kpi-avgrate').textContent  = avgRating  !== null ? avgRating.toFixed(1)  + '%' : '—';
  document.getElementById('kpi-avgexp').textContent   = avgExpect  !== null ? avgExpect.toFixed(0)  + '%' : '—';

  const gapEl  = document.getElementById('kpi-gap');
  const gapSub = document.getElementById('kpi-gap-sub');

  if (gap !== null && rated.length >= 3) {
    gapEl.textContent = (gap > 0 ? '+' : '') + gap.toFixed(1) + '%p';
    gapEl.className   = 'kpi-val ' + (Math.abs(gap) < 5 ? '' : gap > 0 ? 'good' : 'warn');
    gapSub.textContent = gap > 5 ? '의외로 좋은 책을 고른다' : gap < -5 ? '기대가 현실보다 높은 편' : '기대와 현실이 잘 맞는다';

    document.getElementById('gap-section').style.display = 'block';
    const pct = Math.min(Math.max((-gap + 30) / 60 * 100, 5), 95);
    document.getElementById('gap-marker').style.left = pct + '%';
    document.getElementById('gap-desc').textContent =
      `기대 ${avgExpOfRated.toFixed(1)}% → 실제 ${avgRating.toFixed(1)}% (차이 ${gap > 0 ? '+' : ''}${gap.toFixed(1)}%p)`;
    document.getElementById('gap-explain').textContent =
      gap > 20  ? '기대보다 훨씬 좋은 책을 자주 만납니다. 책 선구안이 좋은 편입니다.'
      : gap > 5  ? '기대보다 만족도가 높은 편입니다.'
      : gap < -20 ? '책에 대한 기대가 실제 만족도보다 많이 높습니다. 기대치를 낮추는 것도 방법입니다.'
      : gap < -5  ? '기대에 비해 만족도가 낮은 편입니다.'
      :             '기대와 실제 만족도가 비교적 잘 맞습니다.';
  } else {
    document.getElementById('gap-section').style.display = 'none';
    gapEl.textContent = '—';
    gapSub.textContent = `완독 ${Math.max(0, 3 - rated.length)}권 더 필요`;
  }

  const ratedWithNum = rated.map(b => ({ ...b, num: books.length - books.indexOf(b) }));
  drawCalibChart(ratedWithNum);

  // 최근 5권
  const recentEl = document.getElementById('recent-list');
  recentEl.innerHTML = books.slice(0, 5).length
    ? books.slice(0, 5).map(b => {
        const num = books.length - books.indexOf(b);
        return buildBookHTML(b, num);
      }).join('')
    : '<div class="empty-state">아직 기록이 없습니다.</div>';
}
