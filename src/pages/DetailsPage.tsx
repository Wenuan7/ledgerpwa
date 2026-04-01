import { useMemo, useState } from 'react'
import type { Transaction } from '../lib/types'
import { CATEGORY_PICKER_OPTIONS, deriveDirectionByCategory, normalizeCategory } from '../lib/categories'
import { CategoryPicker } from '../components/CategoryPicker'
import { datetimeLocalToIso, isoToDatetimeLocalValue } from '../lib/dateLocal'

function dayKeyLocal(iso: string) {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDayTitle(dayKey: string) {
  const [y, m, d] = dayKey.split('-').map((x) => Number(x))
  const date = new Date(y, (m ?? 1) - 1, d ?? 1)
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function ymFromDate(iso: string) {
  const d = new Date(iso)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

export function DetailsPage({
  loading,
  transactions,
  onUpdate,
  onDelete,
}: {
  loading: boolean
  transactions: Transaction[]
  onUpdate: (tx: Transaction) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [editingAmount, setEditingAmount] = useState('')
  const [editingCategory, setEditingCategory] = useState('')
  const [editingNote, setEditingNote] = useState('')
  const [editingOccurredAt, setEditingOccurredAt] = useState('')
  const [editPickerOpen, setEditPickerOpen] = useState(false)
  const [editingDirection, setEditingDirection] = useState<Transaction['direction']>('expense')

  const yearOptions = useMemo(() => {
    const years = new Set<number>([selectedYear])
    for (const t of transactions) years.add(ymFromDate(t.date).year)
    return Array.from(years).sort((a, b) => b - a)
  }, [selectedYear, transactions])

  const filteredTransactions = useMemo(
    () =>
      transactions.filter((t) => {
        const ym = ymFromDate(t.date)
        return ym.year === selectedYear && ym.month === selectedMonth
      }),
    [selectedMonth, selectedYear, transactions],
  )

  const monthIncome = filteredTransactions
    .filter((x) => x.direction === 'income')
    .reduce((sum, x) => sum + x.amount, 0)
  const monthExpense = filteredTransactions
    .filter((x) => x.direction === 'expense')
    .reduce((sum, x) => sum + x.amount, 0)

  const groupedByDay = (() => {
    const map = new Map<string, Transaction[]>()
    for (const t of filteredTransactions) {
      const k = dayKeyLocal(t.date)
      const arr = map.get(k)
      if (arr) arr.push(t)
      else map.set(k, [t])
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([day, items]) => {
        items.sort((a, b) => b.date.localeCompare(a.date))
        const expenseTotal = items
          .filter((x) => x.direction === 'expense')
          .reduce((sum, x) => sum + x.amount, 0)
        const incomeTotal = items
          .filter((x) => x.direction === 'income')
          .reduce((sum, x) => sum + x.amount, 0)
        return { day, items, expenseTotal, incomeTotal }
      })
  })()

  function adjustYear(delta: number) {
    const idx = yearOptions.findIndex((y) => y === selectedYear)
    if (idx < 0) return
    const next = Math.max(0, Math.min(yearOptions.length - 1, idx + delta))
    setSelectedYear(yearOptions[next] ?? selectedYear)
  }

  function adjustMonth(delta: number) {
    const nextRaw = selectedMonth + delta
    const next = Math.max(1, Math.min(12, nextRaw))
    setSelectedMonth(next)
  }

  async function submitEdit() {
    if (!editing) return
    const n = Number(editingAmount)
    if (!Number.isFinite(n) || n <= 0) return
    await onUpdate({
      ...editing,
      direction: editingDirection,
      amount: n,
      category: normalizeCategory(editingDirection, editingCategory),
      note: editingNote.trim() || undefined,
      date: datetimeLocalToIso(editingOccurredAt),
    })
    setEditPickerOpen(false)
    setEditing(null)
  }

  async function removeEditing() {
    if (!editing) return
    await onDelete(editing.id)
    setEditPickerOpen(false)
    setEditing(null)
  }

  return (
    <section className="card">
      <div className="monthOverview">
        <button className="monthPickerTrigger" onClick={() => setPickerOpen(true)}>
          <span className="monthPickerYear">{selectedYear}年</span>
          <span className="monthPickerMonth">
            {String(selectedMonth).padStart(2, '0')}月 <span className="monthPickerMark">▼</span>
          </span>
        </button>
        <div className="monthTotals">
          <div className="monthTotalBlock">
            <div className="monthTotalLabel">收入</div>
            <div className="monthTotalValue">{monthIncome.toFixed(2)}</div>
          </div>
          <div className="monthTotalBlock">
            <div className="monthTotalLabel">支出</div>
            <div className="monthTotalValue">{monthExpense.toFixed(2)}</div>
          </div>
        </div>
      </div>
      {loading ? (
        <div className="muted">加载中…</div>
      ) : filteredTransactions.length === 0 ? (
        <div className="muted">还没有记录。</div>
      ) : (
        <div className="dayList">
          {groupedByDay.map((g) => (
            <section key={g.day} className="daySection">
              <div className="dayHeader">
                <div className="dayTitle">{formatDayTitle(g.day)}</div>
                <div className="dayTotals">
                  <span className="dayTotal dayTotalExpense">支出 {g.expenseTotal.toFixed(2)} 元</span>
                  <span className="dayTotal dayTotalIncome">收入 {g.incomeTotal.toFixed(2)} 元</span>
                </div>
              </div>
              <ul className="list">
                {g.items.map((t) => (
                  <li
                    key={t.id}
                    className="row"
                    onClick={() => {
                      setEditing(t)
                      setEditPickerOpen(false)
                      setEditingDirection(t.direction)
                      setEditingAmount(t.amount.toFixed(2))
                      setEditingCategory(normalizeCategory(t.direction, t.category))
                      setEditingNote(t.note ?? '')
                      setEditingOccurredAt(isoToDatetimeLocalValue(t.date))
                    }}
                  >
                    <div className="rowMain">
                      <div className="rowTop">
                        <span className="badge">{t.category}</span>
                        {t.tags.length > 0 ? (
                          <span className="tagLine">
                            {t.tags.map((x) => (
                              <span key={x} className="tagPill">
                                {x}
                              </span>
                            ))}
                          </span>
                        ) : null}
                        {t.note ? <span className="note">· {t.note}</span> : null}
                      </div>
                      <div className="rowBottom">{new Date(t.date).toLocaleTimeString()}</div>
                    </div>
                    <div className={t.direction === 'expense' ? 'money moneyExpense' : 'money moneyIncome'}>
                      {t.direction === 'expense' ? '支出 ' : '收入 '}
                      {t.amount.toFixed(2)} 元
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {pickerOpen ? (
        <div className="monthPickerOverlay" onClick={() => setPickerOpen(false)}>
          <div className="monthPickerPanel" onClick={(e) => e.stopPropagation()}>
            <div className="monthPickerTitle">选择年月</div>
            <div className="monthPickerWheels">
              <div
                className="monthWheel"
                onWheel={(e) => {
                  e.preventDefault()
                  adjustYear(e.deltaY > 0 ? 1 : -1)
                }}
              >
                <div className="monthWheelLabel">年份</div>
                <select
                  className="monthWheelSelect"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}年
                    </option>
                  ))}
                </select>
              </div>
              <div
                className="monthWheel"
                onWheel={(e) => {
                  e.preventDefault()
                  adjustMonth(e.deltaY > 0 ? 1 : -1)
                }}
              >
                <div className="monthWheelLabel">月份</div>
                <select
                  className="monthWheelSelect"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }).map((_, idx) => {
                    const m = idx + 1
                    return (
                      <option key={m} value={m}>
                        {String(m).padStart(2, '0')}月
                      </option>
                    )
                  })}
                </select>
              </div>
            </div>
            <button className="btnPrimary" onClick={() => setPickerOpen(false)}>
              确定
            </button>
          </div>
        </div>
      ) : null}
      {editing ? (
        <div
          className="monthPickerOverlay"
          onClick={() => {
            setEditPickerOpen(false)
            setEditing(null)
          }}
        >
          <div className="monthPickerPanel" onClick={(e) => e.stopPropagation()}>
            <div className="monthPickerTitle">编辑记录</div>
            <div className="grid">
              <div className="field">
                <label>金额</label>
                <input
                  inputMode="decimal"
                  value={editingAmount}
                  onChange={(e) => setEditingAmount(e.target.value)}
                  placeholder="例如 88.8"
                />
              </div>
              <div className="field">
                <label>标签</label>
                <button type="button" className="pickerTrigger" onClick={() => setEditPickerOpen(true)}>
                  {editingCategory}
                </button>
              </div>
              <div className="field fieldWide">
                <label>发生时间</label>
                <input
                  type="datetime-local"
                  value={editingOccurredAt}
                  onChange={(e) => setEditingOccurredAt(e.target.value)}
                />
              </div>
              <div className="field fieldWide">
                <label>备注</label>
                <input value={editingNote} onChange={(e) => setEditingNote(e.target.value)} placeholder="可选" />
              </div>
            </div>
            <button className="btnPrimary" onClick={() => void submitEdit()}>
              保存修改
            </button>
            <button className="btn btnDanger" onClick={() => void removeEditing()}>
              删除记录
            </button>
            <CategoryPicker
              open={editPickerOpen}
              title="选择标签"
              options={CATEGORY_PICKER_OPTIONS}
              value={editingCategory}
              onChange={(next) => {
                const nextDirection = deriveDirectionByCategory(next, editingDirection)
                setEditingDirection(nextDirection)
                setEditingCategory(normalizeCategory(nextDirection, next))
              }}
              onClose={() => setEditPickerOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </section>
  )
}

