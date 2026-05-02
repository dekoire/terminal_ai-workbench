import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: false, args: ['--window-size=1440,900'] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
await page.goto('http://localhost:2004')
await page.waitForLoadState('networkidle')
console.log('READY pid=' + process.pid)
await new Promise(r => setTimeout(r, 30 * 60 * 1000))
await browser.close()
