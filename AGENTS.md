# Repository Guidelines

## Project Structure

- `src/` contains the Vite + TypeScript application. `src/main.ts` coordinates loading, routing, interaction, and rendering.
- `src/timeline/` contains the SVG timeline renderer; `src/ui/` contains topic navigation, chapters, search, cards, and the relationship graph.
- `pipeline/` compiles content. People live in `content/<topic>/<id>.md`, with an index at `content/<topic>.md`. One person has one file. People already in `content/qin/` stay there, including those also listed in Zhanguo or Han. A shared person migrated later lives in the latest topic named by `polity` when that id is one of their topics; otherwise in the earliest topic, skipping `rujia` when another topic exists. Topic composition stays in `pipeline/topics/<id>/topic.json`. Sixty-one legacy records remain `pipeline/registry/people/*.json` because an explicit profile would fail: they lack `polity`, or an `approx` year has no note. Do not invent those fields to force the move.
- Events are the second entity type, alongside people. They live in `content/events/<id>.md`, with an index at `content/events.md` and a skeleton at `content/_template-event.md`. One event has one file, and the id is global — not prefixed by topic. One entity library feeds two time-ordered catalogs, `military` and `history`, which are filters over it rather than separate entities. Scope is -1600 to 1949. Rules live in `docs/事件线规则.md`; it wins over `PLAYBOOK.md` (which only covers people).
- `public/data/` contains generated runtime JSON and must not be edited by hand.
- `cards/` contains research drafts and source-oriented person notes; these are not compiled directly into the site.
- `pipeline/PLAYBOOK.md` is the content style guide: 收录席位、生卒 accuracy、关系、章节文案、polity 归属口径。Editing anyone's registry file means reading it first.
- `docs/` contains the product and data-model design specification.

## Build, Test, and Development

Install dependencies with `npm install`. Use:

```bash
npm run dev            # Start the Vite development server
npm run people:new -- <topic> <id>  # Scaffold content/<topic>/<id>.md and refresh the index
npm run people:format  # Rewrite person Markdown and the topic index
npm run people:check   # Check person Markdown, the index, and the same person rules as content:check
npm run events:new -- <id>  # Scaffold content/events/<id>.md and refresh the index
npm run events:format  # Rewrite event Markdown and the event index
npm run events:check   # Check event Markdown, the index, and the same event rules as content:check
npm run content        # Compile registry JSON and content Markdown into public/data/
npm run content:check  # Validate pipeline output without rewriting files
npm run build          # Type-check app and pipeline, validate content, and build dist/
npm run preview        # Serve the production build locally
```

After changing content, edit `content/<topic>/`, `content/events/`, or `pipeline/` and run `npm run content`; review generated JSON in the same change. Do not add a second file for a person or event that already has one. Do not hand-edit `content/<topic>.md` or `content/events.md`; run `npm run people:format` or `npm run events:format`.

## Coding Style and Naming

Use TypeScript with two-space indentation, semicolons, single quotes, and explicit types for public interfaces. Keep modules focused and prefer small pure rendering/helper functions. Use `camelCase` for variables and functions, `PascalCase` for types, and stable kebab-case ASCII IDs for people, topics, events, and relations (for example `han-wudi`). Escape user/data text before inserting it into SVG or HTML.

## Testing and Validation

There is no separate test framework. `npm run content:check` is the content/schema validation gate, and `npm run build` is the required full verification. For UI changes, run the dev server and manually check deep links, chapter switching, zoom/pan, search, cards, relationship graph, and PNG/SVG export.

## Commits and Pull Requests

Use concise imperative commit subjects. Existing history commonly uses Conventional Commit-style scopes, such as `feat(xizhou): publish ...`; follow that style for new work when practical. Pull requests should explain the user-visible change, list validation commands, call out content or schema changes, and include screenshots or a short recording for visual changes.

## Content and Data Rules

Keep each person’s canonical life dates and sources in one source file. Use signed years for BCE dates and preserve accuracy states (`exact`, `approx`, `disputed`, `unknown`). Add relations only when they have a meaningful note and keep topic overlays limited to lane, ordering, and topic-specific copy.

Content production has two passes and one compile command. The brief pass puts a person on the axis: add them to `pipeline/topics/<id>/candidates.json`, then write `content/<topic>/<id>.md` (`profile: brief`, identity, life dates, accuracy, sources with `kind`, polity) and a topic lane. The 61 people still in `pipeline/registry/people/` stay JSON until their `polity` or approx-year note is filled from sources. The full pass adds `bio` (the Markdown body, or the JSON field for a legacy file) and relations, then sets `profile: full`. Run `npm run people:format` so new Markdown matches `content/_template.md` and `content/<topic>.md` lists the directory. There is no headcount cap for a topic, a seat, or a chapter. Include everyone who holds a seat and has a citable year anchor; when sources disagree, say so in the birth or death note. `docs/seats/` is an archive of old trials, not the intake queue. `cards/` are research drafts and are not compiled.

Dynasty/polity is **not** derived from life dates: `pipeline/vocab/polities.json` has no year ranges and the compiler copies the registry value verbatim, so a wrong attribution passes every check. Read `pipeline/PLAYBOOK.md` (《polity 的归属口径》) before filling it. Polity records narrative affiliation, not birth era — a founder's pre-dynasty years take the later dynasty id (刘邦 → `han`, 铁木真 → `yuan`, 努尔哈赤 → `qing`), and multi-value `polity` is reserved for people who occupy two distinct threads (朱元璋 → `["yuan","ming"]`). Cross-dynasty presence is expressed by one registry entry appearing in several `topic.json` files; topic overlays cannot override `polity` or life dates.
