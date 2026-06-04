# Mobile Responsive Design

**Date:** 2026-06-04
**Status:** Approved

## Summary

Make the Websidian web app fully responsive for phone and tablet, with full feature parity to desktop. Simultaneously componentize the largest files and extract reusable UI primitives where the mobile work naturally warrants it.

## Goals

- Phone (375–430px) and tablet (768–1199px) both work well
- Full feature parity — editing, navigation, search, note graph, drag-and-drop
- Single codebase — no mobile-specific app or component variants
- Componentize `Sidebar.tsx` and `App.tsx` as part of the work
- Extract three new UI primitives: `Drawer`, `IconButton`, `Toolbar`

## Approach

Single-source adaptive: existing components become responsive via a `useBreakpoint()` hook. CSS handles visual sizing; the hook handles behavioral branching (drawer vs. persistent sidebar, toolbar visibility, orientation-aware layout).

## Breakpoints

| Name | Range | Notes |
|---|---|---|
| mobile | < 768px | phone |
| tablet | 768–1199px | iPad, Android tablet |
| desktop | ≥ 1200px | unchanged |

Orientation: `(orientation: portrait)` / `(orientation: landscape)` media query.

## Section 1 — `useBreakpoint()` Hook

**File:** `apps/web/src/hooks/useBreakpoint.ts`

Uses `window.matchMedia` listeners (not ResizeObserver polling). Returns:

```ts
interface Breakpoint {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isPortrait: boolean
  isLandscape: boolean
}
```

This is the single source of truth for all responsive behavior. No inline `window.innerWidth` checks anywhere in the app.

## Section 2 — Layout & Navigation

**New files:** `apps/web/src/components/AppLayout.tsx`, `apps/web/src/components/TopBar.tsx`
**Modified:** `apps/web/src/App.tsx`

### AppLayout

Owns the sidebar + editor split. Reads `useBreakpoint()` to determine layout mode:

- **Mobile / portrait tablet**: Full-screen editor. Sidebar lives inside a `Drawer` (slides in from left). Drawer toggled by hamburger button in `TopBar`. Swipe-to-dismiss via pointer events on the overlay.
- **Landscape tablet / desktop**: Persistent sidebar + editor side by side (existing layout, unchanged).

### TopBar

Extracted from `App.tsx`. Renders context-appropriate controls:
- Mobile: hamburger button, note title, search icon, preview toggle icon
- Desktop: project switcher, search, presence bar (existing)

### App.tsx

Slims down to: auth gating + `ProjectContext` provider + `<AppLayout />`. All layout logic moves into `AppLayout`.

## Section 3 — Sidebar Componentization

**Existing:** `apps/web/src/components/Sidebar.tsx` (561 lines → thin shell)
**New files:**
- `apps/web/src/components/sidebar/SidebarHeader.tsx` — project name, new note/folder buttons, import dropdown
- `apps/web/src/components/sidebar/SidebarFileTree.tsx` — DnD-enabled recursive file tree
- `apps/web/src/components/sidebar/SidebarFooter.tsx` — settings link, bottom actions

`Sidebar.tsx` becomes a thin shell composing these three. DnD context and state stay at the `Sidebar` level; sub-components receive handlers as props.

**Mobile touch targets:** `SidebarFileTree` items get `min-height: 44px` (Apple HIG minimum) via CSS. No behavioral change.

## Section 4 — Markdown Formatting Toolbar

**New files:** `apps/web/src/components/MarkdownToolbar.tsx`, `apps/web/src/lib/markdown-toolbar.ts`

Renders on phone and portrait tablet when the editor is focused. Fixed bar above the virtual keyboard:

```css
position: fixed;
bottom: env(safe-area-inset-bottom);
```

**Buttons:** Bold, Italic, Heading, `[[wikilink]]`, `[](link)`, inline code, horizontal rule.

Each button calls `formatMarkdown(view, action)` from `lib/markdown-toolbar.ts`, which dispatches a CodeMirror transaction that wraps the selection or inserts at cursor.

Hidden on desktop and landscape tablet (`isMobile || (isTablet && isPortrait)`).

The editor container adds `padding-bottom` equal to the toolbar height when the toolbar is mounted, so content is never obscured by the fixed bar.

## Section 5 — Note Graph Touch Gestures

**Modified:** `apps/web/src/components/NoteGraph.tsx`

Uses raw pointer events (no library) — pointer events handle both mouse and touch.

- **Pan**: single-finger `pointermove` delta → translate transform
- **Pinch-to-zoom**: track two `pointerId`s, compute distance between `pointermove` positions, map delta to zoom scale

Gesture-derived scale and translate feed into the existing zoom/pan state the component already tracks.

## Section 6 — UI Primitive Extraction

**New files in `apps/web/src/components/ui/`:**

| Component | Description |
|---|---|
| `drawer.tsx` | Slide-in panel built on Radix Dialog. Used by mobile sidebar. |
| `icon-button.tsx` | Icon-only button, minimum 44×44px touch target. |
| `toolbar.tsx` | Horizontal action row with consistent spacing and dividers. Used by `MarkdownToolbar`. |

Only primitives directly needed by this feature — no speculative additions.

## File Change Summary

| File | Change |
|---|---|
| `hooks/useBreakpoint.ts` | New |
| `components/AppLayout.tsx` | New |
| `components/TopBar.tsx` | New (extracted from App.tsx) |
| `components/MarkdownToolbar.tsx` | New |
| `components/sidebar/SidebarHeader.tsx` | New (extracted from Sidebar.tsx) |
| `components/sidebar/SidebarFileTree.tsx` | New (extracted from Sidebar.tsx) |
| `components/sidebar/SidebarFooter.tsx` | New (extracted from Sidebar.tsx) |
| `lib/markdown-toolbar.ts` | New |
| `components/ui/drawer.tsx` | New |
| `components/ui/icon-button.tsx` | New |
| `components/ui/toolbar.tsx` | New |
| `App.tsx` | Refactored — layout logic moves to AppLayout |
| `components/Sidebar.tsx` | Refactored — becomes thin shell |
| `components/NoteGraph.tsx` | Modified — add pointer event gestures |

## Out of Scope

- Native mobile app (React Native / Expo)
- Offline support / PWA
- Push notifications
- Mobile-specific onboarding flow
