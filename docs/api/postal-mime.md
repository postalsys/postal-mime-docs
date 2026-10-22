---
title: PostalMime
sidebar_position: 1
description: Reference for the PostalMime class, its static parse() method, the constructor and the instance parse() method.
---

# PostalMime

<img src="/img/mascot/structure.png" alt="postal-mime mascot with structure" className="mascot-header" />

`PostalMime` is the default export of the package. It parses an RFC 822 email message into an [`Email`](./email) object.

```javascript
import PostalMime from 'postal-mime';
```

```javascript
// CommonJS: require() returns the class itself
const PostalMime = require('postal-mime');
```

## PostalMime.parse()

Parses a message with a new parser instance. This is the usual way to use the library (since 2.2.0).

```javascript
PostalMime.parse(email, options?) -> Promise<Email>
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | [`RawEmail`](#input-types) | Yes | The raw message |
| `options` | [`PostalMimeOptions`](./options) | No | Parser options |

### Return value

A `Promise` that resolves to an [`Email`](./email) object.

### Exceptions

The promise rejects with an error that has a [`code`](./errors) property: `EINVALIDOPTION` for an invalid option, `EINVALIDINPUT` for an unsupported input type, and one of the `EMAX*` codes when the message exceeds a [security limit](./options#security-limits). An invalid option rejects the promise rather than throwing synchronously.

Malformed message content is not an error. The parser recovers from it and returns what it could read.

### Example

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse(`From: sender@example.com
To: recipient@example.com
Subject: Hello
Content-Type: text/plain

Hello, World!`);

console.log(email.subject); // "Hello"
console.log(email.text);    // "Hello, World!\n"
```

## Input types

The `email` argument is a `RawEmail`:

| Type | Notes |
|------|-------|
| `string` | Encoded to UTF-8 bytes before parsing. Pass bytes instead when the message may contain 8-bit text in another charset |
| `ArrayBuffer` | Also a `SharedArrayBuffer` |
| `ArrayBufferView` | A `Uint8Array`, a Node.js `Buffer`, a `DataView` or any other typed array. Only the bytes of the view are read |
| `Blob` | Also a `File`, such as one from an `<input type="file">` |
| `ReadableStream<Uint8Array>` | Read to completion before parsing starts, so the whole message is still held in memory. A chunk that is not an `ArrayBufferView` is an `EINVALIDINPUT` error |

`null`, `undefined` and an empty string parse to an empty message. Any other value, such as a number or a plain object, is an `EINVALIDINPUT` error. An error raised by the `ReadableStream` or `Blob` itself is passed through unchanged and has no postal-mime `code`.

## Constructor

```javascript
new PostalMime(options?)
```

Creates a parser instance. The constructor validates `options` and throws an `EINVALIDOPTION` error synchronously for an invalid one.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `options` | [`PostalMimeOptions`](./options) | No | Parser options |

## parse() instance method

```javascript
parser.parse(email) -> Promise<Email>
```

Parses a message with the options given to the constructor. It takes the same [input types](#input-types) and resolves to an [`Email`](./email) object.

A parser instance parses one message. Calling `parse()` a second time on the same instance rejects with `EPARSERREUSED`, so create a new instance, or use `PostalMime.parse()`, for each message.

```javascript
import PostalMime from 'postal-mime';

const parser = new PostalMime({ attachmentEncoding: 'base64' });
const email = await parser.parse('Subject: Instance\n\nBody');
console.log(email.subject); // "Instance"

try {
    await parser.parse('Subject: Second\n\nBody');
} catch (err) {
    console.log(err.code); // "EPARSERREUSED"
}
```

## Utility functions

The package also exports two functions, which are attached to the class as static properties in the CommonJS build:

- [`addressParser()`](./address-parser) parses an address header into mailboxes and groups
- [`decodeWords()`](./decode-words) decodes RFC 2047 encoded words

```javascript
import PostalMime, { addressParser, decodeWords } from 'postal-mime';
```

## TypeScript

```typescript
import PostalMime from 'postal-mime';
import type { Email, PostalMimeOptions, RawEmail } from 'postal-mime';

async function parse(raw: RawEmail): Promise<Email> {
    const options: PostalMimeOptions = { attachmentEncoding: 'base64' };
    return PostalMime.parse(raw, options);
}
```

See [Types](./types) for every exported type.

## See Also

- [Parser Options](./options) - Every option, its default and its validation
- [Email Object](./email) - What `parse()` resolves to
- [Errors](./errors) - The error codes `parse()` rejects with
- [Parsing Emails](../guides/parsing-emails) - Reading messages from files, uploads, fetch and streams
