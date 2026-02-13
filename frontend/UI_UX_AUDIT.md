# Chatbot / Report analysis – UI/UX audit

## 1. Audit summary

### Current strengths
- Clear separation: report input, quick actions, messages, cards, input bar.
- Cards are collapsible (expand/collapse per card).
- Empty state when no report: helper text present.
- Error recovery: "Dismiss" and "Retry analysis" in the quick actions bar.

### Friction points and gaps

| Area | Issue |
|------|--------|
| **Cards** | All cards look the same; "Risks" is not visually distinct. No hierarchy between findings and risks. |
| **Card content** | Long content in `<pre>` is dense; bullet lines (e.g. `- item`) are not rendered as a list. |
| **Fallback mode** | Backend sends `_meta.cardsFrom: 'fallback'` but frontend never stores or displays it; user cannot tell when local fallback was used. |
| **Loading** | Only three bouncing dots; no "Analyzing report…" or "Thinking…" text. |
| **Empty state** | Single line, low contrast; easy to miss. |
| **Errors** | "Dismiss" / "Retry" are small and live in the quick actions bar; report failure could use a clearer inline message. |
| **Section label** | "Findings (N)" groups all cards; when Risks is present, count mixes findings and risks. |
| **Spacing** | Cards container is compact; card rows are tight. |

### States covered vs missing
- **Loading**: present (dots only).
- **Empty (no report)**: present (one line).
- **Error (connection/report)**: present (buttons only; no inline banner).
- **Fallback mode**: not exposed in UI.
- **Risks card**: present but not differentiated.

---

## 2. Prioritized improvements

### P0 – High impact, low effort
1. **Differentiate Risks card**: Style the "Risks" card differently (e.g. left border, icon, or label).
2. **Expose fallback mode**: Store `_meta` from response; show a small badge when `cardsFrom === 'fallback'`.
3. **Improve card content readability**: Render content as a list when lines start with `- `; keep spacing and line breaks.

### P1 – UX polish
4. **Loading copy**: Add short text next to dots (e.g. "Analyzing…" / "Thinking…").
5. **Empty state**: Slightly larger, clearer CTA-style message.
6. **Cards section**: Separate "Findings" count from "Risks" when the Risks card exists; improve spacing and grouping.

### P2 – Nice to have
7. **Error banner**: Optional inline alert for report analysis failure (in addition to Retry).
8. **Microcopy**: Unify tone (e.g. "Upload a report" vs "Add report").

---

## 3. Implementation notes (see Chatbot.jsx changes)

- **Risks card**: Detect by `card.id === 'card-risks'` or `card.title === 'Risks'`; apply a distinct wrapper (e.g. border-l-4 border-amber-500, bg-amber-50/50).
- **Fallback**: `const [lastMeta, setLastMeta] = useState(null)`; set from `data._meta` when setting cards; show a small badge above or inside the cards block when `lastMeta?.cardsFrom === 'fallback'`.
- **Card content**: Split content by `\n`; if a line starts with `- `, render as `<ul><li>`. Otherwise keep `<pre>` or `<p>` for short lines.
- **Loading**: Add a `<span>` "Analyzing…" or "Thinking…" next to the dots.
- **Empty state**: Use a small card-like container and slightly larger text for the upload prompt.

---

## 4. Implemented changes (Chatbot.jsx)

- **lastMeta state**: Stored from `data._meta` whenever cards are set; cleared on error.
- **Fallback badge**: When `lastMeta?.cardsFrom === 'fallback'`, a "Local summary" pill is shown next to the "Findings by organ" label.
- **Risks card**: `CardItem` accepts `isRisk`; when true, the card has a left amber border and light amber background.
- **Card content**: If most lines start with `- `, content is rendered as a `<ul>` list for readability; otherwise as `<pre>`.
- **Loading**: "Thinking…" label added next to the bouncing dots.
- **Cards block**: Section title set to "Findings by organ"; container uses `rounded-xl` and slightly more padding.
- **Empty state**: Wrapped in a dashed-border, rounded container with slightly larger text.
