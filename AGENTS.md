<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Commands (use `bun`, not npm/yarn/pnpm)

| Command         | What it does                                                         |
| --------------- | -------------------------------------------------------------------- |
| `bun dev`       | Dev server on :3000                                                  |
| `bun build`     | Static export to `out/` (see `output: "export"` in `next.config.ts`) |
| `bun lint`      | ESLint (flat config)                                                 |
| `bun format`    | Prettier — write-all                                                 |
| `bun typecheck` | `tsc --noEmit`                                                       |

No tests configured.

## Stack & conventions

- **Next.js 16** — always check `node_modules/next/dist/docs/` before using an API
- **Tailwind v4** — `@tailwindcss/postcss` plugin, CSS-based config (no `tailwind.config.ts`), `@theme inline` and `@custom-variant` directives in `app/globals.css`
- **shadcn/ui** with `base-nova` style — components in `components/ui/`, aliases registered in `components.json`
- **UI primitives:** `@base-ui/react` (Button, Dialog, DropdownMenu, Popover, Tooltip, etc.) wrapped in shadcn-styled components
- **Icons:** `@remixicon/react` (Remix icon library, `Ri*` components)
- **Theme:** `next-themes` with class strategy; press `d` to toggle dark mode
- **Toasts:** `sonner` (`<Toaster />` in root layout)
- **Fonts:** Source Sans 3 (sans), Public Sans (heading), Geist Mono (mono) — loaded via `next/font/google` in `layout.tsx`. Base size: 18px.
- **Formatting:** no semicolons, double quotes, trailing commas, 2-space indent. Prettier auto-sorts Tailwind classes via `prettier-plugin-tailwindcss`.
- **`@/` path alias** maps to repo root (set in `tsconfig.json`)

## Component patterns (from `components/ui/`)

- Named function declarations (not arrow functions)
- `data-slot="component-name"` attribute on root element
- Base UI primitives imported from `@base-ui/react/<component>` and wrapped with `cn()` for styling
- `cva` from `class-variance-authority` for variant props
- No runtime Node.js APIs (static export build)

## Project routes

- `app/page.tsx` — home
- `app/treatment/page.tsx` — treatment route
- `app/verification/` — verification route

## Notes

- No CI workflows exist yet.
