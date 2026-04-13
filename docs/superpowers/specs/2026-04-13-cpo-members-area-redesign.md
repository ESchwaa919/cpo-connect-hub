# CPO Members Area Redesign — Design Spec

**Date:** 2026-04-13
**Status:** Approved, ready for implementation plan
**Owner:** Erik (product), Rune (orchestrator), cpo-connect worker (implementation)
**Companion spec:** [2026-04-13-cpo-member-identity-resolution.md](./2026-04-13-cpo-member-identity-resolution.md) — bundled in same PR

## Context

Feedback on the CPO Connect Members Area has been shared multiple times and has been dropped between sessions. This spec is the persistent commitment: everything here gets built, and no piece gets quietly omitted.

Erik's direct feedback, captured 2026-04-13:

> "The hero for the Members Area needs to be Search. The tab should be called 'Search Chat' and it should be the first tab. Admin — Ingestion only shows up for me now, and it can move under my initials as a drop down. The main search area needs a design as it's too hard to tell the difference between the tabs, suggested prompts, Search area and Answer. We don't need to see all of the sources, but they can be moved into tooltips, or compressed."

The underlying problems:

1. **Wrong hero.** The Members Area lands on Chat Insights, but Search Chat is the more valuable day-to-day tool. New visitors never see the search as the primary utility.
2. **Weak visual hierarchy.** On the current Search Chat page (`/members/whats-talked`), tabs, suggested prompts, search input, and answer all read at roughly the same visual weight, so users can't tell where to look.
3. **Inconsistent nav.** Admin-only `Admin · Ingestion` sits as a top-nav link instead of being tucked under the avatar where user/admin actions conventionally live.
4. **Sources overwhelm the answer.** The current `SourceCard` renders full cards for every citation, eating more screen real estate than the answer itself.
5. **Inconsistent channel selector styling** between Chat Insights and Search Chat — two different looks for what is conceptually the same "which channels am I scoping to?" control.

## Goals

- Make **Search Chat** the hero of the Members Area experience.
- Deliver a visually clear Search Chat page where each functional zone (scope / ask / answer / sources) is obviously distinct.
- Unify the channel selector style across the Members Area.
- Move personal/admin actions into the avatar dropdown so the top nav is purely destination navigation.
- Compress sources without losing citation credibility.

## Non-goals (explicit)

- Redesigning Chat Insights beyond the channel-selector unification. Chat Insights stays exactly as-is otherwise.
- Blending Chat Insights and Search Chat into a single feature (see Future Direction).
- Adding new channels, new insight types, or new AI capabilities.
- Changing the URL slug `/members/whats-talked` (stays for bookmark/SEO stability; only the label changes).
- Multi-turn conversational chat (the chat is one-question-one-answer today; evolving it to a conversation is a separate initiative).
- Changing the underlying LLM prompt/response format (keeps inline citation markers out of scope; sources remain below-the-answer, not inline).

## Scope

This is a two-spec effort delivered in one PR:

- **This spec (UI redesign):** Information architecture, Search Chat page layout, source treatment, channel selector unification.
- **Companion spec (member identity resolution):** Phone → canonical name resolution so the redesigned UI never shows raw phone numbers.

Both specs ship together so the redesigned source chips look correct from day one.

## Information architecture

### Top navigation

New top nav order for authenticated members area:

```
Search Chat | Chat Insights | Directory
```

- `Search Chat` — label change only. Route stays `/members/whats-talked`.
- `Chat Insights` — unchanged route and page content.
- `Directory` — unchanged.
- **Profile is removed from the top nav** and moves into the avatar dropdown.
- **Admin · Ingestion is removed from the top nav** and moves into the avatar dropdown, gated on `user.isAdmin === true`.

### Default Members Area landing

When an authenticated user clicks "Members Area" from the landing page, or hits `/members` or `/members/`, they should redirect to `/members/whats-talked` (Search Chat), not `/members/chat-insights`.

Currently in `src/components/Navbar.tsx`:
```tsx
<Link to="/members/chat-insights">Members Area</Link>
```
becomes:
```tsx
<Link to="/members/whats-talked">Members Area</Link>
```

(Find every occurrence; currently appears in both the desktop and mobile nav blocks.)

### Avatar dropdown

The dropdown opened by clicking the `MemberAvatar` (top-right) gets restructured to hold all "me" destinations:

```
┌─────────────────────────┐
│ Erik M. Schwartz        │
│ eschwaa@gmail.com       │
├─────────────────────────┤
│ 👤  Profile             │
│ ⚙️   Admin · Ingestion  │ ← admin-only, conditional render
├─────────────────────────┤
│ 🚪  Sign out            │
└─────────────────────────┘
```

- Profile and Sign out always shown.
- Admin · Ingestion conditionally rendered when `user.isAdmin === true`.
- Dropdown separator (`DropdownMenuSeparator`) between the name/email header, the destinations group, and the Sign out action.
- Icons come from `lucide-react` (already used): `User`, `Settings` (or `ShieldCheck` for admin), `LogOut`.

### Mobile nav

The mobile hamburger menu mirrors the new structure:
- Top section: `Search Chat | Chat Insights | Directory` (the top-nav tabs)
- Bottom section (below the current utilities divider): `Profile`, `Admin · Ingestion` (if admin), install PWA, theme toggle, Sign out

## Search Chat page — visual redesign

The page at `/members/whats-talked` gets a ground-up visual rework using Option A from the design sprint: "Search-first hero."

### Page header

```
Search Chat
Ask the community anything. Semantic search across all WhatsApp
conversations with citations.
```

- `h1`: **Search Chat**
- Subtitle `<p class="text-sm text-muted-foreground">`: the description above.
- Replaces the current playful header `"What's Everyone Talking About?"` with a functional, utility-first header. The playful voice is intentionally dropped — the page's job is now the headline.

### Layout stack (top-to-bottom)

```
┌──────────────────────────────────────────────────────────┐
│ Search Chat                                              │
│ Ask the community anything. Semantic search across all   │
│ WhatsApp conversations with citations.                   │
├──────────────────────────────────────────────────────────┤
│ ╔══════════════════════════════════════════════════════╗ │  ← hero card,
│ ║  In: [All 3 channels ▾]  (multi-select dropdown)    ║ │    blue accent
│ ║                                                      ║ │    border, light
│ ║  ┌──────────────────────────────────────────────┐   ║ │    blue bg,
│ ║  │ What would you like to know?                 │   ║ │    subtle shadow
│ ║  │                                              │   ║ │
│ ║  └──────────────────────────────────────────────┘   ║ │
│ ║                                    0/500  [Ask →]  ║ │
│ ╚══════════════════════════════════════════════════════╝ │
│                                                          │
│ 💡 AI debates  💡 Hiring  💡 Burnout  💡 PM tools        │  ← chip row
│                                                          │    not big tiles
│ ⓘ We may log the text of your questions to improve…     │  ← muted footer,
│                                                          │    small text
│ ┌──────────────────────────────────────────────────────┐ │
│ │ ANSWER                                                │ │  ← neutral card
│ │ Members are mostly weighing Cursor vs Claude Code…   │ │
│ │                                                       │ │
│ │ SOURCES · 3                                          │ │
│ │ 🔗 Sarah · AI · Mar 12   🔗 Marcus · AI · Mar 15   │ │  ← chip row
│ │ 🔗 Priya · AI · Mar 18                              │ │    S1 treatment
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### Hero card (the "Ask" block)

**This card must visually dominate the page.** Specifications:

- **Border**: `border-2 border-primary` (or equivalent blue accent — pull from the theme's primary color)
- **Background**: light blue tint — `bg-primary/5` or a custom `hsl(var(--primary) / 0.04)` equivalent. Adapts to dark mode via `dark:bg-primary/10`.
- **Shadow**: `shadow-md` or `shadow-[0_2px_12px_rgba(var(--primary),0.12)]` for a soft primary-tinted drop shadow.
- **Rounded**: `rounded-xl` (larger than the answer card below).
- **Padding**: generous — `p-6` at md breakpoints, `p-4` on mobile.

Critical rule: **do not let a /simplify pass strip this to a neutral card.** The visual prominence is load-bearing for the "Search is the hero" intent. Comment this in the component with a short note: `// hero card — visual prominence is intentional, do not flatten`.

### Channel scope selector (inside the hero card, at the top)

Option A2 from the design sprint: compact multi-select dropdown.

```
In: [All 3 channels ▾]   multi-select
```

- Small label `"In:"` in muted foreground (text-xs, uppercase tracking).
- Clickable pill: `"All 3 channels"` with a chevron. On click, opens a `DropdownMenu` with checkboxes:
  - `☐ All channels` (default checked)
  - `☐ General`
  - `☐ AI`
  - `☐ Leadership & Culture`
- **Multi-select behavior**: selecting individual channels unchecks "All channels"; checking "All channels" clears individual selections. Selecting zero channels is not allowed (fallback to "All channels").
- Label updates dynamically: `"All 3 channels"`, `"General only"`, `"AI + Leadership"`, `"3 channels"` (when >2 selected but not all).
- **URL param**: `?channel=general` today (single-value) becomes `?channels=general,ai` (comma-separated) or `?channels=all`. Backward-compatible: if `?channel=general` is seen, migrate to `?channels=general` on first interaction. Single-channel links from search results / tiles continue to work.
- **Reusable component**: the dropdown should live at `src/components/members/shared/ChannelScopePicker.tsx` (or similar shared location) because Chat Insights will use it too (see below).

### Ask input

- Large textarea, `h-24` minimum, auto-grow up to `h-48`.
- Placeholder: `"What would you like to know?"` (replaces the current longer placeholder).
- Character counter bottom-left: `{draft.length}/500` — muted text, small.
- Ask button bottom-right: primary color, icon + text (`Send` icon from lucide-react + "Ask").
- Disabled state: rate-limit countdown displayed inline with the button, as today.

### Suggested prompts (below the hero card)

Current implementation renders 4+ big tiles in a grid (`grid sm:grid-cols-2 lg:grid-cols-3`). This competes visually with the hero and dilutes the focus.

New treatment: **single-row chip strip**, horizontally wrapping to additional rows only when the viewport forces it.

- Small muted label: `"Try asking:"` or just `"Suggested prompts"` (pick one, my lean is `"Try asking"` — less formal).
- Chips: each prompt becomes a pill with a tiny icon prefix (`💡` or `Lightbulb` from lucide), text label is just the tile title (the subtitle goes away — too noisy for chips).
- Click behavior unchanged: clicking a chip submits the prompt as a query.
- Styling: `px-3 py-1.5 rounded-full text-sm bg-muted hover:bg-muted/80 border border-transparent hover:border-primary/20`.
- Loading state: skeleton row of 4 chips.
- Empty/error: a single muted line `"Couldn't load suggested prompts — type your own question above."`

### Privacy notice

Today it's a full-width bordered gray bar that competes with the hero. New treatment: **muted single-line footer** below the suggested prompts chip row.

- Text: `"We may log the text of your questions to improve this feature. You can opt out in your profile."`
- Styling: `text-xs text-muted-foreground`, small `Info` icon prefix, no background, no border.
- The opt-out state (when `optedOut === true`) shows a slightly different message or just disappears — existing logic in `PrivacyNotice.tsx` stays.

### Answer card

When `activeQuery.length > 0` and the ask is submitted, the answer panel renders in a neutral card below everything else.

- **Container**: `bg-muted/30`, `border border-border`, `rounded-lg`, `p-6`.
- **Label**: `"ANSWER"` uppercase, tracking-wide, text-xs, muted.
- **Body**: the LLM response rendered as markdown (reuse the existing markdown rendering path).
- **Sources subsection**: separated from the answer body by a dashed top border or `mt-6 pt-4 border-t border-dashed`.

### Sources (Option S1 — chip row with preview)

Sources render as a tight pill-chip row below the answer body, within the same answer card.

**Chip format:**

```
# Author · Channel · Date
```

Examples:
- `# Sarah Jenkins · AI · Mar 12`
- `# Marcus Okonkwo · L&C · Mar 15`
- `# +44 ···· ···999 · General · Mar 18` ← sanitized fallback when no name resolved

**Chip styling:**
- `bg-primary/10 text-primary rounded-full px-3 py-1 text-xs`
- Small link icon prefix (`Link2` or `Hash` from lucide, or a literal `#`).
- `hover:bg-primary/20` + `cursor-pointer`.

**Interaction:**
- **Hover (desktop)** — `Popover` (shadcn/ui) opens a floating preview card showing the message excerpt (first ~300 chars), author, channel, and timestamp.
- **Tap (mobile)** — first tap shows the preview popover, second tap opens the full drawer.
- **Click** — opens a full-context drawer (right-side `Sheet` component from shadcn/ui) showing the source message with surrounding context (optional — if out of scope for this sprint, skip the drawer and let click-behavior be the same as hover, just with a longer-lived popover).

**Data requirements:**
- The `SourceCard` today already has: `authorName`, `channel`, `timestamp`, `excerpt`. All four are needed for the chip + preview. No new API fields required.
- The `authorName` shown in the chip MUST come from the member identity resolution chain (see companion spec). If resolution fails, show the sanitized phone pattern, never the raw phone number.

### Empty / loading / error states

**Empty state** (no query submitted yet):
- Hero card visible as usual
- Suggested prompts chip row visible
- Privacy footer visible
- Answer card area shows a quiet placeholder:
  ```
  ┌─────────────────────────────────────┐
  │ Ask a question above to see answers │
  │ and sources here.                   │
  └─────────────────────────────────────┘
  ```
  Styled as a dashed-border muted box, not a loud card. ~40% opacity compared to a populated answer.

**Loading state** (query submitted, waiting for response):
- Hero card stays exactly as-is with the Ask button disabled
- Answer card renders with a skeleton layout: three animated gray bars for the answer body, an empty chip row placeholder for sources
- Small `"Searching..."` label or subtle spinner in the "ANSWER" label area

**Error state** (ChatAskError):
- Hero card stays as-is (user can try again)
- Answer card gets a red-bordered variant (`border-destructive/40 bg-destructive/5`)
- Error message in plain text
- `Try again` button (primary variant, small)
- Rate-limit countdown (already handled today via `rateLimitWaitSec`) — show `Retry in {n}s` on the button when `isRateLimited === true`

## Chat Insights — minimal touch

Leave Chat Insights exactly as-is except for the channel selector.

**Change:** replace whatever channel switcher Chat Insights currently uses with the shared `ChannelScopePicker` component used on Search Chat. Same component, same look, same behavior.

**Investigation required:** the worker should grep `src/pages/members/ChatInsights.tsx` and `src/components/members/insights/*` for the current channel switcher. If it's tightly coupled to Chat Insights, refactor it out into the shared location. If it's already a standalone component, swap it out for the new shared one.

**Do not make any other changes to Chat Insights.** No spacing tweaks, no copy changes, no card restyling. "It's quite lovely" (Erik's words).

## Acceptance criteria

This spec is "done" when:

1. Top nav reads: `Search Chat | Chat Insights | Directory` on desktop AND mobile
2. Avatar dropdown contains: name/email · Profile · Admin · Ingestion (admin-only) · Sign out, in that order
3. Default `/members` redirects to `/members/whats-talked`, and the "Members Area" CTA on the landing page goes to `/members/whats-talked`
4. The Search Chat page at `/members/whats-talked` renders with:
   - Header "Search Chat" and the new subtitle
   - Hero "Ask" card with blue accent border, light-blue background, shadow, multi-select channel dropdown, large textarea, Ask button
   - Suggested prompts as a chip row (not tiles)
   - Privacy notice as a muted single-line footer
   - Answer card with label, body, and sources chip row
   - Sources chips with hover-preview popovers
5. Channel multi-select works and encodes state as `?channels=a,b,c` in the URL (or `all` / absent = all channels)
6. Chat Insights uses the same `ChannelScopePicker` component, visually identical to Search Chat's
7. The page is accessible: tab order flows logically through hero → prompts → answer → sources; chips are keyboard-focusable with visible focus rings; popovers open on `Enter` or `Space`
8. Mobile (< 768px) works end-to-end: hero card full-width, prompts chips wrap, sources chips wrap, sources preview opens as a bottom sheet (not a popover) for touch UX
9. Dark mode works for every new element (hero accent color, chip colors, popover backgrounds)
10. No raw phone numbers render in any source chip (depends on companion spec shipping in the same PR)
11. `npx tsc --noEmit` passes, all existing tests pass, new tests exist for the scope multi-select and the sources popover

## Out of scope (explicit, to prevent scope creep)

- Multi-turn conversation / chat history across queries
- Inline [1] [2] [3] footnote citations inside the answer text (requires LLM prompt changes — reserved for a future spec)
- Restructuring Chat Insights beyond the channel selector swap
- Adding new suggested prompts / prompt management UI
- Analytics dashboards for search usage
- Server-side rendering / prerendering changes

## Dependencies

- **Companion spec** — [2026-04-13-cpo-member-identity-resolution.md](./2026-04-13-cpo-member-identity-resolution.md) — must ship in the same PR so source chips never show raw phone numbers on day one.

## Future direction (parked, not in this spec)

Long-term, Chat Insights and Search Chat could blend into a single "Insights" destination where members land on the live pulse of the community — curated monthly retrospectives and trending topics alongside a free-form search bar. The current monthly insight cards would become entry points that pre-fill a search query ("show me everything about X"). This would converge the two pages into one surface with two modes of exploration (curated vs ad-hoc), and let the scope dropdown apply to both.

That's a 2-3 sprint effort and deserves its own brainstorm + spec. Parking it here so it doesn't get lost.

## Open questions / risks

- **Preview popover vs drawer for sources**: the spec allows either for the "full context" click path. The worker should start with popover-only (hover/tap shows excerpt; click just keeps the popover open longer) and ship the side-drawer as a fast-follow if it feels warranted. Calling this out so it doesn't get over-engineered in the first pass.
- **Chat Insights channel selector refactor risk**: if the current Chat Insights channel switcher is deeply coupled to its parent, the refactor might be larger than a drop-in swap. The worker should time-box this to 1 hour of investigation; if it balloons, split the unification into a second PR rather than blocking the redesign.
- **Multi-select URL param migration**: existing bookmarks using `?channel=general` must continue to work. The worker must preserve this backward compatibility for at least one release.
