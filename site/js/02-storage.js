/* ---------------- storage (IndexedDB) ---------------- */
const DB = {
  db: null,
  open() {
    return new Promise((res) => {
      try {
        const r = indexedDB.open('mi-babayit', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => { this.db = r.result; res(true); };
        r.onerror = () => res(false);
      } catch (e) { res(false); }
    });
  },
  get(k) {
    return new Promise((res) => {
      if (!this.db) return res(null);
      try { const q = this.db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }
      catch (e) { res(null); }
    });
  },
  set(k, v) {
    if (!this.db) return;
    try { this.db.transaction('kv', 'readwrite').objectStore('kv').put(v, k); } catch (e) {}
  },
};
let saveTimer = null;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(() => DB.set('state-v3', S), 400); }

