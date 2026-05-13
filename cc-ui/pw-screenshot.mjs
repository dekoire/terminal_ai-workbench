import { chromium } from 'playwright'
import { writeFileSync } from 'fs'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
await page.goto('http://localhost:2002')
await page.waitForLoadState('networkidle')
await page.waitForTimeout(1000)
const buf = await page.screenshot({ fullPage: false })
writeFileSync('/tmp/cc-screenshot.png', buf)
console.log('Screenshot saved to /tmp/cc-screenshot.png')
await browser.close()
