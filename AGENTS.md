# Repository Guidelines

## Project Structure & Module Organization
This repository is a small Next.js App Router project for a conference deadline dashboard.

- `app/`: UI entrypoints and global styles (`layout.tsx`, `page.tsx`, `globals.css`)
- `data/conferences.ts`: typed conference dataset and area ordering used by the UI
- `public/`: static assets (SVGs, favicon)
- Root config: `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`

Keep data updates isolated to `data/conferences.ts` unless UI behavior or rendering needs to change.

## Build, Test, and Development Commands
Use `pnpm` (lockfile and workspace config are committed).

- `pnpm install`: install dependencies
- `pnpm dev`: start local dev server (Next.js) at `http://localhost:3000`
- `pnpm build`: create a production build
- `pnpm start`: run the production build locally
- `pnpm lint`: run ESLint with Next.js + TypeScript rules

Before opening a PR, run at least `pnpm lint` and `pnpm build`.

## Coding Style & Naming Conventions
- Language: TypeScript + React function components
- Formatting: follow existing style (2-space indentation, semicolons, double quotes)
- Components/types: `PascalCase` (`SortIndicator`, `Conference`)
- Variables/functions: `camelCase` (`formatCountdown`, `areaPriority`)
- Constants: `UPPER_SNAKE_CASE` for shared constants (`DEFAULT_AREA_ORDER`)
- Prefer small pure helpers for date/sort logic; keep UI rendering readable

ESLint is configured in `eslint.config.mjs` with `eslint-config-next` (`core-web-vitals` + TypeScript).

## Testing Guidelines
There is currently no automated test framework configured. For now:

- Run `pnpm lint` and `pnpm build` for validation
- Manually verify sorting, grouping, and countdown behavior in `pnpm dev`
- When adding tests later, place them alongside source files or under `tests/` and use `*.test.ts(x)` naming

## Commit & Pull Request Guidelines
Git history shows short, imperative commit messages (for example: `update conference info`, `fix bug for string`). Keep commits focused and descriptive.

For pull requests:

- Summarize user-visible changes and any data updates
- Note manual verification steps (`lint`, `build`, UI checks)
- Include screenshots for UI changes
- Link related issues/tasks when applicable

## Data & Content Updates
Conference deadlines can become stale quickly. When editing `data/conferences.ts`, prefer official CFP pages, and mark inferred dates with `estimated: true` plus a short `note`.
