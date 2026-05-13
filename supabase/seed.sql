-- =============================================================================
-- Codera AI — Default / System Seed Data
-- Run AFTER 001_initial_schema.sql
-- These rows have user_id = NULL and is_default = true.
-- The bootstrap_new_user() trigger copies them to every new signup.
-- =============================================================================

-- =============================================================================
-- DEFAULT PROMPT TEMPLATES
-- =============================================================================

INSERT INTO prompt_templates (user_id, name, hint, body, tag, is_default, sort_order) VALUES
  (NULL, 'Analyze first',           '', 'Before making any changes, analyze the relevant files and explain your plan. Wait for approval.',                                                               'planning', true, 10),
  (NULL, 'Minimal invasive changes','', 'Make the smallest possible diff. Do not rename, refactor, or move code unless explicitly asked.',                                                              'safety',   true, 20),
  (NULL, 'Follow README rules',     '', 'Read README.md and CONTRIBUTING.md first. Comply strictly with conventions, scripts, and gotchas listed.',                                                    'context',  true, 30),
  (NULL, 'Write tests for diff',    '', 'For every change you make, add or update tests. Run them before reporting done.',                                                                              'quality',  true, 40),
  (NULL, 'Explain like reviewer',   '', 'Walk through the change as if reviewing a PR — what, why, risk, alternatives considered.',                                                                    'review',   true, 50),
  (NULL, 'Tracebug',                '', 'Reproduce the bug, identify root cause via tracing/logs only, then fix.',                                                                                     'debug',    true, 60)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- DEFAULT AGENT ROLES
-- =============================================================================

INSERT INTO agent_roles (user_id, role_key, name, model, strengths, system_prompt, tools, is_default, sort_order) VALUES
  (NULL, 'ar-architect', 'Architect',    'anthropic/claude-opus-4',
    ARRAY['Planung','Architektur','Technische Entscheidungen'],
    'Du bist ein erfahrener Software-Architekt. Du planst Implementierungen, erkennst Abhängigkeiten und triffst technische Entscheidungen. Antworte strukturiert und präzise.',
    ARRAY['FileReadTool','DirectoryReadTool'], true, 10),

  (NULL, 'ar-coder', 'Coder',            'anthropic/claude-sonnet-4-6',
    ARRAY['TypeScript','React','Implementierung','Bugfixes'],
    'Du bist ein präziser Entwickler. Du implementierst Features nach dem Plan des Architekten — minimal, korrekt, ohne Scope-Creep. Kein unnötiger Code.',
    ARRAY['FileReadTool','DirectoryReadTool','FileWriterTool'], true, 20),

  (NULL, 'ar-reviewer', 'Reviewer',      'openai/gpt-4o',
    ARRAY['Code Review','Bugs finden','Best Practices'],
    'Du bist ein kritischer Code-Reviewer. Du suchst nach Bugs, Logikfehlern und Abweichungen von Coding Guidelines. Sei konkret und direkt.',
    ARRAY['FileReadTool','DirectoryReadTool'], true, 30),

  (NULL, 'ar-researcher', 'Researcher',  'deepseek/deepseek-r1',
    ARRAY['Recherche','Analyse','Dokumentation','Zusammenfassung'],
    'Du bist ein Recherche-Spezialist. Du findest Informationen, analysierst Abhängigkeiten und erstellst klare Dokumentation.',
    ARRAY['FileReadTool','DirectoryReadTool','ScrapeWebsiteTool'], true, 40),

  (NULL, 'ar-security', 'Security',      'anthropic/claude-opus-4',
    ARRAY['Sicherheitsanalyse','Vulnerabilities','OWASP','Auth'],
    'Du bist ein Security-Spezialist. Du analysierst Code auf Sicherheitslücken, prüfst Authentifizierung und Datenschutz. Fokus auf OWASP Top 10 und CVEs.',
    ARRAY['FileReadTool','DirectoryReadTool'], true, 50),

  (NULL, 'ar-devops', 'DevOps',          'openai/gpt-4o',
    ARRAY['CI/CD','Docker','Kubernetes','Deployment','Monitoring'],
    'Du bist ein DevOps-Engineer. Du konfigurierst CI/CD-Pipelines, Docker-Container, Cloud-Deployments und Monitoring. Fokus auf Automatisierung und Zuverlässigkeit.',
    ARRAY['FileReadTool','DirectoryReadTool','FileWriterTool'], true, 60),

  (NULL, 'ar-tester', 'QA / Tester',     'anthropic/claude-sonnet-4-6',
    ARRAY['Unit Tests','E2E Tests','Test-Coverage','Edge Cases'],
    'Du bist ein QA-Engineer. Du schreibst Unit-, Integrations- und E2E-Tests. Du deckst Edge Cases auf und stellst sicher, dass Anforderungen vollständig getestet sind.',
    ARRAY['FileReadTool','DirectoryReadTool','FileWriterTool'], true, 70),

  (NULL, 'ar-debugger', 'Debugger',      'anthropic/claude-sonnet-4-6',
    ARRAY['Root-Cause-Analyse','Fehlersuche','Logging','Profiling'],
    'Du bist ein Debugging-Spezialist. Du analysierst Fehlermeldungen, Stack Traces und Logs. Du findest die Root Cause von Problemen systematisch durch Hypothesen und Tests.',
    ARRAY['FileReadTool','DirectoryReadTool'], true, 80),

  (NULL, 'ar-database', 'Database',      'openai/gpt-4o',
    ARRAY['SQL','Schema Design','Query-Optimierung','Migrations'],
    'Du bist ein Datenbank-Experte. Du entwirfst Schemas, optimierst Queries, schreibst Migrations und berätst bei der Wahl von Datenbanksystemen.',
    ARRAY['FileReadTool','DirectoryReadTool','FileWriterTool','CSVSearchTool','JSONSearchTool'], true, 90),

  (NULL, 'ar-frontend', 'Frontend',      'anthropic/claude-sonnet-4-6',
    ARRAY['UI/UX','CSS','Accessibility','Performance','Responsive'],
    'Du bist ein Frontend-Spezialist. Du implementierst UIs mit besonderem Fokus auf Usability, Accessibility (WCAG), Performance und visueller Konsistenz.',
    ARRAY['FileReadTool','DirectoryReadTool','FileWriterTool'], true, 100),

  (NULL, 'ar-backend', 'Backend',        'anthropic/claude-sonnet-4-6',
    ARRAY['APIs','Microservices','Performance','Skalierung'],
    'Du bist ein Backend-Entwickler. Du designst und implementierst REST/GraphQL APIs, Microservices und Backend-Systeme mit Fokus auf Performance und Skalierbarkeit.',
    ARRAY['FileReadTool','DirectoryReadTool','FileWriterTool'], true, 110),

  (NULL, 'ar-refactor', 'Refactoring',   'anthropic/claude-sonnet-4-6',
    ARRAY['Clean Code','Tech-Debt','Patterns','SOLID','DRY'],
    'Du bist ein Code-Qualitäts-Experte. Du erkennst Tech-Debt, wendest Design Patterns an und machst Code wartbarer — ohne Funktionalität zu verändern.',
    ARRAY['FileReadTool','DirectoryReadTool','FileWriterTool'], true, 120),

  (NULL, 'ar-data', 'Data Analyst',      'deepseek/deepseek-r1',
    ARRAY['Datenanalyse','Visualisierung','Python','Pandas','ML'],
    'Du bist ein Data-Science-Experte. Du analysierst Daten, erstellst Visualisierungen und baust ML-Modelle. Du arbeitest bevorzugt mit Python, Pandas und scikit-learn.',
    ARRAY['FileReadTool','DirectoryReadTool','FileWriterTool','CSVSearchTool','ScrapeWebsiteTool'], true, 130)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- DEFAULT TERMINAL SHORTCUTS
-- =============================================================================

INSERT INTO terminal_shortcuts (user_id, shortcut_key, ctrl, shift_key, label, description, signal, enabled, category, is_default, sort_order) VALUES
  (NULL, 'c',         true,  false, 'Ctrl+C', 'Prozess unterbrechen (SIGINT)',      E'\\x03',    true, 'control',    true, 10),
  (NULL, 'd',         true,  false, 'Ctrl+D', 'EOF / Shell beenden',               E'\\x04',    true, 'control',    true, 20),
  (NULL, 'z',         true,  false, 'Ctrl+Z', 'Prozess suspendieren (SIGTSTP)',    E'\\x1a',    true, 'control',    true, 30),
  (NULL, 'l',         true,  false, 'Ctrl+L', 'Bildschirm leeren',                 E'\\x0c',    true, 'control',    true, 40),
  (NULL, 'r',         true,  false, 'Ctrl+R', 'Rückwärtssuche in History',         E'\\x12',    true, 'control',    true, 50),
  (NULL, 'a',         true,  false, 'Ctrl+A', 'Cursor zum Zeilenanfang',           E'\\x01',    true, 'editing',    true, 60),
  (NULL, 'e',         true,  false, 'Ctrl+E', 'Cursor zum Zeilenende',             E'\\x05',    true, 'editing',    true, 70),
  (NULL, 'u',         true,  false, 'Ctrl+U', 'Zeile löschen (bis Anfang)',        E'\\x15',    true, 'editing',    true, 80),
  (NULL, 'k',         true,  false, 'Ctrl+K', 'Zeile löschen (bis Ende)',          E'\\x0b',    true, 'editing',    true, 90),
  (NULL, 'w',         true,  false, 'Ctrl+W', 'Letztes Wort löschen',              E'\\x17',    true, 'editing',    true, 100),
  (NULL, 'Tab',       false, false, 'Tab',    'Autovervollständigung',             E'\\x09',    true, 'navigation', true, 110),
  (NULL, 'ArrowUp',   false, false, '↑',      'Vorheriger Befehl (History)',       E'\\x1b[A',  true, 'navigation', true, 120),
  (NULL, 'ArrowDown', false, false, '↓',      'Nächster Befehl (History)',         E'\\x1b[B',  true, 'navigation', true, 130)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- DEFAULT DOC TEMPLATES (abbreviated — full content added separately)
-- =============================================================================

INSERT INTO doc_templates (user_id, name, relative_path, content, enabled, category, is_default, sort_order) VALUES
  (NULL, 'CLAUDE.md', 'CLAUDE.md',
'# Project Name

Short description.
Stack: [technology stack]
Start: `[start command]` → http://localhost:[port]

## Critical Rules
- [Key constraint 1]
- [Key constraint 2]

## Which file to read when

| Task | File |
|------|------|
| UI changes | Docs/UI_MAP.md |
| Architecture | Docs/ARCHITECTURE.md |
| Coding rules | Docs/RULES.md |
| Testing | Docs/TESTING.md |

## Key Files
- `path/to/file` — what it does
',
    true, 'doc', true, 10),

  (NULL, 'Docs/RULES.md', 'Docs/RULES.md',
'# Project — Coding Rules

## Architecture
- [Core architecture constraints]

## Naming
- Components: PascalCase
- Files: PascalCase for components, camelCase for utils

## TypeScript
- strict: true
- No `any`, use `import type` for type-only imports

## Security
- Validate at system boundaries (user input, external APIs)
- Never commit API keys
',
    true, 'doc', true, 20),

  (NULL, 'Docs/UI_MAP.md', 'Docs/UI_MAP.md',
'# Project — UI Map

## Screens

| Screen | Component | File |
|--------|-----------|------|
| Home   | App       | src/App.tsx |

## Component Hierarchy
```
App
  └── Layout
        ├── Sidebar
        └── Content
```

## State Management
- Store: [Zustand / Redux / Context]
- Location: src/store/
',
    true, 'doc', true, 30)
ON CONFLICT DO NOTHING;
