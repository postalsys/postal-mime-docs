---
sidebar_position: 1
---

# Installation

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
```

### Browser (Direct Import)

For browser environments, you can import directly from the `src` folder:

```javascript
import PostalMime from './node_modules/postal-mime/src/postal-mime.js';
```

## Environment Support

postal-mime works in the following environments:

| Environment | Support |
|------------|---------|
| Node.js 14+ | Full support |
| Modern Browsers | Full support |
| Web Workers | Full support |
| Cloudflare Workers | Full support |
| Deno | Full support |
| Bun | Full support |

## TypeScript

postal-mime includes built-in TypeScript definitions. No additional `@types` package is needed.

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

postal-mime has **zero dependencies**, making it ideal for frontend applications where bundle size matters. The library is approximately 15KB minified.

## Verification

After installation, verify it works:

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse('Subject: Test\n\nHello');
console.log(email.subject); // "Test"
console.log(email.text);    // "Hello"
```
