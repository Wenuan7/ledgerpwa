import Papa from 'papaparse'
import { dumpAll } from './db'
import type { BackupJsonV1 } from './types'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

function safeDateStamp(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

export async function downloadBackupJson() {
  const data = await dumpAll()
  const backup: BackupJsonV1 = {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: 'LedgerPWA',
    data,
  }
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  downloadBlob(blob, `ledger_backup_${safeDateStamp(new Date())}.json`)
}

export async function downloadTransactionsCsv() {
  const { transactions } = await dumpAll()
  const rows = transactions
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((t) => ({
      id: t.id,
      date: t.date,
      direction: t.direction,
      amount: t.amount,
      category: t.category,
      note: t.note ?? '',
      tags: t.tags.join('|'),
      rawInput: t.rawInput ?? '',
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }))

  const csv = Papa.unparse(rows, { quotes: true })
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  downloadBlob(blob, `ledger_transactions_${safeDateStamp(new Date())}.csv`)
}

