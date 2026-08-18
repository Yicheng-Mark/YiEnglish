/**
 * IndexedDB wrapper for LingoForge
 * 数据库：lingoforge v2
 * Stores: errorBook, reviewCards, progress, readingWords, corpusWords, favoriteWords, errorDetails
 */

let dbPromise = null

const ALL_STORES = [
  { name: 'errorBook', keyPath: 'name' },
  { name: 'reviewCards', keyPath: 'wordName' },
  { name: 'progress', keyPath: 'dictChapter' },
  { name: 'readingWords', keyPath: 'name' },
  { name: 'corpusWords', keyPath: 'name' },
  { name: 'favoriteWords', keyPath: 'name' },
  { name: 'errorDetails', keyPath: 'id', autoIncrement: true },
]

/**
 * 获取 IDB 实例（单例）
 */
export function getIDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('lingoforge', 2)
      req.onupgradeneeded = (e) => {
        const db = e.target.result
        const oldVersion = e.oldVersion

        // 全新安装（oldVersion === 0）：创建所有 store
        if (oldVersion === 0) {
          ALL_STORES.forEach((s) => {
            if (!db.objectStoreNames.contains(s.name)) {
              const store = db.createObjectStore(s.name, {
                keyPath: s.keyPath,
                autoIncrement: s.autoIncrement,
              })
              if (s.name === 'errorDetails') {
                store.createIndex('timestamp', 'timestamp')
              }
            }
          })
        } else {
          // 从旧版本升级：只创建可能缺失的 store
          ALL_STORES.forEach((s) => {
            if (!db.objectStoreNames.contains(s.name)) {
              const store = db.createObjectStore(s.name, {
                keyPath: s.keyPath,
                autoIncrement: s.autoIncrement,
              })
              if (s.name === 'errorDetails') {
                store.createIndex('timestamp', 'timestamp')
              }
            }
          })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    // Safari 隐私模式等场景 open 会直接失败；失败后必须清掉缓存，
    // 否则 rejected promise 被永久缓存，整个会话的所有 IDB 操作都会失败
    dbPromise.catch(() => {
      dbPromise = null
    })
  }
  return dbPromise
}

// ===== CRUD =====

export async function idbGet(storeName, key) {
  const db = await getIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function idbGetAll(storeName) {
  const db = await getIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function idbPut(storeName, value) {
  const db = await getIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    tx.objectStore(storeName).put(value)
    // 等事务提交完成才算写入成功：req.onsuccess 时事务仍可能被后续中止
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error(`IDB transaction aborted: ${storeName}`))
  })
}

export async function idbDelete(storeName, key) {
  const db = await getIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    tx.objectStore(storeName).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error(`IDB transaction aborted: ${storeName}`))
  })
}

export async function idbClear(storeName) {
  const db = await getIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    tx.objectStore(storeName).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error(`IDB transaction aborted: ${storeName}`))
  })
}

/**
 * 批量写入（迁移 & 服务器同步用）
 */
export async function idbBulkPut(storeName, values) {
  if (!values.length) return
  const db = await getIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    for (const v of values) {
      store.put(v)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    // commit 阶段的中止（如配额满 QuotaExceededError）只触发 onabort 不触发 onerror，
    // 缺失该回调会让 promise 永不 settle，整条 await 链挂死
    tx.onabort = () => reject(tx.error || new Error(`IDB transaction aborted: ${storeName}`))
  })
}

// ===== 迁移 =====

const MIGRATION_MAP = {
  typingword_wrong: {
    store: 'errorBook',
    transform: (data) => data.words || [],
  },
  lingoforge_review_cards: {
    store: 'reviewCards',
    transform: (data) => Object.values(data.cards || {}),
  },
  lf_progress: {
    store: 'progress',
    transform: (data) => Object.entries(data).map(([key, words]) => ({ dictChapter: key, words })),
  },
  lingoforge_reading_words: {
    store: 'readingWords',
    transform: (data) => data.words || [],
  },
  lingoforge_corpus_words: {
    store: 'corpusWords',
    transform: (data) => data.words || [],
  },
  lingoforge_favorite_words: {
    store: 'favoriteWords',
    transform: (data) => data.words || [],
  },
}

/**
 * localStorage → IndexedDB 渐进式迁移
 * - 不删除 localStorage 原始 key（留作 sync fallback）
 * - 每个 key 有独立的 _migrated 标记
 * - 已迁移的 key 跳过
 */
export async function migrateFromLocalStorage() {
  for (const [lsKey, config] of Object.entries(MIGRATION_MAP)) {
    const migratedFlag = lsKey + '_migrated'
    if (localStorage.getItem(migratedFlag) === '1') continue

    const raw = localStorage.getItem(lsKey)
    if (!raw) {
      localStorage.setItem(migratedFlag, '1')
      continue
    }

    try {
      const data = JSON.parse(raw)
      const items = config.transform(data)
      if (items.length > 0) {
        await idbBulkPut(config.store, items)
      }
      localStorage.setItem(migratedFlag, '1')
    } catch (e) {
      console.warn(`[IDB] Migration failed for ${lsKey}:`, e)
    }
  }
}
