import { useState, useCallback, useRef, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import type { Toast } from '../store/useAppStore'
import { aiDetectStartCmd } from '../utils/aiDetect'
import {
  heuristicDetect,
  guessPort,
  detectExtraPorts,
  writeProjectConfig,
  type DetectionMethod,
} from '../utils/launchUtils'

async function _readLogError(port: number): Promise<string> {
  try {
    const r = await fetch(`/api/app-log?port=${port}`)
    const d = await r.json() as { content: string }
    const lines = (d.content ?? '').split('\n').filter(Boolean)
    const errLine = lines.findLast(l => /error|ERR!/i.test(l))
    if (errLine) return `Prozess beendet — ${errLine.trim().slice(0, 120)}`
  } catch { /* ignore */ }
  return 'Prozess wurde unerwartet beendet.'
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type LaunchStatus = 'idle' | 'detecting' | 'ready' | 'starting' | 'running' | 'error'

export interface AppLauncherState {
  status: LaunchStatus
  cmd: string
  port: number | undefined
  url: string | undefined
  method: DetectionMethod
  errorMsg: string | undefined
}

const IDLE: AppLauncherState = {
  status: 'idle', cmd: '', port: undefined, url: undefined, method: null, errorMsg: undefined,
}

export interface UseAppLauncher {
  state: AppLauncherState
  showModal: boolean
  /** Call when user clicks Play or wants to open Workshop browser */
  triggerDetect: () => Promise<void>
  /** Start the app with the given cmd/port, optionally persist to config */
  launch: (cmd: string, port: number | undefined, remember: boolean) => Promise<void>
  /** Re-run AI detection after a failed start */
  retryWithAI: () => Promise<void>
  dismissModal: () => void
  /** Set config manually (from gear popover) — resets to idle so next play is instant */
  setManualConfig: (cmd: string, port: number | undefined) => void
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAppLauncher(projectId: string | undefined, openBrowserOnSuccess = true): UseAppLauncher {
  const { projects, updateProject, addToast, removeToast } = useAppStore()
  const project = projects.find(p => p.id === projectId)

  const [state, setState] = useState<AppLauncherState>(IDLE)
  const [showModal, setShowModal] = useState(false)

  // Keep a ref to the latest project path/port so callbacks don't stale-close
  const projectRef = useRef(project)
  projectRef.current = project

  const openBrowserRef = useRef(openBrowserOnSuccess)
  openBrowserRef.current = openBrowserOnSuccess

  const addToastRef = useRef(addToast)
  addToastRef.current = addToast
  const removeToastRef = useRef(removeToast)
  removeToastRef.current = removeToast

  // Reset when project changes
  useEffect(() => {
    setState(IDLE)
    setShowModal(false)
  }, [projectId])

  // ── Internal: run the server and monitor the port ─────────────────────────

  const _doLaunch = useCallback(async (cmd: string, port: number | undefined, useToast = false) => {
    const p = projectRef.current
    if (!p?.path) return

    setState(s => ({ ...s, status: 'starting', cmd, port, url: port ? `http://localhost:${port}` : undefined }))

    let startingToastId: string | undefined
    if (useToast) {
      startingToastId = addToastRef.current({
        type: 'info',
        title: 'App wird gestartet…',
        body: cmd,
        duration: 0,
      } as Omit<Toast, 'id'>)
    } else {
      setShowModal(true)
    }

    const _fail = (errorMsg: string) => {
      setState(s => ({ ...s, status: 'error', errorMsg }))
      if (useToast) {
        if (startingToastId) removeToastRef.current(startingToastId)
        addToastRef.current({
          type: 'error',
          title: 'App konnte nicht gestartet werden',
          body: errorMsg,
          duration: 0,
          actions: [{ label: 'Details & KI-Retry', variant: 'primary', onClick: () => setShowModal(true) }],
        } as Omit<Toast, 'id'>)
      }
    }

    let pid: number | undefined
    let extraPorts: number[] = []
    try {
      extraPorts = await detectExtraPorts(p.path)
      const r = await fetch('/api/start-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: p.path, port, startCmd: cmd, extraPorts }),
      })
      const d = await r.json() as { ok: boolean; pid?: number }
      if (!d.ok) {
        _fail('Server konnte nicht gestartet werden.')
        return
      }
      pid = d.pid
    } catch {
      _fail('Netzwerkfehler beim Starten.')
      return
    }

    // If no port known, assume success immediately
    if (!port && extraPorts.length === 0) {
      setState(s => ({ ...s, status: 'running' }))
      if (useToast) {
        if (startingToastId) removeToastRef.current(startingToastId)
        addToastRef.current({ type: 'success', title: 'App gestartet', duration: 4000 } as Omit<Toast, 'id'>)
      } else {
        setShowModal(false)
      }
      return
    }

    // All ports to watch: configured port + vite server.port + proxy backends
    const allPorts = [...new Set([port, ...extraPorts].filter((x): x is number => !!x))]

    // Poll until any port opens or process dies (2s interval, 30s timeout)
    const start = Date.now()
    while (Date.now() - start < 30_000) {
      await new Promise<void>(res => setTimeout(res, 2_000))

      // Check all known ports — first one that responds wins
      for (const p of allPorts) {
        try {
          const r = await fetch(`/api/check-port?port=${p}`)
          const d = await r.json() as { inUse: boolean }
          if (d.inUse) {
            const url = `http://localhost:${p}`
            setState(s => ({ ...s, status: 'running', port: p, url }))
            if (useToast) {
              if (startingToastId) removeToastRef.current(startingToastId)
              addToastRef.current({ type: 'success', title: 'App gestartet', body: url, duration: 4000 } as Omit<Toast, 'id'>)
            } else {
              setShowModal(false)
            }
            if (openBrowserRef.current && !navigator.userAgent.includes('Electron')) window.open(url, '_blank')
            return
          }
        } catch { /* ignore */ }
      }

      // Fast-fail: check if process already died
      if (pid) {
        try {
          const r = await fetch(`/api/process-status?pid=${pid}`)
          const d = await r.json() as { alive: boolean }
          if (!d.alive) {
            const errMsg = await _readLogError(port ?? allPorts[0] ?? 0)
            _fail(errMsg)
            return
          }
        } catch { /* ignore */ }
      }
    }

    _fail(`Server antwortet nicht auf Port ${allPorts.join(' / ')} (30s Timeout).`)
  }, [])

  // ── triggerDetect — called by Play button or Workshop ─────────────────────

  const triggerDetect = useCallback(async () => {
    const p = projectRef.current
    if (!p?.path) return

    // Already running → just open browser
    if (state.status === 'running' && state.url) {
      if (!navigator.userAgent.includes('Electron')) window.open(state.url, '_blank')
      return
    }

    // Already have a configured cmd in store → launch silently via toast (no modal)
    if (p.appStartCmd) {
      const port = p.appPort ?? guessPort(p.appStartCmd)
      await _doLaunch(p.appStartCmd, port, true)
      return
    }

    // Open modal in detecting state while we run heuristics
    setState({ status: 'detecting', cmd: '', port: undefined, url: undefined, method: null, errorMsg: undefined })
    setShowModal(true)

    const result = await heuristicDetect(p.path, p.appPort)
    if (result) {
      setState({ status: 'ready', cmd: result.cmd, port: result.port, url: result.port ? `http://localhost:${result.port}` : undefined, method: result.method, errorMsg: undefined })
      return
    }

    // Heuristics failed → AI fallback (last resort)
    const aiCmd = await aiDetectStartCmd(p.path, p.appPort)
    if (aiCmd) {
      const port = guessPort(aiCmd, p.appPort)
      setState({ status: 'ready', cmd: aiCmd, port, url: port ? `http://localhost:${port}` : undefined, method: 'ai', errorMsg: undefined })
    } else {
      setState({ status: 'error', cmd: '', port: undefined, url: undefined, method: null, errorMsg: 'Startbefehl konnte nicht ermittelt werden.' })
    }
  }, [state.status, state.url, _doLaunch])

  // ── launch — called when user confirms in modal ───────────────────────────

  const launch = useCallback(async (cmd: string, port: number | undefined, remember: boolean) => {
    const p = projectRef.current
    if (!p) return

    if (remember) {
      updateProject(p.id, { appStartCmd: cmd, ...(port ? { appPort: port } : {}) })
      await writeProjectConfig(p.path, {
        startCmd: cmd,
        port: port ?? null,
        appUrl: port ? `http://localhost:${port}` : null,
        detectedAt: new Date().toISOString(),
        detectionMethod: state.method === 'config' ? 'manual' : (state.method ?? 'manual'),
        retries: 0,
      })
    }

    await _doLaunch(cmd, port)
  }, [state.method, updateProject, _doLaunch])

  // ── retryWithAI — called from error state ─────────────────────────────────

  const retryWithAI = useCallback(async () => {
    const p = projectRef.current
    if (!p?.path) return

    setState(s => ({ ...s, status: 'detecting', errorMsg: undefined, method: null }))

    const aiCmd = await aiDetectStartCmd(p.path, p.appPort)
    if (aiCmd) {
      const port = guessPort(aiCmd, p.appPort)
      // Increment retry counter in config
      await writeProjectConfig(p.path, { retries: 1 }).catch(() => {})
      setState({ status: 'ready', cmd: aiCmd, port, url: port ? `http://localhost:${port}` : undefined, method: 'ai', errorMsg: undefined })
    } else {
      setState(s => ({ ...s, status: 'error', errorMsg: 'KI konnte keinen Startbefehl ermitteln.' }))
    }
  }, [])

  // ── dismissModal ──────────────────────────────────────────────────────────

  const dismissModal = useCallback(() => {
    setShowModal(false)
    setState(IDLE)
  }, [])

  // ── setManualConfig — from gear popover ───────────────────────────────────

  const setManualConfig = useCallback((cmd: string, port: number | undefined) => {
    const p = projectRef.current
    if (!p) return
    updateProject(p.id, { appStartCmd: cmd || undefined, appPort: port })
    setState(IDLE)
    setShowModal(false)
  }, [updateProject])

  return { state, showModal, triggerDetect, launch, retryWithAI, dismissModal, setManualConfig }
}
