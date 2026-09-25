# CLAUDE.md

This file provides guidance to Claude Code when working with the postal-mime documentation site.

## Project Overview

This is a Docusaurus 3.x documentation site for postal-mime, an email parsing library for Node.js, browsers, Web Workers, and serverless functions. The library itself lives in the postal-mime repository next to this one; its README and CHANGELOG are the source of truth for behavior, and these docs must be kept in sync with them.

## Development Commands

- `npm start` - Start development server (http://localhost:3000)
- `npm run build` - Build for production
- `npm run serve` - Serve production build locally
- `npm run typecheck` - Type check TypeScript files
- `npm run clear` - Clear Docusaurus cache

## Architecture

### Directory Structure

```
docs/                    # Documentation markdown files
src/
  components/           # React components (homepage features)
  css/                 # Custom styles
  pages/               # Custom pages (index.tsx = homepage)
static/
  img/                 # Images, logo, social card
docusaurus.config.ts   # Main configuration
sidebars.ts            # Sidebar navigation structure
```

### Configuration

- **docusaurus.config.ts** - Main site config (title, URL, navbar, footer, plugins)
- **sidebars.ts** - Documentation sidebar structure
- **src/css/custom.css** - Theme customization (colors, fonts)

### Theming

The site uses a blue color scheme (#1976d2 primary) inspired by email/mail themes.
Dark mode is enabled and respects user preferences.

## Documentation Guidelines

1. **API Reference** - Use tables for parameters, include TypeScript types
2. **Code Examples** - Show both JavaScript and TypeScript where applicable
3. **Guides** - Focus on practical use cases, include complete examples
4. **Cross-linking** - Reference related docs and the main postal-mime repository

## Key Notes

- postal-mime is a zero-dependency library written in TypeScript, published as ES modules (`dist/esm`) and CommonJS (`dist/cjs`) with generated type declarations
- Works in browsers, Web Workers, Node.js 18+, Deno, Bun and Cloudflare Workers
- Security limits: maxNestingDepth (256), maxHeadersSize (2MB, counted across every part) and maxRfc822NestingDepth (10; deeper nested messages become attachments flagged `rfc822DepthExceeded`)
- Pushes to `master` deploy the site to GitHub Pages at https://postal-mime.postalsys.com through `.github/workflows/deploy.yml`
