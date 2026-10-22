---
title: Installation
sidebar_position: 1
description: Install postal-mime from npm and import it in Node.js, browsers, Web Workers, Deno, Bun and Cloudflare Workers, as an ES module or with CommonJS.
---

# Installation

<img src="/img/mascot/mailpile.png" alt="postal-mime mascot with envelopes" className="mascot-header" />

```bash
npm install postal-mime
```

postal-mime has no runtime dependencies.

## Requirements

The package needs a runtime with the `TextDecoder`, `Blob` and `ReadableStream` globals:

| Environment | Support |
|-------------|---------|
| Node.js | 20 or newer (the package `engines` field). The test suite runs on Node.js 20, 22, 24 and 26 |
| Browsers | Any current browser, in a page or a Web Worker |
| Cloudflare Workers | Supported, including Email Workers |
| Deno | Supported, through the `npm:` specifier |
| Bun | Supported |

Node.js 20 has been required since 4.0.0. Earlier releases declared no minimum version.

## Importing

### ES modules

```javascript
import PostalMime, { addressParser, decodeWords } from 'postal-mime';
```

The package `exports` map resolves this to the ES module build in `dist/esm/`.

### CommonJS

```javascript
const PostalMime = require('postal-mime');
const { addressParser, decodeWords } = require('postal-mime');
```

`require()` resolves to the CommonJS build in `dist/cjs/` and returns the `PostalMime` class itself, with `addressParser` and `decodeWords` attached as properties. Both builds are compiled from the same TypeScript source. The CommonJS build exists since 2.6.0.

### Browsers with a bundler

With Vite, webpack, esbuild or another bundler, import the package by name. The bundler picks the ES module build through the `exports` map:

```javascript
import PostalMime from 'postal-mime';
```

### Browsers without a bundler

Load the ES module build from `dist/esm/` directly, in a page or in a module Web Worker:

```html
<script type="module">
    import PostalMime from './node_modules/postal-mime/dist/esm/postal-mime.js';

    const email = await PostalMime.parse('Subject: Hello\n\nHi there');
    console.log(email.subject); // "Hello"
</script>
```

:::note
The `dist/esm/` build exists since 4.0.0. The 3.x releases shipped the ES module source at `src/postal-mime.js` instead. See [Upgrading](./upgrading).
:::

### Deno

```typescript
import PostalMime from 'npm:postal-mime';

const email = await PostalMime.parse('Subject: Hello\n\nHi there');
console.log(email.subject); // "Hello"
```

### Bun and Cloudflare Workers

Both resolve the package by name, like Node.js:

```javascript
import PostalMime from 'postal-mime';
```

See the [Cloudflare Workers guide](../guides/cloudflare-workers) for Email Workers.

## TypeScript

The package is written in TypeScript and ships its declarations with both builds, so no `@types` package is needed:

```typescript
import PostalMime from 'postal-mime';
import type { Email, PostalMimeOptions } from 'postal-mime';

const options: PostalMimeOptions = { attachmentEncoding: 'base64' };
const email: Email = await PostalMime.parse('Subject: Hello\n\nHi there', options);
```

See [Types](../api/types) for every exported type, and for the CommonJS `import PostalMime = require('postal-mime')` form.

## Verify the installation

Save this as `check.mjs` and run `node check.mjs`:

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse('Subject: Test\n\nHello');
console.log(email.subject); // "Test"
console.log(email.text);    // "Hello\n"
```

## See Also

- [Quick Start](./quick-start) - Parse a first message and read its properties
- [Upgrading](./upgrading) - Changes to watch for when moving to a newer major version
- [Types](../api/types) - TypeScript declarations and CommonJS typing
- [Cloudflare Workers](../guides/cloudflare-workers) - Using postal-mime in an Email Worker
