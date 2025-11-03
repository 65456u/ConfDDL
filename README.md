# Conference Deadline Dashboard

ConferenceDDL is a single-page Next.js application that keeps track of upcoming submission deadlines for leading AI, ML, robotics, and computing conferences. It surfaces countdown timers, sortable tables, and grouped views so it is easy to plan paper submissions at a glance.

## Features
- Live countdown timers for recurring, non-rolling deadlines with automatic year rollover.
- Sort by default ordering, research area, acronym, deadline, countdown, or location.
- Toggle between a combined list and a sectioned layout grouped by research area.
- Quick navigation links to conference websites, submission portals, and map searches for event locations.
- Strictly typed conference catalog (`data/conferences.ts`) to prevent category typos and keep the UI stable.

## Tech Stack
- Next.js 16 (App Router + Turbopack)
- React 19 with client components
- TypeScript 5
- Tailwind CSS 4 (utility-first styling via `@import "tailwindcss";`)

## Repository structure
- `app/` – Application entrypoints, layout, global styles, and the main deadlines view.
- `data/conferences.ts` – Typed conference metadata and ordering helpers.
- `public/` – Static assets (favicons, images).
- `next.config.ts`, `tsconfig.json`, `eslint.config.mjs` – Build, typechecking, and linting configuration.

## Prerequisites
- Node.js 20 LTS (Next.js 16 requires ≥18.18; 20 is recommended).
- `pnpm` (uses the included `pnpm-lock.yaml`; install via `corepack enable` if needed).

## Local development
```bash
pnpm install       # install dependencies
pnpm dev           # start the local dev server on http://localhost:3000
```

Turbopack provides fast refresh and type-checking feedback in the terminal. When you are ready to ship or want to validate a production build locally:

```bash
pnpm build         # create an optimized production build
pnpm start         # serve the production bundle
```

Linting is available with:

```bash
pnpm lint
```

## Updating conference data
Conference information lives in `data/conferences.ts`.
- Add new entries to the `conferences` array. Each item must conform to the `Conference` interface.
- Use the `"area"` field to categorize a conference. To add a brand-new area, extend the `areaOrder` array so it participates in the primary ordering.
- Set `isRolling: true` and omit `deadline` for rolling submissions such as journals.
- `RecurringDeadline` assumes annual cadence and automatically rolls over to the next year if a date has passed.

After editing the data file, run `pnpm lint` or `pnpm build` to ensure types and formatting still pass.

## Deployment
Vercel is the recommended hosting platform and requires no additional configuration.

1. Push the repository to a Git provider (GitHub, GitLab, or Bitbucket).
2. In the Vercel dashboard choose **Add New → Project**, import the repo, and let Vercel detect the Next.js preset.
3. Keep the defaults:
   - Root directory: `/`
   - Install command: `pnpm install`
   - Build command: `pnpm build`
   - Output directory: `.next`
4. Start the deployment. Vercel installs dependencies with pnpm 10 and runs `pnpm build`. The fonts bundled through `next/font` require outbound network access, which is available in Vercel builds.
5. Promote the generated preview deploy to production (or push to your main branch for an automatic production deploy).

### CLI alternative
If you prefer the terminal:
```bash
pnpm dlx vercel login   # authenticate once
pnpm dlx vercel         # link the project and create a preview deployment
pnpm dlx vercel --prod  # ship the current commit to production
```

## Environment variables
No runtime configuration is required at the moment. If you introduce secrets (API keys, analytics, etc.), add them in the Vercel project settings or via `vercel env`.

## Troubleshooting
- **Fonts fail during local builds**: The project relies on the hosted Geist font family. Ensure your development machine has internet access when running `pnpm build`. In disconnected environments you can swap to a self-hosted font in `app/layout.tsx`.
- **TypeScript errors for new areas**: Extend `areaOrder` in `data/conferences.ts` so the new area is part of the allowed union type.
- **Build scripts blocked on Vercel**: If you introduce dependencies that need install scripts (e.g., `sharp`), approve them with `pnpm approve-builds` locally and commit the generated policy file.

---
Feel free to open issues or submit pull requests to expand the conference catalog or improve the UI.
