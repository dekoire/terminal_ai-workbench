# Codera AI — Testing Guide

## 1. TypeScript — immer zuerst
```bash
cd cc-ui && npx tsc --noEmit
```
**Pflicht nach jeder Änderung.** Kein Output = alles OK.

## 2. Dev-Server starten
```bash
cd cc-ui && npm run dev   # → http://localhost:4321
```
**Wichtig**: Port 4321 verwenden. Chrome blockt bekannte Ports:
- 6000 (X11), 6665–6669 (IRC), 25 (SMTP), 587 usw.

## 3. Visuelle Verifikation (Preview-Tools)

```
preview_start       → Server starten
preview_screenshot  → Layout-Check (visuell)
preview_snapshot    → Text/Struktur-Check (Accessibility-Tree)
preview_console_logs → JS-Fehler prüfen (level: 'error')
preview_inspect     → CSS-Werte prüfen
```

### Workflow für UI-Änderungen:
1. `preview_start` → `preview_eval: window.location.reload()`
2. `preview_console_logs` (level: error) — keine Fehler?
3. `preview_screenshot` — sieht es richtig aus?
4. `preview_snapshot` — stimmt der Text/Inhalt?

## 4. Interaktions-Tests

```
preview_click   → Buttons, Links, Tabs
preview_fill    → Input-Felder
```

Danach `preview_snapshot` um Ergebnis zu prüfen.

## 5. Terminal-Funktionalität testen

1. Neue Session erstellen (Modal öffnen, Alias auswählen, Start)
2. Prüfen ob Terminal-Pane erscheint (nicht leer)
3. Nach ~600ms: Alias-Befehl sollte automatisch eingetippt worden sein
4. `aliasCmd`-Bar über dem Terminal zeigt korrekten Befehl?
5. Für Shell-Aliases (cc-mini etc.): Shell-Prompt kurz sichtbar, dann Alias startet

## 6. Store-Persistenz testen

- App schließen/neu laden → State noch vorhanden?
- `~/.cc-ui-data.json` prüfen: `cat ~/.cc-ui-data.json | python3 -m json.tool | head -30`

## 7. Playwright (E2E, bei Bedarf)

Playwright ist installiert. Chromium-Binary:
```
/Users/naelahmed/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/
Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing
```

Für Fehler-Debugging:
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

## 8. Checklist vor Fertigstellung

- [ ] `npx tsc --noEmit` — keine Fehler
- [ ] `preview_screenshot` — Layout korrekt
- [ ] `preview_console_logs` — keine JS-Fehler
- [ ] Betroffene Interaktion per `preview_click`/`preview_fill` getestet
- [ ] Bei Store-Änderung: Persistenz geprüft
- [ ] Bei Terminal-Änderung: Neue Session mit Alias getestet
