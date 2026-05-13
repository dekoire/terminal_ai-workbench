/**
 * Shared in-memory state between REST routes and WebSocket handlers.
 * Kept in one module so perm-bridge HTTP and /ws/agent can both access the same maps.
 */
import type { WebSocket } from 'ws'

/** Pending permission decisions: requestId → resolve fn */
export const pendingPerms = new Map<
  string,
  (d: { allow: boolean; updatedInput?: Record<string, unknown>; message?: string }) => void
>()

/** Active agent WebSocket per sessionId — needed so perm-bridge can push permission_request */
export const sessionWs = new Map<string, WebSocket>()

/** Claude's own session ID per our sessionId — used for --resume on next message */
export const claudeSessionIds = new Map<string, string>()

/** Active PTY processes per sessionId — for cancel + permission_response forwarding */
export const activePtys = new Map<string, { write: (d: string) => void; kill: () => void }>()

/** Pending permission requests per sessionId — for client polling fallback */
export const pendingPermsBySession = new Map<string, { requestId: string; toolName: string; input: Record<string, unknown> }[]>()
