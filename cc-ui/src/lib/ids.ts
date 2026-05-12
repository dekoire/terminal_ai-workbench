/**
 * Tree-structured IDs — each child embeds the full unique segment of its parent.
 *
 * Hierarchy (navigable without full scan):
 *
 *   pr-qkzets                    ← Project   (rand6 = "qkzets")
 *   ss-qkzets-ab12               ← Session   (projRand6 embedded + own rand4)
 *   am-ab12-xy34                 ← AgentMsg  (sessRand4 embedded + own rand4)
 *
 * Lookup:
 *   am-ab12-xy34
 *     → sessRand4 = "ab12"
 *     → find session: id.endsWith("-ab12")   → ss-qkzets-ab12
 *     → projRand6  = "qkzets"
 *     → project id = "pr-qkzets"             O(1) exact match
 *
 * Display addresses:
 *   #proj:pr-qkzets
 *   #sess:ss-qkzets-ab12
 *   #msg:am-ab12-xy34
 */

function rand(len: number) {
  return Math.random().toString(36).slice(2, 2 + len).padEnd(len, '0')
}

// ── Generators ────────────────────────────────────────────────────────────────

export function newProjectId(): string {
  return `pr-${rand(6)}`
}

export function newSessionId(projectId: string): string {
  // Embed the exact 6-char rand segment from the project ID so we can walk back up.
  const projRand6 = projectId.startsWith('pr-')
    ? projectId.slice(3)          // exact: pr-qkzets → "qkzets"
    : projectId.replace(/[^a-z0-9]/gi, '').slice(-6).padStart(6, '0')  // fallback for old IDs
  return `ss-${projRand6}-${rand(4)}`
}

export function newAgentMsgId(sessionId: string): string {
  // Embed the exact 4-char trailing rand segment from the session ID.
  const sessRand4 = sessionId.startsWith('ss-')
    ? sessionId.split('-').at(-1) ?? rand(4)   // ss-qkzets-ab12 → "ab12"
    : sessionId.replace(/[^a-z0-9]/gi, '').slice(-4).padStart(4, '0')  // fallback
  return `am-${sessRand4}-${rand(4)}`
}

// ── Tree lookup helpers ───────────────────────────────────────────────────────

/** Extract projRand6 from a session ID → use to find the project. */
export function projRandFromSession(sessionId: string): string | null {
  if (!sessionId.startsWith('ss-')) return null
  const parts = sessionId.split('-')           // ['ss', projRand6, sessRand4]
  return parts[1] ?? null                      // "qkzets"
}

/** Extract sessRand4 from a message ID → use to find the session. */
export function sessRandFromMsg(msgId: string): string | null {
  if (!msgId.startsWith('am-')) return null
  const parts = msgId.split('-')               // ['am', sessRand4, msgRand4]
  return parts[1] ?? null                      // "ab12"
}

/**
 * Walk a message ID back up the tree.
 * Returns { projectId, sessionId } or nulls if the chain can't be resolved.
 */
export function resolveMessageTree(
  msgId: string,
  sessions: Array<{ id: string }>,
  projects: Array<{ id: string }>,
): { sessionId: string | null; projectId: string | null } {
  const sr = sessRandFromMsg(msgId)
  if (!sr) return { sessionId: null, projectId: null }

  const session = sessions.find(s => s.id.endsWith(`-${sr}`))
  if (!session) return { sessionId: null, projectId: null }

  const pr = projRandFromSession(session.id)
  const project = pr ? projects.find(p => p.id === `pr-${pr}`) : null

  return { sessionId: session.id, projectId: project?.id ?? null }
}

// ── Display ───────────────────────────────────────────────────────────────────

export type IdType = 'project' | 'session' | 'agent-msg' | 'orbit-chat' | 'orbit-msg' | 'unknown'

export function parseIdType(id: string): IdType {
  if (id.startsWith('pr-')) return 'project'
  if (id.startsWith('ss-')) return 'session'
  if (id.startsWith('am-')) return 'agent-msg'
  if (id.startsWith('oc-')) return 'orbit-chat'
  if (id.startsWith('om-')) return 'orbit-msg'
  return 'unknown'
}

export function idAddress(id: string): string {
  const t = parseIdType(id)
  if (t === 'project')    return `#proj:${id}`
  if (t === 'session')    return `#sess:${id}`
  if (t === 'agent-msg')  return `#msg:${id}`
  if (t === 'orbit-chat') return `#chat:${id}`
  if (t === 'orbit-msg')  return `#msg:${id}`
  return `#id:${id}`
}
