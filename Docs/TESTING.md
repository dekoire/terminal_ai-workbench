# Codera AI — Testing Guide

## 1. Type Check (run after every change)
```bash
cd cc-ui && npx tsc --noEmit
```
No output = all good.

## 2. Dev Server
```bash
cd cc-ui && npm run dev   # → http://localhost:4321
```
**Important**: Use port 4321. Chrome blocks known ports:
- 6000 (X11), 6665–6669 (IRC), 25 (SMTP), 587 etc.

## 3. Visual Verification (Preview Tools)

```
preview_start       → Start server
preview_screenshot  → Layout check (visual)
preview_snapshot    → Text/structure check (Accessibility Tree)
preview_console_logs → Check JS errors (level: 'error')
preview_inspect     → Check CSS values
```

### Workflow for UI changes:
1. `preview_start` → `preview_eval: window.location.reload()`
2. `preview_console_logs` (level: error) — any errors?
3. `preview_screenshot` — does it look right?
4. `preview_snapshot` — is the text/content correct?

## 4. Interaction Tests

```
preview_click   → Buttons, Links, Tabs
preview_fill    → Input fields
```

Then use `preview_snapshot` to verify the result.

## 5. Terminal Functionality Test

1. Create new session (open modal, select alias, start)
2. Verify Terminal Pane appears (not empty)
3. After ~600ms: Alias command should be auto-typed
4. Is `aliasCmd` bar above terminal showing correct command?
5. For Shell Aliases (cc-mini etc.): Shell prompt briefly visible, then alias starts

## 6. Store Persistence Test

- Close/reload app → Is state still there?
- Check `~/.cc-ui-data.json`: `cat ~/.cc-ui-data.json | python3 -m json.tool | head -30`

## 7. Playwright (E2E, if needed)

Playwright is installed. Chromium binary:
```
/Users/naelahmed/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/
Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing
```

For error debugging:
```javascript
// /tmp/check.cjs
const { chromium } = require('/opt/homebrew/Cellar/playwright-cli/0.1.8/libexec/lib/node_modules/@playwright/cli/node_modules/playwright/index.js');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '...' });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type()==='error') errors.push(m.text()) });
  await page.goto('http://localhost:4321');
  await page.waitForTimeout(2000);
  console.log('Errors:', errors);
  await browser.close();
})();
```

## 8. Checklist before done
- [ ] TypeScript: no errors
- [ ] No console errors
- [ ] Core user flows work
- [ ] No regressions in existing features
- [ ] `npx tsc --noEmit` — no errors
- [ ] `preview_screenshot` — layout correct
- [ ] `preview_console_logs` — no JS errors
- [ ] Affected interaction tested via `preview_click`/`preview_fill`
- [ ] For store changes: persistence verified
- [ ] For terminal changes: new session with alias tested