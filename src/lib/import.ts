import type { BackupJsonV1 } from './types'
import { bulkPut, clearStore } from './db'

async function readText(file: File) {
  return file.text()
}

function assertBackupJsonV1(x: any): asserts x is BackupJsonV1 {
  if (!x || typeof x !== 'object') throw new Error('备份文件格式不正确')
  if (x.version !== 1 || x.app !== 'LedgerPWA') throw new Error('备份文件版本不支持')
  if (!x.data) throw new Error('备份文件缺少 data')
}

export async function importBackupJsonFromFile(file: File) {
  const raw = await readText(file)
  const parsed = JSON.parse(raw)
  assertBackupJsonV1(parsed)

  // 为了保证“导入后与备份一致”，这里采用“先清空再导入”的策略。
  // 如果你未来希望“合并导入”，我们再做按 id 去重/合并。
  await clearStore('transactions')
  await clearStore('categories')
  await clearStore('tags')
  await clearStore('categoryBudgets')

  await bulkPut('categories', parsed.data.categories)
  await bulkPut('tags', parsed.data.tags)
  await bulkPut('categoryBudgets', parsed.data.categoryBudgets)
  await bulkPut('transactions', parsed.data.transactions)
}

