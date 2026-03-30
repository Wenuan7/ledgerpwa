import './App.css'
import { useEffect, useMemo, useState } from 'react'
import type { Direction, Transaction } from './lib/types'
import {
  addTransaction,
  clearTransactionsForArchive,
  countTransactions,
  deleteTransaction,
  ensureSeedData,
  ensureSampleTransactionsIfEmpty,
  listRecentTransactions,
  updateTransaction,
} from './lib/db'
import { downloadBackupJson, downloadTransactionsCsv } from './lib/export'
import { importBackupJsonFromFile } from './lib/import'
import { DetailsPage } from './pages/DetailsPage'
import { AddPage } from './pages/AddPage'
import { ReportsPage } from './pages/ReportsPage'
import { parseQuickInput } from './lib/quickParse'
import {
  budgetDismissStorageKey,
  budgetRulesStorageKey,
  createArchive,
  deleteArchive,
  ensureArchivesMetaInitialized,
  getActiveArchiveId,
  getArchiveNameById,
  listArchives,
  renameArchive,
  setActiveArchiveId,
  type ArchiveInfo,
} from './lib/archives'

type TabKey = 'details' | 'add' | 'reports' | 'settings'
type BudgetTargetType = 'total' | 'category'
type BudgetRule = {
  id: string
  targetType: BudgetTargetType
  category?: string
  amount: number
}

const BUDGET_THRESHOLDS = [0.5, 0.8, 1]

function monthKeyOf(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function loadBudgetRules(archiveId: string): BudgetRule[] {
  try {
    const raw = localStorage.getItem(budgetRulesStorageKey(archiveId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as BudgetRule[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function loadDismissSet(archiveId: string): Set<string> {
  try {
    const raw = localStorage.getItem(budgetDismissStorageKey(archiveId))
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

function App() {
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [error, setError] = useState<string | null>(null)

  const [tab, setTab] = useState<TabKey>('details')
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickInput, setQuickInput] = useState('')
  const [budgetVersion, setBudgetVersion] = useState(0)
  const [dismissVersion, setDismissVersion] = useState(0)
  const [archiveVersion, setArchiveVersion] = useState(0)
  const [travelOpen, setTravelOpen] = useState(false)
  const [createArchiveOpen, setCreateArchiveOpen] = useState(false)
  const [newArchiveNameInput, setNewArchiveNameInput] = useState('')
  const [archiveRecordCount, setArchiveRecordCount] = useState(0)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetPassword, setResetPassword] = useState('')

  const activeArchiveId = useMemo(() => getActiveArchiveId(), [archiveVersion])

  useEffect(() => {
    const fn = () => setBudgetVersion((v) => v + 1)
    window.addEventListener('ledger:budget-updated', fn)
    return () => window.removeEventListener('ledger:budget-updated', fn)
  }, [])

  useEffect(() => {
    const fn = () => setArchiveVersion((v) => v + 1)
    window.addEventListener('ledger:archive-changed', fn)
    return () => window.removeEventListener('ledger:archive-changed', fn)
  }, [])

  async function refresh() {
    try {
      const [items, count] = await Promise.all([listRecentTransactions(100), countTransactions()])
      setTransactions(items)
      setArchiveRecordCount(count)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(`读取数据失败：${msg}`)
    }
  }

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        ensureArchivesMetaInitialized()
        await ensureSeedData()
        await ensureSampleTransactionsIfEmpty()
        await refresh()
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setError(`初始化失败：${msg}`)
      } finally {
        setLoading(false)
      }
    })()
  }, [archiveVersion])

  async function onAdd(input: { direction: Direction; amount: number; category: string; note?: string }) {
    try {
      setError(null)
      await addTransaction({
        direction: input.direction,
        amount: input.amount,
        category: input.category,
        note: input.note,
        date: new Date().toISOString(),
        rawInput: undefined,
        tags: [],
      })
      await refresh()
      setTab('details')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(`保存失败：${msg}`)
    }
  }

  async function onExportJson() {
    await downloadBackupJson()
  }

  async function onExportCsv() {
    await downloadTransactionsCsv()
  }

  async function onImportJson(file: File) {
    await importBackupJsonFromFile(file)
    await refresh()
  }

  async function onUpdate(tx: Transaction) {
    try {
      setError(null)
      await updateTransaction(tx)
      await refresh()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(`修改失败：${msg}`)
    }
  }

  async function onDelete(id: string) {
    try {
      setError(null)
      await deleteTransaction(id)
      await refresh()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(`删除失败：${msg}`)
    }
  }

  async function onQuickSave() {
    const parsed = parseQuickInput(quickInput)
    if (!parsed) {
      setError('快速记账识别失败：请至少包含有效金额，例如“晚饭火锅300”。')
      return
    }
    await onAdd(parsed)
    setQuickInput('')
    setQuickOpen(false)
  }

  async function onRenameArchive(target: ArchiveInfo) {
    const nextName = window.prompt('请输入新的账本名称', target.name)
    if (nextName === null) return
    renameArchive(target.id, nextName)
    setArchiveVersion((v) => v + 1)
  }

  async function onDeleteArchive(target: ArchiveInfo) {
    if (target.id === 'default') return
    const ok = window.confirm(`确认删除账本“${target.name}”？删除后不可恢复。`)
    if (!ok) return
    try {
      await deleteArchive(target.id)
      if (activeArchiveId === target.id) setActiveArchiveId('default')
      else setArchiveVersion((v) => v + 1)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(`删除账本失败：${msg}`)
    }
  }

  async function onResetMainArchive() {
    if (resetPassword !== '112820') {
      setError('重置失败：密码错误。')
      return
    }
    try {
      await clearTransactionsForArchive('default')
      setResetOpen(false)
      setResetPassword('')
      if (activeArchiveId === 'default') await refresh()
      window.alert('主账本记录已清空。')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(`重置失败：${msg}`)
    }
  }

  const currentYm = monthKeyOf()
  const monthExpenseRecords = useMemo(
    () => transactions.filter((t) => t.direction === 'expense' && t.date.startsWith(currentYm)),
    [currentYm, transactions],
  )
  const monthExpenseTotal = monthExpenseRecords.reduce((sum, t) => sum + t.amount, 0)
  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of monthExpenseRecords) {
      map.set(item.category, (map.get(item.category) ?? 0) + item.amount)
    }
    return map
  }, [monthExpenseRecords])
  const budgetRules = useMemo(() => loadBudgetRules(activeArchiveId), [budgetVersion, activeArchiveId])
  const dismissed = useMemo(() => loadDismissSet(activeArchiveId), [dismissVersion, activeArchiveId])
  const activeBudgetAlert = useMemo(() => {
    for (const rule of budgetRules) {
      const spent = rule.targetType === 'total' ? monthExpenseTotal : (expenseByCategory.get(rule.category ?? '') ?? 0)
      if (rule.amount <= 0) continue
      const rate = spent / rule.amount
      const hit = [...BUDGET_THRESHOLDS].reverse().find((x) => rate >= x)
      if (!hit) continue
      const dismissKey = `${rule.id}:${currentYm}:${hit}`
      if (dismissed.has(dismissKey)) continue
      return { rule, spent, hit, dismissKey }
    }
    return null
  }, [budgetRules, currentYm, dismissed, expenseByCategory, monthExpenseTotal])

  return (
    <div className="app">
      {error ? <div className="errorBanner">{error}</div> : null}

      <main className="main">
        {tab === 'details' ? (
          <DetailsPage loading={loading} transactions={transactions} onUpdate={onUpdate} onDelete={onDelete} />
        ) : null}
        {tab === 'add' ? <AddPage archiveId={activeArchiveId} onAdd={onAdd} /> : null}
        {tab === 'reports' ? <ReportsPage transactions={transactions} /> : null}
        {tab === 'settings' ? (
          <section className="card">
            <div className="title">SINO记账</div>
            <div className="travelModeRow">
              <button
                type="button"
                className="btn btnTravel"
                onClick={() => {
                  setTravelOpen(true)
                  setCreateArchiveOpen(false)
                }}
              >
                旅行模式
              </button>
              <span className="travelModeHint muted">
                当前：{getArchiveNameById(activeArchiveId)} · {archiveRecordCount} 条记录
              </span>
            </div>
            <div className="actions settingsActions">
              <button className="btn" onClick={onExportJson}>
                导出 JSON
              </button>
              <button className="btn" onClick={onExportCsv}>
                导出 CSV
              </button>
              <label className="btn btnGhost">
                导入 JSON
                <input
                  className="fileInput"
                  type="file"
                  accept="application/json"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void onImportJson(f)
                    e.currentTarget.value = ''
                  }}
                />
              </label>
            </div>
            <div className="settingsBottomRow">
              <button
                type="button"
                className="btn btnDanger resetMainBtn"
                onClick={() => {
                  setResetPassword('')
                  setResetOpen(true)
                }}
              >
                重置主账本
              </button>
            </div>
          </section>
        ) : null}
      </main>

      {tab === 'details' ? (
        <button
          className="fabQuick"
          aria-label="快速记账"
          onClick={() => {
            setQuickOpen(true)
            setError(null)
          }}
        >
          +
        </button>
      ) : null}
      {travelOpen ? (
        <div
          className="monthPickerOverlay"
          onClick={() => {
            setTravelOpen(false)
            setCreateArchiveOpen(false)
          }}
        >
          <div className="monthPickerPanel travelArchivePanel" onClick={(e) => e.stopPropagation()}>
            <div className="monthPickerTitle">旅行模式 · 切换账本</div>
            <div className="muted" style={{ marginBottom: 10 }}>
              不同账本数据相互独立，可随时来回切换。
            </div>
            <div className="archiveList">
              {listArchives().map((a: ArchiveInfo) => (
                <div key={a.id} className={a.id === activeArchiveId ? 'archiveRow archiveRowActive' : 'archiveRow'}>
                  <button
                    type="button"
                    className="archiveSelectBtn"
                    onClick={() => {
                      setActiveArchiveId(a.id)
                      setTravelOpen(false)
                    }}
                  >
                    <span className="archiveRowName">{a.name}</span>
                    {a.id === activeArchiveId ? <span className="archiveRowBadge">当前</span> : null}
                  </button>
                  <div className="archiveRowActions">
                    <button type="button" className="btn btnGhost archiveActionBtn" onClick={() => void onRenameArchive(a)}>
                      改名
                    </button>
                    {a.id !== 'default' ? (
                      <button type="button" className="btn btnDanger archiveActionBtn" onClick={() => void onDeleteArchive(a)}>
                        删除
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btnPrimary"
              style={{ marginTop: 12 }}
              onClick={() => {
                setTravelOpen(false)
                setCreateArchiveOpen(true)
                setNewArchiveNameInput('')
              }}
            >
              创建新存档
            </button>
            <button type="button" className="btn btnGhost" style={{ marginTop: 8 }} onClick={() => setTravelOpen(false)}>
              关闭
            </button>
          </div>
        </div>
      ) : null}
      {createArchiveOpen ? (
        <div
          className="monthPickerOverlay"
          onClick={() => {
            setCreateArchiveOpen(false)
            setTravelOpen(true)
          }}
        >
          <div className="monthPickerPanel" onClick={(e) => e.stopPropagation()}>
            <div className="monthPickerTitle">新建旅行账本</div>
            <div className="field" style={{ marginTop: 10 }}>
              <label>账本名称</label>
              <input
                className="quickInput"
                value={newArchiveNameInput}
                onChange={(e) => setNewArchiveNameInput(e.target.value)}
                placeholder="例如：2025 法国 巴黎"
                autoFocus
              />
            </div>
            <div className="archiveCreateActions">
              <button
                type="button"
                className="btn btnGhost"
                onClick={() => {
                  setCreateArchiveOpen(false)
                  setTravelOpen(true)
                }}
              >
                取消
              </button>
              <button
                type="button"
                className="btnPrimary"
                onClick={() => {
                  const info = createArchive(newArchiveNameInput)
                  setActiveArchiveId(info.id)
                  setCreateArchiveOpen(false)
                  setTravelOpen(false)
                  setNewArchiveNameInput('')
                }}
              >
                创建并进入
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {quickOpen ? (
        <div className="monthPickerOverlay" onClick={() => setQuickOpen(false)}>
          <div className="monthPickerPanel" onClick={(e) => e.stopPropagation()}>
            <div className="monthPickerTitle">快速记账</div>
            <div className="muted">示例：吃饭 晚饭火锅300</div>
            <div className="field quickField" style={{ marginTop: 10, marginBottom: 12 }}>
              <label>请输入口语描述</label>
              <input
                className="quickInput"
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                placeholder="例如：打车回家35"
                autoFocus
              />
            </div>
            <button className="btnPrimary" onClick={() => void onQuickSave()}>
              确认并记账
            </button>
          </div>
        </div>
      ) : null}
      {resetOpen ? (
        <div
          className="monthPickerOverlay"
          onClick={() => {
            setResetOpen(false)
            setResetPassword('')
          }}
        >
          <div className="monthPickerPanel" onClick={(e) => e.stopPropagation()}>
            <div className="monthPickerTitle">重置主账本</div>
            <div className="field" style={{ marginTop: 10 }}>
              <label>密码</label>
              <input
                className="quickInput"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder=""
                autoFocus
              />
            </div>
            <div className="archiveCreateActions">
              <button
                type="button"
                className="btn btnGhost"
                onClick={() => {
                  setResetOpen(false)
                  setResetPassword('')
                }}
              >
                取消
              </button>
              <button type="button" className="btnPrimary" onClick={() => void onResetMainArchive()}>
                确认重置
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {activeBudgetAlert ? (
        <div className="budgetToast">
          <div className="budgetToastTitle">预算提醒</div>
          <div className="budgetToastText">
            {activeBudgetAlert.rule.targetType === 'total' ? '总支出' : `${activeBudgetAlert.rule.category}支出`}已达
            {(activeBudgetAlert.hit * 100).toFixed(0)}%
            （{activeBudgetAlert.spent.toFixed(2)} / {activeBudgetAlert.rule.amount.toFixed(2)}）
          </div>
          <button
            className="budgetToastClose"
            onClick={() => {
              const next = new Set(dismissed)
              next.add(activeBudgetAlert.dismissKey)
              localStorage.setItem(budgetDismissStorageKey(activeArchiveId), JSON.stringify(Array.from(next)))
              setDismissVersion((v) => v + 1)
            }}
          >
            关闭
          </button>
        </div>
      ) : null}

      <nav className="tabBar" role="navigation" aria-label="底部任务栏">
        <button className={tab === 'details' ? 'tabItem tabItemActive' : 'tabItem'} onClick={() => setTab('details')}>
          明细
        </button>
        <button className={tab === 'add' ? 'tabItem tabItemActive' : 'tabItem'} onClick={() => setTab('add')}>
          记账
        </button>
        <button className={tab === 'reports' ? 'tabItem tabItemActive' : 'tabItem'} onClick={() => setTab('reports')}>
          报表
        </button>
        <button
          className={tab === 'settings' ? 'tabItem tabItemActive' : 'tabItem'}
          onClick={() => setTab('settings')}
        >
          设置
        </button>
      </nav>
    </div>
  )
}

export default App
