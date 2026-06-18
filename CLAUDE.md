# Balin Inventory Portal

## Stack
Angular 21 | Tailwind CSS 4 | SCSS | Material Icons | Inter font | pnpm

## API
Base: `https://sapi.livetrack24.in/api`

## Rules
- **DRY**: Use global classes from `src/styles.scss` — `.card`, `.btn-primary`, `.form-group`, `.alert-danger`, `.page-header`, `.grid-auto`, `.stat-card`, `.spinner`, `.table`
- **No hardcoded colors/spacing** — use CSS vars: `--color-*`, `--space-*`, `--radius-*`, `--shadow-*`, `--font-*`
- **Standalone components only** — no NgModules
- **Signals** for reactive state — not BehaviorSubject
- **Functional guards/interceptors** — not class-based
- **Lazy load all routes** via `loadComponent`
- **Preload fonts** — prevent FOIT for Material Icons

## Structure
```
src/app/core/       — singletons (services, interceptors, guards, constants)
src/app/features/   — lazy-loaded pages (one dir per route)
src/app/layout/     — shell, sidebar, topbar
src/app/shared/     — models, services, pipes, reusable UI
```

## Reference
KoderGps: `/Users/gautamsharma/Documents/anti-gravity/KoderGps/` — same API, adapt models/patterns from here
