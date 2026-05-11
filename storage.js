// ══════════════════════════════════════════
// storage.js — localStorage 저장 / 불러오기
// ══════════════════════════════════════════

const STORAGE_KEY = 'book_tracker_v1';

export function loadBooks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveBooks(books) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
  } catch (e) {
    alert('저장 실패');
  }
}
