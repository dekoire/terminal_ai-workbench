#!/usr/bin/env node
'use strict'

/**
 * Minimal stdio MCP server — Permission Bridge
 *
 * Spawned by Claude via --mcp-config. Receives permission_prompt tool calls,
 * forwards them to the Vite dev server (/api/perm-bridge), waits for user
 * decision from the PermissionDialog UI, and returns the result to Claude.
 *
 * Env vars (set via mcpServers.env in the MCP config):
 *   PERM_SESSION  — WebSocket session ID to target
 *   PERM_PORT     — Vite server port (default 4321)
 */

const http = require('http')

const SESSION = process.env.PERM_SESSION ?? 'default'
const PORT    = parseInt(process.env.PERM_PORT ?? '4321', 10)

const TOOL = {
  name: 'permission_prompt',
  description: 'Prompts the IDE user for permission before Claude executes a tool.',
  inputSchema: {
    type: 'object',
    properties: {
      tool_name:  { type: 'string', description: 'Name of the tool Claude wants to use' },
      tool_input: { type: 'object', description: 'Arguments Claude wants to pass to the tool' },
    },
    required: ['tool_name', 'tool_input'],
  },
}

let seq = 0

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n')
}

async function askBridge(toolName, toolInput, requestId) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ sessionId: SESSION, requestId, toolName, input: toolInput })
    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/perm-bridge',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = ''
      res.on('data', d => { data += d })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch { resolve({ allow: false, message: 'Parse error' }) }
      })
    })
    req.on('error', () => resolve({ allow: false, message: 'Bridge unreachable' }))
    req.write(body)
    req.end()
  })
}

let buf = ''
process.stdin.setEncoding('utf8')

process.stdin.on('data', async (chunk) => {
  buf += chunk
  const lines = buf.split('\n')
  buf = lines.pop() ?? ''

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    let msg
    try { msg = JSON.parse(trimmed) } catch { continue }

    const { id, method, params } = msg

    switch (method) {
      case 'initialize':
        send({ jsonrpc: '2.0', id, result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'permission-bridge', version: '1.0' },
        }})
        break

      case 'notifications/initialized':
        break

      case 'ping':
        send({ jsonrpc: '2.0', id, result: {} })
        break

      case 'tools/list':
        send({ jsonrpc: '2.0', id, result: { tools: [TOOL] }})
        break

      case 'tools/call': {
        const toolName  = params?.arguments?.tool_name  ?? 'Unknown'
        const toolInput = params?.arguments?.tool_input ?? {}
        const requestId = `perm-${SESSION.slice(-6)}-${++seq}`

        const decision = await askBridge(toolName, toolInput, requestId)

        const result = decision.allow
          ? { behavior: 'allow', updatedInput: decision.updatedInput ?? toolInput }
          : { behavior: 'deny',  message: decision.message ?? 'Vom Benutzer abgelehnt' }

        send({ jsonrpc: '2.0', id, result: {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        }})
        break
      }

      default:
        if (id !== undefined) {
          send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' }})
        }
    }
  }
})

process.stdin.on('end', () => process.exit(0))
