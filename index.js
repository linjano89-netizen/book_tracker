// ══════════════════════════════════════════
// index.js — 진입점: 모든 모듈을 연결하고 App 전역 노출
// ══════════════════════════════════════════

import { renderDashboard, renderBookList, setCalibFilter } from './render.js';
import { renderStats, renderStats2, switchStatTab } from './stats.js';
import {
  switchTab, openAddModal, closeAddModal, saveBook,
  openRateModal, closeRateModal, submitRate,
  deleteBook, setFilter, setExpect, clampExpect,
  setRating, clampRating, openGlossary, closeGlossary,
  injectRenderers, toggleStatsDropdown, switchStatPanel,
} from './ui.js';

// ── 렌더 함수 주입 (ui.js 순환참조 방지) ──
function renderAll() {
  const active = document.querySelector('.panel.active');
  if (active?.id === 'panel-dashboard') renderDashboard();
  if (active?.id === 'panel-books')     renderBookList();
  if (active?.id === 'panel-stats')     renderStats();
}
injectRenderers(renderAll, renderBookList);

// ── 탭 전환 래퍼 (fns 번들 전달) ──
const tabFns = { renderDashboard, renderBookList, renderStats, switchStatTab };

// ── 전역 App 객체 (인라인 onclick에서 호출) ──
window.App = {
  switchTab:           (name) => switchTab(name, tabFns),
  switchStatTab:       (name) => { switchStatTab(name); },
  switchStatPanel:     (name) => switchStatPanel(name),
  toggleStatsDropdown: toggleStatsDropdown,
  openAddModal,
  closeAddModal,
  saveBook,
  openRateModal,
  closeRateModal,
  submitRate,
  deleteBook,
  setFilter,
  setExpect,
  clampExpect,
  setRating,
  clampRating,
  openGlossary,
  closeGlossary,
  setCalibFilter,
};

// ── 모달 외부 클릭 닫기 ──
document.getElementById('add-modal').addEventListener('click',
  function(e) { if (e.target === this) closeAddModal(); });
document.getElementById('rate-modal').addEventListener('click',
  function(e) { if (e.target === this) closeRateModal(); });
document.getElementById('glossary-modal').addEventListener('click',
  function(e) { if (e.target === this) closeGlossary(); });

// ── 초기 렌더 ──
renderDashboard();
