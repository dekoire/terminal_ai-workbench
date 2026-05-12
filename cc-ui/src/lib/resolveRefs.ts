/**
 * Resolve #msg: / #chat: / #amsg: references embedded in text by fetching
 * context from the /api/orbit/resolve endpoint and appending it as a footnote.
 *
 * - #msg:  / #chat:  → orbit JSONL files (no credentials needed)
 * - #amsg:            → agent messages in Supabase (pass supabaseUrl/Key/userId)
 */
export async function resolveRefs(
  text: string,
  ctxBefore = 2,
  ctxAfter = 2,
  supabaseUrl?: string,
  supabaseKey?: string,
  userId?: string,
): Promise<string> {
  const refPattern = /#(msg|chat|amsg):([a-z0-9-]+)/gi
  const matches = [...text.matchAll(refPattern)]
  if (matches.length === 0) return text
  let appendix = '\n\n---\nKontext-Referenzen:'
  for (const match of matches) {
    const refType = match[1]
    const refId   = match[2]
    try {
      const body: Record<string, unknown> = { ref: `${refType}:${refId}`, ctxBefore, ctxAfter }
      if (refType === 'amsg' && supabaseUrl && supabaseKey && userId) {
        body.supabaseUrl = supabaseUrl
        body.supabaseKey = supabaseKey
        body.userId      = userId
      }
      const r = await fetch('/api/orbit/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      type ResolvedMsg = { role: string; content: string; id?: string }
      const data = await r.json() as {
        ok: boolean; filePath?: string; chatId?: string; sessionId?: string
        before?: ResolvedMsg[]; target?: ResolvedMsg; after?: ResolvedMsg[]; msgs?: ResolvedMsg[]
      }
      if (!data.ok) continue
      if (refType === 'amsg') {
        appendix += `\n\nRef #amsg:${refId} → Session: ${data.sessionId ?? '?'}`
        if (data.before?.length) {
          appendix += `\n[${data.before.length} Nachricht(en) davor]`
          for (const m of data.before) appendix += `\n[${m.role}]: ${m.content.slice(0, 300)}`
        }
        if (data.target) appendix += `\n[Referenz id:${refId}]: ${data.target.content.slice(0, 600)}`
        if (data.after?.length) {
          appendix += `\n[${data.after.length} Nachricht(en) danach]`
          for (const m of data.after) appendix += `\n[${m.role}]: ${m.content.slice(0, 300)}`
        }
      } else {
        appendix += `\n\nRef #${refType}:${refId} → Datei: ${data.filePath ?? '?'}`
        if (refType === 'msg' && data.target) {
          if (data.before?.length) {
            appendix += `\n[${data.before.length} Nachricht(en) davor]`
            for (const m of data.before) appendix += `\n[${m.role}]: ${m.content.slice(0, 300)}`
          }
          appendix += `\n[Referenz id:${refId}]: ${data.target.content.slice(0, 600)}`
          if (data.after?.length) {
            appendix += `\n[${data.after.length} Nachricht(en) danach]`
            for (const m of data.after) appendix += `\n[${m.role}]: ${m.content.slice(0, 300)}`
          }
        } else if (refType === 'chat' && data.msgs?.length) {
          appendix += `\n[Chat-Inhalt, ${data.msgs.length} Nachrichten]`
          for (const m of data.msgs.slice(0, 6)) appendix += `\n[${m.role}]: ${m.content.slice(0, 300)}`
        }
      }
    } catch { /* skip on error */ }
  }
  return text + appendix
}
