# CLAUDE.md

This file provides guidance to Claude Code when working with the postal-mime documentation site.

## Project Overview

This is a Docusaurus 3.x documentation site for postal-mime, an email parsing library for Node.js, browsers, Web Workers, and serverless functions. The library itself lives in the postal-mime repository next to this one (`../postal-mime`). Its source in `src/`, its README and its CHANGELOG are the source of truth for behavior, and these docs must be kept in sync with them.

- **Documentation site:** https://postal-mime.postalsys.com
- **Library repository:** https://github.com/postalsys/postal-mime
- **npm:** https://www.npmjs.com/package/postal-mime

The editorial rules below are shared with the EmailEngine documentation (`../learn-emailengine-app/CLAUDE.md`). When that file changes its rules, consider carrying the change over here.

## Editorial Model: MDN

**Treat this site as MDN Web Docs for postal-mime.** MDN is the reference model for how these pages are written, maintained, and argued about. When a judgment call comes up that the rules below do not settle, decide it the way an MDN editor would.

What that means in practice:

- **Document what ships, not what is intended.** Every claim traces to the source in `../postal-mime/src`, the README, the CHANGELOG, or an observed result of running the code. If you cannot verify it, do not write it. A guess that reads well is worse than a gap.
- **Reference before narrative.** The primary job of a page is to let a reader look something up and get an exact answer: the option, its type, its default, what it does. Tutorials and guidance are welcome, but they never displace the reference material.
- **Neutral, plain, present tense.** No marketing voice, no "simply", "easily", "just", "powerful", "perfect" or "seamless". State behavior; let the reader judge it.
- **Behavior notes carry versions.** When something changed, say which version changed it, the way MDN's compatibility notes do (take the version from the CHANGELOG). Deprecated and removed features are labeled and kept until they are gone from supported releases, not quietly deleted.
- **One canonical page per concept.** Link to it rather than restating it. Duplicated explanations drift apart, and the divergence is always discovered by a reader.
- **Do not document bugs as features.** If the implementation is wrong, report it rather than writing the defect into the reference. Document the behavior a reader can rely on today.
- **Fix what you touch.** An error noticed on a page being edited for another reason gets fixed in that edit, with the page read whole rather than patched at the point of the change.
- **Examples are complete and correct.** Runnable as written, minimal, and free of placeholders that would fail if pasted. Every output shown in a comment is what the current release actually prints.
- **Write for someone who arrived from a search engine.** Assume no knowledge of the preceding page, and no reading of the section above.

MDN's own guidance is the tiebreaker for anything not covered here: https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines

## Important Rules

1. **Git Commit Messages** - Do not include Claude Code attribution or co-authorship

   - Never add "Generated with Claude Code" or a "Co-Authored-By: Claude" trailer
   - Write clear, professional commit messages without AI attribution

2. **No Emojis in Documentation** - Never use emojis in documentation files

   - Use text instead: "Success", "Warning", "Important", etc.
   - The React pages under `src/pages/` are application UI, not documentation, and may keep the icons they use

3. **Dash Usage in Documentation** - Use a single hyphen-minus as a thought separator

   - Do not use `--` (double hyphen) as punctuation, the em dash (U+2014) or the en dash (U+2013)
   - Use `-` (single hyphen-minus) for parenthetical asides and separators, e.g. "Errors - Error codes"
   - A literal `--` inside code (a MIME boundary line, a signature separator) is code, not punctuation, and stays

4. **URL Redirects** - When renaming or moving documentation pages

   - If a documentation page URL changes (file renamed or moved), add a redirect from the old URL to the new one in `docusaurus.config.ts`, under the `@docusaurus/plugin-client-redirects` plugin
   - This prevents 404 errors for bookmarked links and links from the library README, npm and GitHub
   - Only skip a redirect if a new page with different content replaces the old URL

5. **AI Agent Reference** - Keep `docs/llm-context.md` up to date

   - It is a single page summarizing the whole public API (exports, options, the `Email` and `Attachment` shapes, error codes, gotchas) for AI coding assistants
   - Update it whenever the public API changes: a new option, export, type, property or error code, or a changed default or behavior that a caller would code against
   - Update the "Documented release" version at its top with every content sync

6. **Dependency Vulnerabilities Do Not Apply Here** - Ignore every alert; upgrade for features, never for alerts

   This site is published as a static site, so dependency vulnerabilities reported by GitHub or npm have no runtime impact. Never report a Dependabot count as something to look at, raise it as a finding, or offer to fix it. Dismiss such alerts with reason "Vulnerable code is not actually used" (`not_used`).

7. **Keep the demo on the current release** - `src/pages/demo.tsx` imports postal-mime from npm. After a library release, bump the `postal-mime` dependency in `package.json` so the live demo runs the version the docs describe.

## Development Commands

- `npm start` - Start development server (http://localhost:3000)
- `npm run build` - Build for production (fails on broken links)
- `npm run serve` - Serve the production build locally
- `npm run typecheck` - Type check TypeScript files
- `npm run clear` - Clear Docusaurus cache

Pushes to `master` deploy the site to GitHub Pages at https://postal-mime.postalsys.com through `.github/workflows/deploy.yml`.

## Architecture

```
docs/
├── index.md                     # Introduction (slug: /)
├── llm-context.md               # AI Agent Reference
├── troubleshooting.md
├── getting-started/             # installation, quick-start, upgrading
├── guides/                      # parsing-emails, working-with-attachments, cloudflare-workers, security
├── api/                         # postal-mime, options, email, address-parser, decode-words, types, errors
└── examples/                    # basic-parsing, web-worker, email-viewer
src/
├── components/                  # Homepage features
├── css/                         # Theme customization
└── pages/                       # index.tsx (homepage), demo.tsx (live parser demo)
static/img/                      # Logo, mascot images, social card
docusaurus.config.ts             # Site config, navbar, footer, redirects
sidebars.ts                      # Sidebar, maintained by hand
```

- **The sidebar is maintained by hand in `sidebars.ts`.** A new page must be added there. Do not add `_category_.json` files; they have no effect with an explicit sidebar.
- **Canonical pages.** Each topic has one authoritative page, and other pages link to it:
  - Parser options: `docs/api/options.md`
  - The parsed `Email` object, `Header`, `HeaderLine`, addresses and `Attachment`: `docs/api/email.md`
  - Error codes: `docs/api/errors.md`
  - Type declarations: `docs/api/types.md` (declarations only, semantics live on the pages above)
  - Security limits and threat model: `docs/guides/security.md`
  - Charset handling: `docs/api/decode-words.md#supported-charsets`
- The site uses a blue color scheme (#1976d2 primary). Dark mode is enabled and respects user preferences.

## Documentation Authoring Guidelines

### Conventions the whole site follows

- **Examples must run.** No `...` standing in for a value, no undefined variables a reader cannot fill in from the text around the block, no `//` comments inside a `json` block. An output shown in a comment is checked against the current release.
- **Show JavaScript, and TypeScript where the types matter.** Prefer ES module syntax (`import`); show CommonJS only where module format is the topic.
- **Untrusted values stay untrusted in examples.** Never write an attachment `filename` into a path, a `contentId` into a regular expression, or `html` into the DOM without the handling the Security guide describes, even in a short example.
- **No counts or sizes that drift.** Do not state a bundle size or "all N options"; link to the reference instead.
- **Every page ends with `## See Also`,** a handful of links that each say what the reader would go there for.
- **Verify before writing.** Run the example against the built library (`../postal-mime/dist/esm/postal-mime.js` after `npm run build` there) before stating its output.

### File Structure

Every documentation file has complete frontmatter:

```markdown
---
title: Clear, Descriptive Title
sidebar_position: 1
description: Brief one-sentence description for SEO
---

# Page Title

Brief introduction paragraph.

## Section

Content with code examples...

## See Also

- [Related Topic](./related) - What the reader finds there
```

### Admonitions

Use Docusaurus admonitions (`:::note`, `:::tip`, `:::warning`, `:::danger`) for information the reader must not miss, not for decoration.

### Keeping in Sync with the Library

When postal-mime releases:

1. Read the new CHANGELOG entries and the diff of `src/` since the documented release
2. Update the canonical page for each changed behavior, with a version note
3. Update `docs/llm-context.md` and its "Documented release" line
4. Bump the `postal-mime` dependency for the demo
5. Run `npm run build` and fix every warning

## Quality Checklist

Every page should:

- Have complete frontmatter (title, sidebar_position, description)
- Include practical, runnable code examples
- Link to the canonical page instead of restating a concept
- End with a "See Also" section with related links
- Contain no emojis, em dashes or en dashes
