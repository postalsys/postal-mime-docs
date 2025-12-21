# CLAUDE.md

This file provides guidance to Claude Code when working with the postal-mime documentation site.

## Project Overview

This is a Docusaurus 3.x documentation site for postal-mime, an email parsing library for browser environments, Web Workers, and serverless functions.

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

- postal-mime is a zero-dependency library
- Works in browsers, Web Workers, Node.js, and Cloudflare Workers
- Full TypeScript support with comprehensive type definitions
- Security limits: maxNestingDepth (256) and maxHeadersSize (2MB)
