import { chromium } from 'playwright'
import { createServer } from 'http'

const browser = await chromium.launch({ headless: false, args: ['--window-size=1440,900'] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

// Capture console + network errors
const logs = []
page.on('console', m => logs.push({ t: 'console', level: m.type(), text: m.text() }))
page.on('pageerror', e => logs.push({ t: 'pageerror', text: e.message }))
page.on('requestfailed', r => logs.push({ t: 'reqfail', url: r.url(), err: r.failure()?.errorText }))

await page.goto('http://localhost:2002')
await page.waitForLoadState('networkidle')
console.log('READY pid=' + process.pid)

const srv = createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json')

  const body = await new Promise(r => {
    let d = ''; req.on('data', c => d += c); req.on('end', () => r(d))
  })
  const params = body ? JSON.parse(body) : {}

  try {
    if (req.url === '/screenshot') {
      const buf = await page.screenshot()
      res.writeHead(200, { 'Content-Type': 'image/png' })
      res.end(buf); return
    }
    if (req.url === '/click') {
      await page.mouse.click(params.x, params.y)
      await page.waitForTimeout(300)
      res.end(JSON.stringify({ ok: true })); return
    }
    if (req.url === '/type') {
      await page.keyboard.type(params.text, { delay: 30 })
      res.end(JSON.stringify({ ok: true })); return
    }
    if (req.url === '/key') {
      await page.keyboard.press(params.key)
      await page.waitForTimeout(200)
      res.end(JSON.stringify({ ok: true })); return
    }
    if (req.url === '/wait') {
      await page.waitForTimeout(params.ms ?? 1000)
      res.end(JSON.stringify({ ok: true })); return
    }
    if (req.url === '/logs') {
      res.end(JSON.stringify(logs.splice(0))); return
    }
    if (req.url === '/eval') {
      const result = await page.evaluate(params.expr)
      res.end(JSON.stringify({ result })); return
    }
    res.end(JSON.stringify({ routes: ['/screenshot','/click','/type','/key','/wait','/logs','/eval'] }))
  } catch (e) {
    res.writeHead(500)
    res.end(JSON.stringify({ error: String(e) }))
  }
})
srv.listen(2099, () => console.log('Screenshot server on :2099'))
await new Promise(r => setTimeout(r, 60 * 60 * 1000))
await browser.close()
