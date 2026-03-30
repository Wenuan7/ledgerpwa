import { useMemo, useState } from 'react'
import type { Transaction } from '../lib/types'

type ReportMode = 'month' | 'year'

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0)
}

function percentHeight(value: number, max: number) {
  if (max <= 0) return '4%'
  return `${Math.max(4, Math.round((value / max) * 100))}%`
}

function shouldShowDayTick(label: string, monthEndDay: number, mode: ReportMode) {
  if (mode !== 'month') return true
  const day = Number(label)
  if (!Number.isFinite(day)) return false
  if ([1, 5, 10, 15, 20, 25].includes(day)) return true
  return day === monthEndDay
}

export function ReportsPage({ transactions }: { transactions: Transaction[] }) {
  const now = new Date()
  const [mode, setMode] = useState<ReportMode>('month')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const monthEndDay = new Date(year, month, 0).getDate()

  const yearOptions = useMemo(() => {
    const years = new Set<number>([year])
    for (const t of transactions) years.add(new Date(t.date).getFullYear())
    return Array.from(years).sort((a, b) => b - a)
  }, [transactions, year])

  const scoped = useMemo(() => {
    return transactions.filter((t) => {
      const d = new Date(t.date)
      if (mode === 'year') return d.getFullYear() === year
      return d.getFullYear() === year && d.getMonth() + 1 === month
    })
  }, [mode, month, transactions, year])

  const income = sum(scoped.filter((x) => x.direction === 'income').map((x) => x.amount))
  const expense = sum(scoped.filter((x) => x.direction === 'expense').map((x) => x.amount))
  const balance = income - expense

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of scoped) {
      if (item.direction !== 'expense') continue
      map.set(item.category, (map.get(item.category) ?? 0) + item.amount)
    }
    return Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8)
  }, [scoped])

  const trend = useMemo(() => {
    if (mode === 'year') {
      const map = new Map<number, { income: number; expense: number }>()
      for (let m = 1; m <= 12; m++) map.set(m, { income: 0, expense: 0 })
      for (const item of scoped) {
        const m = new Date(item.date).getMonth() + 1
        const cur = map.get(m)!
        if (item.direction === 'income') cur.income += item.amount
        else cur.expense += item.amount
      }
      return Array.from(map.entries()).map(([label, values]) => ({ label: `${String(label).padStart(2, '0')}月`, ...values }))
    }
    const map = new Map<number, { income: number; expense: number }>()
    const days = new Date(year, month, 0).getDate()
    for (let d = 1; d <= days; d++) map.set(d, { income: 0, expense: 0 })
    for (const item of scoped) {
      const d = new Date(item.date).getDate()
      const cur = map.get(d)!
      if (item.direction === 'income') cur.income += item.amount
      else cur.expense += item.amount
    }
    return Array.from(map.entries()).map(([label, values]) => ({ label: `${label}`, ...values }))
  }, [mode, month, scoped, year])

  const maxTrend = Math.max(...trend.map((x) => x.expense), 0)
  const totalCategoryExpense = sum(byCategory.map((x) => x.amount))

  const categoryColors = ['#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#14b8a6', '#22c55e', '#eab308', '#f97316']
  const categoryWithColor = byCategory.map((item, idx) => ({
    ...item,
    color: categoryColors[idx % categoryColors.length],
    ratio: totalCategoryExpense > 0 ? item.amount / totalCategoryExpense : 0
  }))
  const topCategoryDetails = categoryWithColor.filter((item) => item.ratio >= 0.1).slice(0, 5)
  const pieStops: string[] = []
  let acc = 0
  for (const item of categoryWithColor) {
    const next = acc + item.ratio * 100
    pieStops.push(`${item.color} ${acc.toFixed(2)}% ${next.toFixed(2)}%`)
    acc = next
  }
  const pieStyle =
    pieStops.length > 0
      ? { background: `conic-gradient(${pieStops.join(', ')})` }
      : { background: 'var(--code-bg)' }

  return (
    <section className="card">
      <div className="reportNav">
        <div className="reportSwitch">
          <button className={mode === 'month' ? 'tabItem tabItemActive' : 'tabItem'} onClick={() => setMode('month')}>
            月报
          </button>
          <button className={mode === 'year' ? 'tabItem tabItemActive' : 'tabItem'} onClick={() => setMode('year')}>
            年报
          </button>
        </div>
        <div className="reportSelectors">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}年
              </option>
            ))}
          </select>
          {mode === 'month' ? (
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }).map((_, idx) => {
                const m = idx + 1
                return (
                  <option key={m} value={m}>
                    {String(m).padStart(2, '0')}月
                  </option>
                )
              })}
            </select>
          ) : null}
        </div>
      </div>

      <div className="reportStats">
        <div className="reportStatCard">
          <div className="reportStatLabel">收入</div>
          <div className="reportStatValue reportIncome">{income.toFixed(2)}</div>
        </div>
        <div className="reportStatCard">
          <div className="reportStatLabel">支出</div>
          <div className="reportStatValue reportExpense">{expense.toFixed(2)}</div>
        </div>
        <div className="reportStatCard">
          <div className="reportStatLabel">结余</div>
          <div className={balance >= 0 ? 'reportStatValue reportIncome' : 'reportStatValue reportExpense'}>{balance.toFixed(2)}</div>
        </div>
      </div>

      <section className="reportSection">
        <div className="cardTitle">支出柱状图</div>
        {trend.length === 0 ? (
          <div className="muted">当前范围暂无支出数据。</div>
        ) : (
          <div className="reportExpenseBarsWrap">
            <div
              className="reportExpenseBars"
              style={{ gridTemplateColumns: `repeat(${trend.length}, minmax(0, 1fr))` }}
            >
              {trend.map((item) => (
                <div key={item.label} className="reportExpenseBarCol">
                  <div className="reportExpenseBarTrack">
                    <div className="reportExpenseBarFill" style={{ height: percentHeight(item.expense, maxTrend) }} />
                  </div>
                  <div className={shouldShowDayTick(item.label, monthEndDay, mode) ? 'reportExpenseBarLabel' : 'reportExpenseBarLabel reportExpenseBarLabelMuted'}>
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="reportSection">
        <div className="cardTitle">支出分类占比</div>
        {byCategory.length === 0 ? (
          <div className="muted">当前范围暂无支出数据。</div>
        ) : (
          <div className="reportPieSection">
            <div className="reportPieWrap">
              <div className="reportPie" style={pieStyle} />
              <div className="reportPieHole" />
            </div>
            <div className="reportPieDetails">
              {topCategoryDetails.length === 0 ? (
                <div className="muted">暂无大占比分类（单项占比需 ≥10%）</div>
              ) : (
                topCategoryDetails.map((item) => (
                  <div key={item.category} className="reportPieDetailItem">
                    <span className="reportPieDot" style={{ backgroundColor: item.color }} />
                    <div className="reportPieDetailText">
                      <div className="reportPieDetailHead">
                        <span>{item.category}</span>
                        <span>{(item.ratio * 100).toFixed(1)}%</span>
                      </div>
                      <div className="muted">{item.amount.toFixed(2)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </section>

    </section>
  )
}

