# History Timeline

An interactive, zoomable timeline of Chinese historical figures and events, covering 2070 BCE to 1949 CE.

- Live site: <https://history.0xenzyme.dev>
- 中文说明：[README.md](README.md)

## Features

- Three catalogs over one entity library: people, military events, and history events.
- Dynasty topics with chapters and lanes.
- Search, shareable deep links, PNG and SVG export, and two skins.

## Quick start

Requires Node.js 22 or newer.

```bash
npm ci
npm run dev            # http://localhost:5180
npm test
npm run format:check
npm run build          # output in dist/
```

## Structure

`content/` holds the Markdown sources, `pipeline/` validates and compiles them, `public/data/` holds the generated JSON that is committed with the sources, `src/` is the canvas application, and `tests/` and `docs/` hold the tests and design notes.

Content rules are written in Chinese: `pipeline/PLAYBOOK.md` for people and `docs/事件线规则.md` for events.

## License

Code is MIT licensed. Original historical copy and structured content are CC BY-SA 4.0. See [LICENSE](LICENSE) and [LICENSE-CONTENT.md](LICENSE-CONTENT.md).
