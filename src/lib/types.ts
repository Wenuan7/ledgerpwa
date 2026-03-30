export type Direction = 'expense' | 'income'

export type Transaction = {
  id: string
  direction: Direction
  amount: number
  date: string // ISO
  category: string
  note?: string
  tags: string[]
  rawInput?: string
  createdAt: string
  updatedAt: string
}

export type Category = {
  id: string
  name: string
  directionDefault: Direction
  keywords: string[]
  isSystem: boolean
  createdAt: string
  updatedAt: string
}

export type Tag = {
  id: string
  name: string
  keywords: string[]
  isSystem: boolean
  createdAt: string
  updatedAt: string
}

export type BudgetRepeatPolicy = 'oncePerThreshold' | 'repeatAlways'

export type CategoryBudget = {
  id: string
  categoryId: string
  yearMonth: string // YYYY-MM
  amount: number
  thresholds: number[] // 0..1 (e.g. 0.5, 0.8, 1.0)
  repeatPolicy: BudgetRepeatPolicy
  lastTriggeredThreshold?: number
  createdAt: string
  updatedAt: string
}

export type BackupJsonV1 = {
  version: 1
  exportedAt: string
  app: 'LedgerPWA'
  data: {
    transactions: Transaction[]
    categories: Category[]
    tags: Tag[]
    categoryBudgets: CategoryBudget[]
  }
}

