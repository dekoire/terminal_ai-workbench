// ── credentialStore ────────────────────────────────────────────────────────────
// Field-level encryption for sensitive credentials persisted to disk.
//
// How it works:
//   • On write  (setItem):  plaintext credential strings → { __enc__: true, data: "<base64>" }
//   • On read   (getItem):  marker objects → decrypted plaintext strings
//   • Fallback:             if Electron safeStorage is unavailable (web/dev mode),
//                           values are stored as-is; an `__enc__: false` marker is
//                           written so future reads know the value is plaintext.
//   • Migration:            existing stores with plaintext strings are accepted
//                           transparently; next write will encrypt them.
//
// Encryption backend: Electron safeStorage (macOS Keychain / Windows DPAPI /
// Linux libsecret) via IPC → electron/main.ts `credential:encrypt|decrypt`.

// ── Credential field definitions ──────────────────────────────────────────────

/** Top-level keys in the persisted state object that hold sensitive strings. */
export const TOP_LEVEL_CREDENTIAL_FIELDS = [
  'openrouterKey',
  'githubToken',
  'groqApiKey',
  'cloudflareR2SecretAccessKey',
] as const

/** Arrays in the persisted state that contain objects with a sensitive sub-field. */
export const ARRAY_CREDENTIAL_FIELDS = [
  { array: 'tokens',          field: 'token'     },
  { array: 'claudeProviders', field: 'authToken' },
] as const satisfies ReadonlyArray<{ array: string; field: string }>

// ── Encrypted-value marker ────────────────────────────────────────────────────

const MARKER = '__enc__' as const

interface EncryptedValue {
  [MARKER]: true
  data: string   // base64-encoded ciphertext
}

interface PlaintextMarker {
  [MARKER]: false
  data: string   // raw string (safeStorage unavailable at write time)
}

type CredentialSlot = EncryptedValue | PlaintextMarker

function isCredentialSlot(v: unknown): v is CredentialSlot {
  return (
    typeof v === 'object' &&
    v !== null &&
    MARKER in (v as Record<string, unknown>)
  )
}

// ── Electron IPC bridge ───────────────────────────────────────────────────────

function getElectronAPI() {
  const api = window.electronAPI
  if (api?.encryptCredential && api?.decryptCredential) return api
  return null
}

// ── Core encrypt / decrypt ────────────────────────────────────────────────────

async function encryptField(plaintext: string): Promise<CredentialSlot> {
  const api = getElectronAPI()
  if (!api) {
    // Not running inside Electron (web/dev mode) — store with plaintext marker
    return { [MARKER]: false, data: plaintext }
  }
  try {
    const base64 = await api.encryptCredential(plaintext)
    return { [MARKER]: true, data: base64 }
  } catch (err) {
    console.warn('[credentialStore] encrypt failed, storing plaintext marker:', err)
    return { [MARKER]: false, data: plaintext }
  }
}

async function decryptField(slot: CredentialSlot): Promise<string> {
  if (!slot[MARKER]) {
    // Plaintext marker — value was stored unencrypted
    return slot.data
  }
  const api = getElectronAPI()
  if (!api) {
    console.warn('[credentialStore] decrypt: Electron API unavailable, returning empty')
    return ''
  }
  try {
    return await api.decryptCredential(slot.data)
  } catch (err) {
    console.warn('[credentialStore] decrypt failed, returning empty:', err)
    return ''
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

type StateObject = Record<string, unknown>

/**
 * Encrypt all credential fields in a partialised store state before writing to disk.
 * Non-empty strings are replaced with CredentialSlot marker objects.
 */
export async function encryptCredentials(state: StateObject): Promise<StateObject> {
  const result: StateObject = { ...state }

  // Top-level string fields
  for (const field of TOP_LEVEL_CREDENTIAL_FIELDS) {
    const val = result[field]
    if (typeof val === 'string' && val.length > 0) {
      result[field] = await encryptField(val)
    }
    // Empty strings and undefined are left as-is
  }

  // Nested array fields
  for (const { array, field } of ARRAY_CREDENTIAL_FIELDS) {
    const arr = result[array]
    if (!Array.isArray(arr)) continue
    result[array] = await Promise.all(
      arr.map(async (item: StateObject) => {
        const val = item[field]
        if (typeof val === 'string' && val.length > 0) {
          return { ...item, [field]: await encryptField(val) }
        }
        return item
      }),
    )
  }

  return result
}

/**
 * Decrypt credential fields after reading from disk.
 * CredentialSlot marker objects are replaced with plaintext strings.
 * Plain strings (migration from old unencrypted stores) are returned unchanged.
 */
export async function decryptCredentials(state: StateObject): Promise<StateObject> {
  const result: StateObject = { ...state }

  for (const field of TOP_LEVEL_CREDENTIAL_FIELDS) {
    const val = result[field]
    if (isCredentialSlot(val)) {
      result[field] = await decryptField(val)
    }
    // Plain string → already plaintext (old store, will be encrypted on next write)
  }

  for (const { array, field } of ARRAY_CREDENTIAL_FIELDS) {
    const arr = result[array]
    if (!Array.isArray(arr)) continue
    result[array] = await Promise.all(
      arr.map(async (item: StateObject) => {
        const val = item[field]
        if (isCredentialSlot(val)) {
          return { ...item, [field]: await decryptField(val) }
        }
        return item
      }),
    )
  }

  return result
}
