import { useEffect, useMemo, useRef, useState } from 'react'
import type { Direction } from '../lib/types'
import {
  CATEGORY_PICKER_OPTIONS,
  EXPENSE_CATEGORIES,
  categoriesByDirection,
  deriveDirectionByCategory,
  normalizeCategory,
} from '../lib/categories'
import { CategoryPicker } from '../components/CategoryPicker'
import { budgetRulesStorageKey } from '../lib/archives'
import { datetimeLocalToIso, nowDatetimeLocalValue } from '../lib/dateLocal'

type BudgetTargetType = 'total' | 'category'
type BudgetRule = {
  id: string
  targetType: BudgetTargetType
  category?: string
  amount: number
}

function loadBudgetRules(archiveId: string): BudgetRule[] {
  try {
    const raw = localStorage.getItem(budgetRulesStorageKey(archiveId))
    if (!raw) return [{ id: 'demo-budget', targetType: 'total', amount: 5 }]
    const parsed = JSON.parse(raw) as BudgetRule[]
    if (!Array.isArray(parsed) || parsed.length === 0) return [{ id: 'demo-budget', targetType: 'total', amount: 5 }]
    return parsed
  } catch {
    return [{ id: 'demo-budget', targetType: 'total', amount: 5 }]
  }
}

export function AddPage({
  archiveId,
  onAdd,
}: {
  archiveId: string
  onAdd: (input: {
    direction: Direction
    amount: number
    category: string
    note?: string
    date?: string
  }) => Promise<void>
}) {
  const [direction, setDirection] = useState<Direction>('expense')
  const [amount, setAmount] = useState<string>('')
  const [category, setCategory] = useState<string>('餐饮')
  const [note, setNote] = useState<string>('')
  const [occurredAtLocal, setOccurredAtLocal] = useState<string>(() => nowDatetimeLocalValue())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [budgetRules, setBudgetRules] = useState<BudgetRule[]>(() => loadBudgetRules(archiveId))
  const [budgetType, setBudgetType] = useState<BudgetTargetType>('total')
  const [budgetCategory, setBudgetCategory] = useState<string>('餐饮')
  const [budgetAmount, setBudgetAmount] = useState<string>('300')
  const archiveIdRef = useRef(archiveId)
  archiveIdRef.current = archiveId

  const canSave = useMemo(() => {
    const n = Number(amount)
    return Number.isFinite(n) && n > 0
  }, [amount])

  useEffect(() => {
    setBudgetRules(loadBudgetRules(archiveId))
  }, [archiveId])

  useEffect(() => {
    localStorage.setItem(budgetRulesStorageKey(archiveIdRef.current), JSON.stringify(budgetRules))
    window.dispatchEvent(new CustomEvent('ledger:budget-updated'))
  }, [budgetRules])

  function selectCategory(next: string) {
    const nextDirection = deriveDirectionByCategory(next, direction)
    setDirection(nextDirection)
    if (nextDirection === 'income') {
      setCategory(normalizeCategory('income', next))
      return
    }
    setCategory(normalizeCategory('expense', next))
  }

  function addBudgetRule() {
    const n = Number(budgetAmount)
    if (!Number.isFinite(n) || n <= 0) return
    const next: BudgetRule = {
      id: `b-${Date.now()}`,
      targetType: budgetType,
      category: budgetType === 'category' ? budgetCategory : undefined,
      amount: n,
    }
    setBudgetRules((prev) => [...prev, next])
  }

  async function submit() {
    if (!canSave) return
    await onAdd({
      direction,
      amount: Number(amount),
      category: normalizeCategory(direction, category),
      note: note.trim() || undefined,
      date: datetimeLocalToIso(occurredAtLocal),
    })
    setAmount('')
    setNote('')
    setOccurredAtLocal(nowDatetimeLocalValue())
  }

  return (
    <section className="card addPageCard">
      <div className="cardTitle addPageTitle">记账</div>
      <div className="grid addPageGrid">
        <div className="field">
          <label>类型</label>
          <select
            value={direction}
            onChange={(e) => {
              const nextDirection = e.target.value as Direction
              setDirection(nextDirection)
              setCategory(categoriesByDirection(nextDirection)[0] ?? '')
            }}
          >
            <option value="expense">支出</option>
            <option value="income">收入</option>
          </select>
        </div>
        <div className="field">
          <label>分类</label>
          <button type="button" className="pickerTrigger" onClick={() => setPickerOpen(true)}>
            {category}
          </button>
        </div>
        <div className="field">
          <label>金额</label>
          <input inputMode="decimal" placeholder="输入金额，如 28.8" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="field fieldWide">
          <label>发生时间</label>
          <input type="datetime-local" value={occurredAtLocal} onChange={(e) => setOccurredAtLocal(e.target.value)} />
        </div>
        <div className="field fieldWide">
          <label>备注</label>
          <input placeholder="补充说明（可选）" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <button className="btnPrimary" disabled={!canSave} onClick={submit}>
        保存记账
      </button>

      <section className="budgetBlock">
        <div className="cardTitle">预算设置</div>
        <div className="grid addPageGrid">
          <div className="field">
            <label>预算对象</label>
            <select value={budgetType} onChange={(e) => setBudgetType(e.target.value as BudgetTargetType)}>
              <option value="total">总支出</option>
              <option value="category">单类目</option>
            </select>
          </div>
          {budgetType === 'category' ? (
            <div className="field">
              <label>类目</label>
              <select value={budgetCategory} onChange={(e) => setBudgetCategory(e.target.value)}>
                {EXPENSE_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="field">
            <label>预算金额</label>
            <input value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} inputMode="decimal" />
          </div>
        </div>
        <button className="btn" onClick={addBudgetRule}>
          添加预算
        </button>
        <div className="budgetList">
          {budgetRules.map((rule) => (
            <div key={rule.id} className="budgetItem">
              <span>
                {rule.targetType === 'total' ? '总支出' : `${rule.category ?? '类目'}支出`}：{rule.amount.toFixed(2)} / 月
              </span>
              <button className="btn budgetDeleteBtn" onClick={() => setBudgetRules((prev) => prev.filter((x) => x.id !== rule.id))}>
                删除
              </button>
            </div>
          ))}
        </div>
      </section>
      <CategoryPicker
        open={pickerOpen}
        title="选择标签"
        options={CATEGORY_PICKER_OPTIONS}
        value={category}
        onChange={selectCategory}
        onClose={() => setPickerOpen(false)}
      />
    </section>
  )
}

