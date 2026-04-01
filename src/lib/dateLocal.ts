/** Convert ISO timestamp to value for `<input type="datetime-local">` (local wall clock). */
export function isoToDatetimeLocalValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return isoToDatetimeLocalValue(new Date().toISOString())
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}`
}

/** Parse `datetime-local` string as local time → ISO UTC. */
export function datetimeLocalToIso(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return new Date().toISOString()
  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return new Date().toISOString()
  return d.toISOString()
}

export function nowDatetimeLocalValue(): string {
  return isoToDatetimeLocalValue(new Date().toISOString())
}
