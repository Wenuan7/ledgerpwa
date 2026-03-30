import type { Direction } from './types'

export const EXPENSE_CATEGORIES = ['餐饮', '购物', '交通', '娱乐', '医疗', '运动', '旅行', '工作', '其他'] as const
export const INCOME_CATEGORIES = ['工资', '其他'] as const
export const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES] as const
export const CATEGORY_PICKER_OPTIONS = [
  '餐饮',
  '购物',
  '交通',
  '娱乐',
  '医疗',
  '运动',
  '旅行',
  '工作',
  '其他',
  '工资',
] as const

export const CATEGORY_ICON: Record<string, string> = {
  餐饮: '🍜',
  购物: '🛍️',
  交通: '🚗',
  娱乐: '🎮',
  医疗: '💊',
  运动: '🏃',
  旅行: '🧳',
  工作: '💼',
  其他: '🗂️',
  工资: '💰',
}

export function categoriesByDirection(direction: Direction): readonly string[] {
  return direction === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
}

export function normalizeCategory(direction: Direction, input: string): string {
  const list = categoriesByDirection(direction)
  return list.includes(input as any) ? input : list[0]
}

export function deriveDirectionByCategory(category: string, fallback: Direction): Direction {
  if (INCOME_CATEGORIES.includes(category as any)) return 'income'
  if (EXPENSE_CATEGORIES.includes(category as any)) return 'expense'
  return fallback
}

