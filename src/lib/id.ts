export function newId(prefix: string) {
  return `${prefix}_${uuidV4()}`
}

export function nowIso() {
  return new Date().toISOString()
}

function uuidV4() {
  // Avoid crypto.randomUUID() because iOS Safari may not expose it in non-secure contexts (http).
  const cryptoObj = globalThis.crypto as Crypto | undefined

  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(16)
    cryptoObj.getRandomValues(bytes)

    // Per RFC 4122 §4.4
    bytes[6] = (bytes[6]! & 0x0f) | 0x40
    bytes[8] = (bytes[8]! & 0x3f) | 0x80

    const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  // Last-resort fallback (not cryptographically strong, but fine for local IDs)
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1)
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`
}

