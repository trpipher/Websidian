# Tailwind + Shadcn/ui Refactor — Design Spec

**Date:** 2026-06-02
**Scope:** `apps/web` only — replaces all inline `style={{ ... }}` props with Tailwind utility classes and adopts shadcn/ui component primitives where appropriate.

---

## Goals

- Eliminate inline style objects across all 15 components (~2,600 lines affected)
- Replace hand-rolled interactive components (context menus, modals, command palette) with accessible Radix-backed shadcn/ui primitives
- Preserve the existing Catppuccin Mocha visual theme exactly
- Ship as a single all-at-once commit (app is not expected to be functional mid-migration)

---

## 1. Setup & Configuration

### New dependencies

| Package | Purpose |
|---|---|
| `tailwindcss` v3 | Utility class engine |
| `autoprefixer` | PostCSS vendor prefixing |
| `postcss` | PostCSS runner |
| `@tailwindcss/typography` | `prose` class for MarkdownPreview |
| `shadcn/ui` CLI | Scaffolds component files into `src/components/ui/` |
| `@radix-ui/*` | Headless primitives (installed by shadcn automatically) |
| `class-variance-authority` | Variant-based component styling |
| `clsx` + `tailwind-merge` | Class merging utilities |
| `lucide-react` | Icon set (replaces emoji icons in sidebar, buttons) |

### New files

- `apps/web/tailwind.config.js` — theme config with Catppuccin tokens
- `apps/web/postcss.config.js` — Tailwind + autoprefixer
- `apps/web/src/index.css` — CSS variable declarations + base Tailwind directives, imported in `main.tsx`
- `apps/web/src/lib/utils.ts` — `cn()` helper (`clsx` + `tailwind-merge`)
- `apps/web/src/components/ui/` — shadcn-generated component files

### Vite alias

`vite.config.ts` gets a `@` → `./src` path alias (required by shadcn imports).

---

## 2. Color System

### CSS variables (`index.css`)

Shadcn expects HSL channel values (no `hsl()` wrapper). Catppuccin Mocha values:

```css
:root {
  --background:          240 21% 15%;   /* #1e1e2e — base */
  --foreground:          226 64% 88%;   /* #cdd6f4 — text */
  --card:                237 16% 23%;   /* #313244 — surface0 */
  --card-foreground:     226 64% 88%;
  --popover:             237 16% 23%;
  --popover-foreground:  226 64% 88%;
  --primary:             217 92% 76%;   /* #89b4fa — blue */
  --primary-foreground:  240 21% 15%;
  --secondary:           237 16% 23%;
  --secondary-foreground:226 64% 88%;
  --muted:               237 16% 23%;
  --muted-foreground:    233 10% 47%;   /* #6c7086 — subtext0 */
  --accent:              237 16% 23%;
  --accent-foreground:   226 64% 88%;
  --destructive:         343 81% 75%;   /* #f38ba8 — red */
  --destructive-foreground: 240 21% 15%;
  --border:              237 16% 23%;
  --input:               237 16% 23%;
  --ring:                217 92% 76%;
  --radius:              0.375rem;
}
```

### Tailwind config extensions

```js
extend: {
  colors: {
    'ctp-mauve': '#cba6f7',   // purple accent
    'ctp-green': '#a6e3a1',   // success/positive
    'ctp-peach': '#fab387',   // warning/orange
  }
}
```

Tailwind's built-in `green-*` palette remains fully accessible. Catppuccin extras are namespaced as `ctp-*`.

---

## 3. Component Strategy

### Replaced with shadcn primitives

These custom components are deleted and replaced by shadcn-generated equivalents:

| Current file | Shadcn components used | Reason |
|---|---|---|
| `ContextMenu.tsx` | `ui/context-menu` | Radix handles portal, positioning, keyboard nav |
| `SortMenu.tsx` | `ui/dropdown-menu` | Positioned dropdown — same pattern |
| `SearchModal.tsx` | `ui/command` | Command palette is shadcn's purpose-built feature |
| `NewProjectModal.tsx` | `ui/dialog` + `ui/input` + `ui/button` | Form-in-a-dialog |
| `ProjectSettings.tsx` | `ui/dialog` + `ui/input` + `ui/button` + `ui/switch` | Same |

### Kept as custom, styled with Tailwind

Structure and logic unchanged; inline `style={{}}` replaced with Tailwind classes:

| Component | Notes |
|---|---|
| `App.tsx` | Layout shell — flex/grid layout classes |
| `Sidebar.tsx` | DnD logic unchanged; all styles → Tailwind; image item menus switch to shadcn `<ContextMenu>` wrapper pattern |
| `SidebarItem.tsx` | DnD logic unchanged; context menu switches from programmatic x/y API to shadcn's declarative `<ContextMenu>` wrapper pattern |
| `LoginPage.tsx` | Uses `ui/button` for OAuth buttons |
| `PresenceBar.tsx` | Pure Tailwind |
| `NoteGraph.tsx` | D3 canvas — wrapper div only |
| `Editor.tsx` | CodeMirror — wrapper div only |
| `LinksPanel.tsx` | Pure Tailwind |
| `MarkdownPreview.tsx` | `prose` class from typography plugin replaces hand-rolled markdown styles |
| `ProjectSwitcher.tsx` | Pure Tailwind |

### Additional shadcn primitives used across components

`ui/button`, `ui/input`, `ui/badge`, `ui/scroll-area`, `ui/separator`, `ui/tooltip`

---

## 4. Icon Strategy

Lucide React replaces emoji/Unicode icons currently used in the sidebar and buttons (🖼, ✎, ▶, ▼, ▶). Lucide ships with shadcn and provides consistent, scalable SVG icons.

---

## 5. Out of Scope

- No changes to `apps/sync`, `apps/mcp`, or `packages/`
- No changes to routing, data fetching, or business logic
- No visual redesign — goal is identical appearance with cleaner code
- No test suite additions (none currently exist)
