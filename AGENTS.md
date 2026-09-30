# Repository Guidelines

## Project Structure

- `src/` contains the Vite + TypeScript application. `src/main.ts` coordinates loading, routing, interaction, and rendering.
- `src/timeline/` contains the SVG timeline renderer; `src/ui/` contains topic navigation, chapters, search, cards, and the relationship graph.
- `pipeline/` is the content source of truth: shared people live in `pipeline/registry/people/`, while topic composition lives in `pipeline/topics/<id>/topic.json`.
- `public/data/` contains generated runtime JSON and must not be edited by hand.
- `cards/` contains research drafts and source-oriented person notes; these are not compiled directly into the site.
- `pipeline/PLAYBOOK.md` is the content style guide: 收录席位、生卒 accuracy、关系、章节文案、polity 归属口径。Editing anyone's registry file means reading it first.
- `docs/` contains the product and data-model design specification.

## Build, Test, and Development

Install dependencies with `npm install`. Use:

```bash
npm run dev            # Start the Vite development server
npm run content        # Compile pipeline sources into public/data/
npm run content:check  # Validate pipeline output without rewriting files
npm run build          # Type-check app and pipeline, validate content, and build dist/
npm run preview        # Serve the production build locally
```

After changing content, edit `pipeline/` and run `npm run content`; review generated JSON in the same change.

## Coding Style and Naming

Use TypeScript with two-space indentation, semicolons, single quotes, and explicit types for public interfaces. Keep modules focused and prefer small pure rendering/helper functions. Use `camelCase` for variables and functions, `PascalCase` for types, and stable kebab-case ASCII IDs for people, topics, events, and relations (for example `han-wudi`). Escape user/data text before inserting it into SVG or HTML.

## Testing and Validation

There is no separate test framework. `npm run content:check` is the content/schema validation gate, and `npm run build` is the required full verification. For UI changes, run the dev server and manually check deep links, chapter switching, zoom/pan, search, cards, relationship graph, and PNG/SVG export.

## Commits and Pull Requests

Use concise imperative commit subjects. Existing history commonly uses Conventional Commit-style scopes, such as `feat(xizhou): publish ...`; follow that style for new work when practical. Pull requests should explain the user-visible change, list validation commands, call out content or schema changes, and include screenshots or a short recording for visual changes.

## Content and Data Rules

Keep each person’s canonical life dates and sources in one registry file. Use signed years for BCE dates and preserve accuracy states (`exact`, `approx`, `disputed`, `unknown`). Add relations only when they have a meaningful note and keep topic overlays limited to lane, ordering, and topic-specific copy.

Dynasty/polity is **not** derived from life dates: `pipeline/vocab/polities.json` has no year ranges and the compiler copies the registry value verbatim, so a wrong attribution passes every check. Read `pipeline/PLAYBOOK.md` (《polity 的归属口径》) before filling it. Polity records narrative affiliation, not birth era — a founder's pre-dynasty years take the later dynasty id (刘邦 → `han`, 铁木真 → `yuan`, 努尔哈赤 → `qing`), and multi-value `polity` is reserved for people who occupy two distinct threads (朱元璋 → `["yuan","ming"]`). Cross-dynasty presence is expressed by one registry entry appearing in several `topic.json` files; topic overlays cannot override `polity` or life dates.
