// ══════════════════════════════════════════
// ui.js — 탭, 모달, 필터, 빠른 입력 등 UI 제어
// ══════════════════════════════════════════
// 순환참조 방지: ui.js는 data.js만 직접 import하고
// render/stats는 index.js에서 주입한 콜백으로 호출.

import {
  books,
  rateTargetId,  setRateTargetId,
  editTargetId,  setEditTargetId,
  persist, setBooks, setCurrentFilter,
} from './data.js';

// render*/stats 함수는 index.js에서 주입
let _renderAll      = () => {};
let _renderBookList = () => {};

export function injectRenderers(renderAll, renderBookList, statFns) {
  _renderAll      = renderAll;
  _renderBookList = renderBookList;
  if (statFns) _statFns = statFns;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── 드롭다운 토글 ──
let _statFns = null;
export function toggleStatsDropdown() {
  const dd = document.getElementById('stats-dropdown');
  dd.classList.toggle('open');
}

function closeStatsDropdown() {
  document.getElementById('stats-dropdown').classList.remove('open');
}

// 외부 클릭 시 드롭다운 닫기
document.addEventListener('click', (e) => {
  const dd = document.getElementById('stats-dropdown');
  if (dd && !dd.contains(e.target)) closeStatsDropdown();
});

// ── 통계 서브패널 전환 (드롭다운 항목 클릭) ──
export function switchStatPanel(name) {
  closeStatsDropdown();

  // 탭 활성화
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-stats').classList.add('active');
  document.getElementById('stats-tab-btn').classList.add('active');

  // 드롭다운 아이템 활성 표시
  document.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
  const items = document.querySelectorAll('.dropdown-item');
  if (name === 'stats1') items[0].classList.add('active');
  if (name === 'stats2') items[1].classList.add('active');

  // 헤더 레이블
  const labels = { stats1: '📊 통계 1', stats2: '📈 통계 2' };
  document.getElementById('stat-panel-label').textContent = labels[name] || '';

  // 서브패널 표시
  document.getElementById('subpanel-stats1').style.display = name === 'stats1' ? 'block' : 'none';
  document.getElementById('subpanel-stats2').style.display = name === 'stats2' ? 'block' : 'none';

  if (_statFns) {
    if (name === 'stats1') _statFns.renderStats();
    if (name === 'stats2') _statFns.renderStats2();
  }
}

// ── 탭 전환 ──
export function switchTab(name, fns) {
  _statFns = fns;
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  closeStatsDropdown();

  // 모바일 서브탭: stats일 때만 표시
  const mobileSubtabs = document.getElementById('mobile-stat-subtabs');
  if (name === 'stats') {
    mobileSubtabs.classList.add('visible');
  } else {
    mobileSubtabs.classList.remove('visible');
  }

  document.getElementById('panel-' + name).classList.add('active');
  // 탭 버튼: dashboard=0, books=1, stats dropdown btn
  const tabs = document.querySelectorAll('.tabs .tab');
  if (name === 'dashboard') tabs[0].classList.add('active');
  if (name === 'books')     tabs[1].classList.add('active');
  if (name === 'stats')     {
    document.getElementById('stats-tab-btn').classList.add('active');
    // 기본 stats1 표시
    switchStatPanel('stats1');
    return;
  }
  if (name === 'dashboard') fns.renderDashboard();
  if (name === 'books')     fns.renderBookList();
}

// ── 책 추가 / 수정 모달 ──
export function openAddModal(id = null) {
  setEditTargetId(id);
  if (id) {
    const b = books.find(x => x.id === Number(id));
    if (!b) return;
    document.getElementById('add-modal-title').textContent = '책 수정';
    document.getElementById('f-title').value  = b.title;
    document.getElementById('f-author').value = b.author || '';
    document.getElementById('f-genre').value  = b.genre;
    document.getElementById('f-expect').value = b.expect;
    document.getElementById('f-status').value = b.status;
    document.getElementById('f-memo').value   = b.memo || '';
  } else {
    document.getElementById('add-modal-title').textContent = '책 추가';
    document.getElementById('f-title').value  = '';
    document.getElementById('f-author').value = '';
    document.getElementById('f-genre').value  = '자기계발';
    document.getElementById('f-expect').value = 50;
    document.getElementById('f-status').value = 'wishlist';
    document.getElementById('f-memo').value   = '';
    document.querySelectorAll('#add-modal .quick-btn').forEach(b => b.classList.remove('active'));
  }
  document.getElementById('add-modal').classList.add('open');
  setTimeout(() => document.getElementById('f-title').focus(), 100);
}

export function closeAddModal() {
  document.getElementById('add-modal').classList.remove('open');
  setEditTargetId(null);
}

export function saveBook() {
  const title = document.getElementById('f-title').value.trim();
  if (!title) { alert('제목을 입력해주세요.'); return; }
  if (editTargetId) {
    const idx = books.findIndex(x => x.id === Number(editTargetId));
    if (idx >= 0) {
      books[idx].title  = title;
      books[idx].author = document.getElementById('f-author').value.trim();
      books[idx].genre  = document.getElementById('f-genre').value;
      books[idx].expect = parseInt(document.getElementById('f-expect').value) || 50;
      books[idx].status = document.getElementById('f-status').value;
      books[idx].memo   = document.getElementById('f-memo').value.trim();
    }
  } else {
    books.unshift({
      id:        Date.now(),
      title,
      author:    document.getElementById('f-author').value.trim(),
      genre:     document.getElementById('f-genre').value,
      expect:    parseInt(document.getElementById('f-expect').value) || 50,
      status:    document.getElementById('f-status').value,
      memo:      document.getElementById('f-memo').value.trim(),
      rating:    null,
      review:    '',
      createdAt: new Date().toISOString(),
      ratedAt:   null,
    });
  }
  persist();
  closeAddModal();
  _renderAll();
}

// ── 평점 모달 ──
export function openRateModal(id) {
  const b = books.find(x => x.id === Number(id));
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

export function closeRateModal() {
  document.getElementById('rate-modal').classList.remove('open');
  setRateTargetId(null);
}

export function submitRate() {
  const val = parseInt(document.getElementById('f-rating').value);
  if (!val || val < 1 || val > 100) { alert('만족도를 입력해주세요. (1~100%)'); return; }
  const idx = books.findIndex(x => x.id === rateTargetId);
  if (idx < 0) return;
  books[idx].rating  = val;
  books[idx].review  = document.getElementById('rate-review').value.trim();
  books[idx].status  = 'done';
  books[idx].ratedAt = new Date().toISOString();
  persist();
  closeRateModal();
  _renderAll();
}

// ── 삭제 ──
export function deleteBook(id) {
  if (!confirm('이 책을 삭제할까요?')) return;
  setBooks(books.filter(x => x.id !== Number(id)));
  persist();
  _renderAll();
}

// ── 필터 ──
export function setFilter(f, btn) {
  setCurrentFilter(f);
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _renderBookList();
}

// ── 빠른 입력 (기대도) ──
export function setExpect(val) {
  document.getElementById('f-expect').value = val;
  document.querySelectorAll('#add-modal .quick-btn').forEach(b => {
    b.classList.toggle('active', b.textContent === val + '%');
  });
}
export function clampExpect(el) {
  let v = parseInt(el.value);
  if (isNaN(v)) return;
  if (v < 1)   el.value = 1;
  if (v > 100) el.value = 100;
  document.querySelectorAll('#add-modal .quick-btn').forEach(b => {
    b.classList.toggle('active', b.textContent === el.value + '%');
  });
}

// ── 빠른 입력 (평점) ──
export function setRating(val) {
  document.getElementById('f-rating').value = val;
  document.querySelectorAll('#rate-modal .quick-btn').forEach(b => {
    b.classList.toggle('active', b.textContent === val + '%');
  });
}
export function clampRating(el) {
  let v = parseInt(el.value);
  if (isNaN(v)) return;
  if (v < 1)   el.value = 1;
  if (v > 100) el.value = 100;
  document.querySelectorAll('#rate-modal .quick-btn').forEach(b => {
    b.classList.toggle('active', b.textContent === el.value + '%');
  });
}

// ── 용어집 모달 ──
export function openGlossary()  { document.getElementById('glossary-modal').classList.add('open'); }
export function closeGlossary() { document.getElementById('glossary-modal').classList.remove('open'); }
