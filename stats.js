// ══════════════════════════════════════════
// stats.js — 통계1, 통계2 렌더
// ══════════════════════════════════════════

import { books } from './data.js';
import { drawGenrePie, drawMonthlyBar } from './charts.js';
import { escHtml } from './render.js';

const GENRES = ['소설','비소설','자기계발','과학기술','역사철학','기타'];

// ── 통계 서브탭 전환 ──
export function switchStatTab(name) {
  document.getElementById('subpanel-stats1').style.display = name === 'stats1' ? 'block' : 'none';
  document.getElementById('subpanel-stats2').style.display = name === 'stats2' ? 'block' : 'none';
  document.getElementById('subtab-stats1').classList.toggle('active', name === 'stats1');
  document.getElementById('subtab-stats2').classList.toggle('active', name === 'stats2');
  if (name === 'stats2') renderStats2();
}

// ── 통계 1 ──
export function renderStats() {
  drawGenrePie(books);
  _renderGenreTable();
  _renderExpBucketTable();
}

function _renderGenreTable() {
  const tbody = document.getElementById('genre-stat-body');
  const rows  = [];

  for (const g of GENRES) {
    const inG   = books.filter(b => b.genre === g);
    if (!inG.length) continue;
    const rated  = inG.filter(b => b.rating !== null);
    const avgExp = inG.reduce((s,b) => s + b.expect, 0) / inG.length;
    const avgRat = rated.length > 0 ? rated.reduce((s,b) => s + b.rating, 0) / rated.length : null;
    const gap    = avgRat !== null ? (avgRat - avgExp) : null;
    const gapStr = gap !== null
      ? `<span style="color:${Math.abs(gap)<5?'var(--text2)':gap>0?'var(--blue)':'var(--yellow)'}">${gap>0?'+':''}${gap.toFixed(1)}%p</span>`
      : '—';
    rows.push(`<tr>
      <td><span class="genre-badge ${g}">${g}</span></td>
      <td class="val">${inG.length}권 <span style="color:var(--text3);font-size:10px">(평점 ${rated.length})</span></td>
      <td class="val">${avgExp.toFixed(0)}%</td>
      <td class="val">${avgRat !== null ? avgRat.toFixed(1) + '%' : '—'}</td>
      <td>${gapStr}</td>
    </tr>`);
  }

  tbody.innerHTML = rows.length
    ? rows.join('')
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
  const rated = books.filter(b => b.rating !== null);
  const pbody = document.getElementById('exp-stat-body');
  const prows = [];

  for (const bk of buckets) {
    const inB = rated.filter(r => r.expect >= bk.min && r.expect < bk.max);
    if (!inB.length) continue;
    const avgRat = inB.reduce((s,b) => s + b.rating, 0) / inB.length;
    const midExp = (bk.min + bk.max) / 2;
    const gap    = avgRat - midExp;
    const gapStr = `<span style="color:${Math.abs(gap)<5?'var(--text2)':gap>0?'var(--blue)':'var(--yellow)'}">${gap>0?'+':''}${gap.toFixed(1)}%p</span>`;
    prows.push(`<tr>
      <td class="val">${bk.label}</td>
      <td class="val">${inB.length}</td>
      <td class="val">${avgRat.toFixed(1)}%</td>
      <td>${gapStr}</td>
    </tr>`);
  }

  pbody.innerHTML = prows.length
    ? prows.join('')
    : '<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:20px;font-family:var(--mono);font-size:12px;">데이터 없음</td></tr>';
}

// ── 통계 2 ──
export function renderStats2() {
  const rated = books.filter(b => b.rating !== null);

  // TOP 3 좋았던 / 실망한 책
  const withGap = rated.map(b => ({ ...b, gap: b.rating - b.expect, num: books.length - books.indexOf(b) }));
  const topGood = [...withGap].sort((a,b) => b.gap - a.gap).slice(0, 3);
  const topBad  = [...withGap].sort((a,b) => a.gap - b.gap).slice(0, 3);

  const topHTML = (list) => list.length
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
            <span style="font-family:var(--mono);font-size:12px;color:${b.gap>=0?'var(--green)':'var(--red)'};font-weight:500">${b.gap>0?'+':''}${b.gap}%p</span>
          </div>
        </div>
      </div>`).join('')
    : '<div class="empty-state" style="padding:30px">완독한 책이 3권 이상이면 표시됩니다</div>';

  document.getElementById('top-good').innerHTML = topHTML(topGood);
  document.getElementById('top-bad').innerHTML  = topHTML(topBad);

  // 월별 완독 바차트
  drawMonthlyBar(books);

  // 완독률
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
