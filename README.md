# Tikway documentation

Mintlify documentation for Tikway. Navigation and redirects are configured in `docs.json`.

## Directory structure

```text
zh/ and en/
  introduction.mdx
  quickstart.mdx
  guides/                 Authentication, errors, and protocol conversion
  protocols/              Protocol guides and request examples
  api-reference/          Model overviews, usage guides, and voice lists
openapi/
  zh/ and en/
    chat/                 OpenAI, Anthropic, and Gemini specifications
    images/               Image specifications; Midjourney has its own folder
    videos/               Video specifications
    speech/               Speech generation specifications
    transcriptions/       Speech recognition specifications
    embeddings/           Embedding specifications
    decisions/            Decision specifications
    utilities/            Balance and conversion specifications
assets/                   Shared documentation assets
scripts/                  Documentation maintenance and checks
style.css                 Site styles and page-specific layouts
```

## Naming and URLs

- Use lowercase English names with hyphens. Keep provider names consistent: `openai`, `happyhorse`, `midjourney`, `gpt-image`, and `novelai`.
- Page URLs follow their MDX paths, without the extension. For example, `zh/api-reference/images/overview.mdx` is served at `/zh/api-reference/images/overview`.
- OpenAPI JSON files live under `openapi/<language>/<category>/`. They describe real HTTP endpoints; changing a documentation URL must not change the API request path.
- Each OpenAPI operation has an explicit `x-mint.href`, such as `/zh/api-reference/videos/seedance/create`. This keeps URLs stable when translated summaries or tags change.
- Preserve localized navigation labels with `x-mint.metadata.sidebarTitle`.
- When moving a published page or specification, update internal links, navigation, page-scoped CSS, and references in `../ai-forward-web`. Add its old URL to `docs.json` redirects.
- Old paths appear only in redirect sources. Existing unlisted pages and combined specifications remain available as source material; they are not automatically added to navigation.

## Preview and validation

```bash
mint dev --no-open
mint validate
mint broken-links
node scripts/check-routes.mjs
```

The route check validates navigation targets, API operation URLs, redirect destinations, and documentation links in the adjacent web project. It also rejects references that still point to a redirect source.

After changing web references, run `pnpm build` and `pnpm exec vue-tsc --noEmit` in `../ai-forward-web`. Report unrelated existing type errors separately.
