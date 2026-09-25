---
sidebar_position: 1
---

# Installation

<img src="/img/mascot/mailpile.png" alt="postal-mime mascot with envelopes" className="mascot-header" />

postal-mime can be installed via npm and works in various JavaScript environments.

## npm Installation

```bash
npm install postal-mime
```

## Importing

### ES Modules (Recommended)

For modern projects using ES modules:

```javascript
import PostalMime from 'postal-mime';
```

### CommonJS

For projects using CommonJS (Node.js with `require`):

```javascript
const PostalMime = require('postal-mime');
const { addressParser, decodeWords } = require('postal-mime');
```

`require()` returns the `PostalMime` class itself, with the utility functions attached to it. Both module formats are compiled from the same TypeScript source.

### Browser (Direct Import)

With a bundler such as Vite, webpack or esbuild, import the package by name and the bundler picks the ES module build through the package `exports` map. Without a bundler, load the ES module build from `dist/esm` directly, in a page or in a Web Worker:

```javascript
import PostalMime from './node_modules/postal-mime/dist/esm/postal-mime.js';
```

:::note
The `dist/esm` build exists from postal-mime 4.0 on. Earlier versions shipped the ES module source at `src/postal-mime.js` instead, so use that path with a 3.x release.
:::

### Deno

Use the `npm:` specifier to import postal-mime in Deno:

```typescript
import PostalMime from 'npm:postal-mime';
import { addressParser, decodeWords } from 'npm:postal-mime';
```

### Bun

Bun supports npm packages directly with the same syntax as Node.js:

```javascript
import PostalMime from 'postal-mime';
```

## Environment Support

postal-mime works in the following environments:

| Environment | Support |
|------------|---------|
| Node.js 18+ | Full support |
| Modern Browsers | Full support |
| Web Workers | Full support |
| Cloudflare Workers | Full support |
| Deno | Full support |
| Bun | Full support |

## TypeScript

postal-mime is written in TypeScript. The declarations are generated from the source and shipped next to both builds, so no additional `@types` package is needed.

```typescript
import PostalMime from 'postal-mime';
import type { Email, PostalMimeOptions } from 'postal-mime';

const options: PostalMimeOptions = {
    attachmentEncoding: 'base64'
};

const email: Email = await PostalMime.parse(rawEmail, options);
```

## Utility Functions

postal-mime also exports utility functions that can be imported separately:

```javascript
import PostalMime, { addressParser, decodeWords } from 'postal-mime';
```

## Bundle Size

postal-mime has **zero dependencies**, making it ideal for frontend applications where bundle size matters. The whole library is about 80 KB minified and 25 KB gzipped, most of which is the HTML entity table used when converting HTML to plain text.

## Verification

After installation, verify it works:

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse('Subject: Test\n\nHello');
console.log(email.subject); // "Test"
console.log(email.text);    // "Hello"
```
