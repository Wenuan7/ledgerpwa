import { newId } from './id'

export const ACTIVE_ARCHIVE_KEY = 'ledger_active_archive_v1'
export const ARCHIVES_LIST_KEY = 'ledger_archives_list_v1'

export type ArchiveInfo = {
  id: string
  name: string
  createdAt: string
}

export function getActiveArchiveId(): string {
  try {
    const v = localStorage.getItem(ACTIVE_ARCHIVE_KEY)
    if (v) return v
  } catch {
    /* ignore */
  }
  return 'default'
}

export function setActiveArchiveId(id: string) {
  localStorage.setItem(ACTIVE_ARCHIVE_KEY, id)
  window.dispatchEvent(new CustomEvent('ledger:archive-changed', { detail: { id } }))
}

/** IndexedDB 库名：主账本沿用旧名以兼容已有数据 */
export function getDbNameForArchive(archiveId: string): string {
  if (archiveId === 'default') return 'ledgerpwa'
  return `ledgerpwa__${archiveId}`
}

export function listArchives(): ArchiveInfo[] {
  try {
    const raw = localStorage.getItem(ARCHIVES_LIST_KEY)
    if (!raw) return [defaultArchiveMeta()]
    const parsed = JSON.parse(raw) as ArchiveInfo[]
    if (!Array.isArray(parsed) || parsed.length === 0) return [defaultArchiveMeta()]
    if (!parsed.some((a) => a.id === 'default')) {
      return [defaultArchiveMeta(), ...parsed]
    }
    return parsed
  } catch {
    return [defaultArchiveMeta()]
  }
}

function defaultArchiveMeta(): ArchiveInfo {
  return { id: 'default', name: '主账本', createdAt: new Date(0).toISOString() }
}

export function ensureArchivesMetaInitialized() {
  const list = listArchives()
  if (list.some((a) => a.id === 'default')) return
  localStorage.setItem(ARCHIVES_LIST_KEY, JSON.stringify([defaultArchiveMeta(), ...list]))
}

export function createArchive(displayName: string): ArchiveInfo {
  const name = displayName.trim() || '旅行账本'
  const id = newId('arch')
  const info: ArchiveInfo = { id, name, createdAt: new Date().toISOString() }
  const list = listArchives().filter((a) => a.id !== id)
  list.push(info)
  localStorage.setItem(ARCHIVES_LIST_KEY, JSON.stringify(list))
  return info
}

export function renameArchive(archiveId: string, displayName: string) {
  const name = displayName.trim()
  if (!name) return
  const list = listArchives()
  const idx = list.findIndex((a) => a.id === archiveId)
  if (idx < 0) return
  list[idx] = { ...list[idx], name }
  localStorage.setItem(ARCHIVES_LIST_KEY, JSON.stringify(list))
}

export async function deleteArchive(archiveId: string) {
  if (archiveId === 'default') throw new Error('主账本不支持删除')
  const list = listArchives().filter((a) => a.id !== archiveId)
  localStorage.setItem(ARCHIVES_LIST_KEY, JSON.stringify(list))
  localStorage.removeItem(budgetRulesStorageKey(archiveId))
  localStorage.removeItem(budgetDismissStorageKey(archiveId))
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(getDbNameForArchive(archiveId))
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error ?? new Error('删除账本数据库失败'))
    req.onblocked = () => reject(new Error('数据库被占用，请关闭相关页面后重试'))
  })
}

export function getArchiveNameById(id: string): string {
  const found = listArchives().find((a) => a.id === id)
  return found?.name ?? '账本'
}

export function budgetRulesStorageKey(archiveId: string) {
  return archiveId === 'default' ? 'ledger_budget_rules_v1' : `ledger_budget_rules_v1__${archiveId}`
}

export function budgetDismissStorageKey(archiveId: string) {
  return archiveId === 'default' ? 'ledger_budget_dismiss_v1' : `ledger_budget_dismiss_v1__${archiveId}`
}
