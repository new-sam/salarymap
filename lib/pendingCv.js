/* ──────── IndexedDB utils for pending CV blob ────────
   Stores the chosen file across OAuth redirect so user doesn't re-pick it.
   sessionStorage can't hold blobs reliably (size + serialization).
   /cv 와 /jobs/[id] 지원 폼이 공유한다. */
const IDB_NAME = 'fyi-cv'
const IDB_STORE = 'pending'
const IDB_KEY = 'cv-blob'

function openIdb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no-idb'))
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
export async function idbPutCv(file) {
  try {
    const db = await openIdb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put({ name: file.name, type: file.type, blob: file }, IDB_KEY)
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); reject(tx.error) }
    })
  } catch { /* IDB unavailable — fallback to sessionStorage name hint */ }
}
export async function idbGetCv() {
  try {
    const db = await openIdb()
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY)
      req.onsuccess = () => { db.close(); resolve(req.result || null) }
      req.onerror = () => { db.close(); resolve(null) }
    })
  } catch { return null }
}
export async function idbClearCv() {
  try {
    const db = await openIdb()
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).delete(IDB_KEY)
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); resolve() }
    })
  } catch {}
}
