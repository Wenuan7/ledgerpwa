import { openDB, type DBSchema } from 'idb'
import { getActiveArchiveId, getDbNameForArchive } from './archives'
import type { Category, CategoryBudget, Tag, Transaction } from './types'
import { newId, nowIso } from './id'

type StoreName = 'transactions' | 'categories' | 'tags' | 'categoryBudgets'

interface LedgerDB extends DBSchema {
  transactions: {
    key: string
    value: Transaction
    indexes: { 'by-date': string }
  }
  categories: { key: string; value: Category }
  tags: { key: string; value: Tag }
  categoryBudgets: {
    key: string
    value: CategoryBudget
    indexes: { 'by-yearMonth': string; 'by-categoryId': string }
  }
}

const DB_VERSION = 1

async function getDbByArchiveId(archiveId: string) {
  const name = getDbNameForArchive(archiveId)
  return openDB<LedgerDB>(name, DB_VERSION, {
    upgrade(db) {
      const tx = db.createObjectStore('transactions', { keyPath: 'id' })
      tx.createIndex('by-date', 'date')

      db.createObjectStore('categories', { keyPath: 'id' })
      db.createObjectStore('tags', { keyPath: 'id' })

      const b = db.createObjectStore('categoryBudgets', { keyPath: 'id' })
      b.createIndex('by-yearMonth', 'yearMonth')
      b.createIndex('by-categoryId', 'categoryId')
    },
  })
}

async function getDb() {
  return getDbByArchiveId(getActiveArchiveId())
}

export async function ensureSeedData() {
  const db = await getDb()
  const existing = await db.count('categories')
  if (existing > 0) return

  const now = nowIso()
  const seed: Array<Pick<Category, 'name' | 'directionDefault'>> = [
    { name: '餐饮', directionDefault: 'expense' },
    { name: '购物', directionDefault: 'expense' },
    { name: '交通', directionDefault: 'expense' },
    { name: '娱乐', directionDefault: 'expense' },
    { name: '医疗', directionDefault: 'expense' },
    { name: '运动', directionDefault: 'expense' },
    { name: '旅行', directionDefault: 'expense' },
    { name: '工作', directionDefault: 'expense' },
    { name: '其他', directionDefault: 'expense' },
    { name: '工资', directionDefault: 'income' },
    { name: '其他', directionDefault: 'income' },
  ]

  const tx = db.transaction('categories', 'readwrite')
  for (const c of seed) {
    const item: Category = {
      id: newId('cat'),
      name: c.name,
      directionDefault: c.directionDefault,
      keywords: [],
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    }
    tx.store.put(item)
  }
  await tx.done
}

export type NewTransactionInput = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>

export async function addTransaction(input: NewTransactionInput) {
  const db = await getDb()
  const now = nowIso()
  const t: Transaction = {
    ...input,
    id: newId('tx'),
    createdAt: now,
    updatedAt: now,
  }
  await db.put('transactions', t)
  return t
}

export async function updateTransaction(input: Transaction) {
  const db = await getDb()
  const next: Transaction = {
    ...input,
    updatedAt: nowIso(),
  }
  await db.put('transactions', next)
  return next
}

export async function deleteTransaction(id: string) {
  const db = await getDb()
  await db.delete('transactions', id)
}

export async function listRecentTransactions(limit: number) {
  const db = await getDb()
  const all = await db.getAll('transactions')
  all.sort((a, b) => b.date.localeCompare(a.date))
  return all.slice(0, limit)
}

export async function countTransactions() {
  const db = await getDb()
  return db.count('transactions')
}

export async function clearTransactionsForArchive(archiveId: string) {
  const db = await getDbByArchiveId(archiveId)
  await db.clear('transactions')
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randChoice<T>(arr: T[]) {
  return arr[randInt(0, arr.length - 1)]!
}

async function generateSampleTransactionsForLast3Days() {
  const templates = [
    { category: '交通', notes: ['打车去上海', '地铁通勤', '公交', '高速费'] },
    { category: '餐饮', notes: ['午饭盖浇饭', '咖啡', '晚饭火锅', '水果'] },
    { category: '购物', notes: ['日用品', '衣服', '手机壳', '书'] },
    { category: '娱乐', notes: ['电影', '游戏', '会员订阅'] },
    { category: '医疗', notes: ['药店', '门诊', '检查'] },
    { category: '运动', notes: ['健身房', '羽毛球', '跑步装备'] },
    { category: '旅行', notes: ['机票', '酒店', '景区门票'] },
    { category: '工作', notes: ['办公用品', '打印材料', '差旅打车'] },
    { category: '其他', notes: ['杂项'] },
  ] as const

  const now = new Date()
  const all: NewTransactionInput[] = []

  for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
    const count = randInt(4, 9)
    for (let i = 0; i < count; i++) {
      const tpl = randChoice([...templates])
      const direction: Transaction['direction'] = Math.random() < 0.12 ? 'income' : 'expense'
      const amount =
        direction === 'income'
          ? Number((randInt(20, 600) + Math.random()).toFixed(2))
          : Number((randInt(5, 180) + Math.random()).toFixed(2))

      const d = new Date(now)
      d.setDate(now.getDate() - dayOffset)
      d.setHours(randInt(8, 23), randInt(0, 59), randInt(0, 59), 0)

      all.push({
        direction,
        amount,
        category: direction === 'income' ? randChoice(['工资', '其他']) : tpl.category,
        note: randChoice(direction === 'income' ? ['工资', '退款', '兼职收入'] : [...tpl.notes]),
        date: d.toISOString(),
        rawInput: 'sample',
        tags: [],
      })
    }
  }

  // bulk insert via single transaction for speed
  const db = await getDb()
  const tx = db.transaction('transactions', 'readwrite')
  const nowIsoStr = nowIso()
  for (const input of all) {
    const t: Transaction = {
      ...input,
      id: newId('tx'),
      createdAt: nowIsoStr,
      updatedAt: nowIsoStr,
    }
    tx.store.put(t)
  }
  await tx.done
}

export async function ensureSampleTransactionsIfEmpty() {
  if (getActiveArchiveId() !== 'default') return
  const db = await getDb()
  const count = await db.count('transactions')
  if (count > 0) return
  await generateSampleTransactionsForLast3Days()
}

export async function clearStore(store: StoreName) {
  const db = await getDb()
  await db.clear(store)
}

export async function bulkPut<T extends StoreName>(store: T, items: Array<LedgerDB[T]['value']>) {
  const db = await getDb()
  const tx = db.transaction(store, 'readwrite')
  for (const item of items) tx.store.put(item as any)
  await tx.done
}

export async function dumpAll() {
  const db = await getDb()
  const [transactions, categories, tags, categoryBudgets] = await Promise.all([
    db.getAll('transactions'),
    db.getAll('categories'),
    db.getAll('tags'),
    db.getAll('categoryBudgets'),
  ])
  return { transactions, categories, tags, categoryBudgets }
}

