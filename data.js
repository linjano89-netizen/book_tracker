// ══════════════════════════════════════════
// data.js — 앱 전역 상태 및 import / export
// ══════════════════════════════════════════

import { loadBooks, saveBooks } from './storage.js';

// ── 전역 상태 ──
export let books         = loadBooks();
export let currentFilter = 'all';
export let rateTargetId  = null;
export let editTargetId  = null;

// 상태 세터 (외부에서 변경할 때 사용)
export function setBooks(arr)          { books         = arr; }
export function setCurrentFilter(f)    { currentFilter = f; }
export function setRateTargetId(id)    { rateTargetId  = id; }
export function setEditTargetId(id)    { editTargetId  = id; }

// 저장 편의 래퍼
export function persist() { saveBooks(books); }
