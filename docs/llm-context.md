---
title: AI Agent Reference
sidebar_position: 7
description: The whole postal-mime API on one page, for AI coding assistants and for readers who want a compact summary.
---

# AI Agent Reference

This page summarizes the public API of postal-mime on one page, for AI coding assistants and anyone who wants the whole surface at a glance. Each section links to the canonical page with the details.

**Documented release:** postal-mime 4.1.4

## Package

| | |
|---|---|
| Install | `npm install postal-mime` |
| Runtimes | Node.js 20+, browsers, Web Workers, Deno (`npm:postal-mime`), Bun, Cloudflare Workers |
| Dependencies | None |
| ES module | `import PostalMime, { addressParser, decodeWords } from 'postal-mime'` (`dist/esm`) |
| CommonJS | `const PostalMime = require('postal-mime')`, returns the class with `addressParser` and `decodeWords` attached (`dist/cjs`) |
| Browser without bundler | `./node_modules/postal-mime/dist/esm/postal-mime.js` |
| Types | Bundled, no `@types` package. CommonJS TypeScript: `import PostalMime = require('postal-mime')` |

## Exports

| Export | Signature | Details |
|--------|-----------|---------|
| `PostalMime` (default) | `PostalMime.parse(email: RawEmail, options?: PostalMimeOptions): Promise<Email>` | [PostalMime](./api/postal-mime) |
| | `new PostalMime(options?)`, then `parser.parse(email): Promise<Email>`, once per instance | |
| `addressParser` | `addressParser(value: string, options?: { flatten?: boolean }): Address[]` | [addressParser()](./api/address-parser) |
| `decodeWords` | `decodeWords(value: string): string` | [decodeWords()](./api/decode-words) |
| Types | `Email`, `Address`, `Mailbox`, `AddressGroup`, `Header`, `HeaderLine`, `Attachment`, `AttachmentDisposition`, `AttachmentEncoding`, `PostalMimeOptions`, `AddressParserOptions`, `RawEmail`, `PostalMimeError`, `ErrorCode` | [Types](./api/types) |

`RawEmail` is `string | ArrayBuffer | ArrayBufferView | Blob | ReadableStream<Uint8Array>`. Pass bytes rather than a decoded string when the message may contain non UTF-8 text. A stream is read fully into memory before parsing.

## Options

| Option | Type | Default | Effect |
|--------|------|---------|--------|
| `rfc822Attachments` | `boolean` | `false` | `message/rfc822` parts without Content-Disposition become attachments |
| `forceRfc822Attachments` | `boolean` | `false` | Every `message/rfc822` part becomes an attachment. Automatic for delivery and feedback reports |
| `attachmentEncoding` | `'arraybuffer' \| 'base64' \| 'utf8'` | `'arraybuffer'` | Type of `Attachment.content` |
| `maxNestingDepth` | `number` | `256` | `EMAXNESTINGDEPTH` when exceeded |
| `maxHeadersSize` | `number` | `2097152` | Bytes, whole message; `EMAXHEADERSIZE` |
| `maxPartCount` | `number` | `10000` | Whole message; `EMAXPARTCOUNT` |
| `maxRfc822NestingDepth` | `number` | `10` | Deeper nested messages become attachments with `rfc822DepthExceeded: true`; `0` disables inline parsing |
| `maxForwardedAddresses` | `number` | `10000` | Addresses of inline forwards; `EMAXFORWARDEDADDRESSES` |

Limit options must be non-negative integers, and `maxPartCount` a positive one, or `EINVALIDOPTION` is raised; `0` means zero. Details: [Parser Options](./api/options).

## Email object

| Property | Type | Notes |
|----------|------|-------|
| `headers` | `{ key, originalKey, value }[]` | Always present. Top-level headers in order, duplicates kept. `key` lowercase with whitespace around the name kept, `value` unfolded, not decoded. The block ends at the first line that is neither a header field nor a fold; what follows is body text |
| `headerLines` | `{ key, line }[]` | Always present. Raw lines, folds joined with LF |
| `from`, `sender` | `Address` | First occurrence |
| `to`, `cc`, `bcc`, `replyTo` | `Address[]` | Every occurrence, in order |
| `deliveredTo`, `returnPath` | `string` | Address only |
| `subject`, `messageId`, `inReplyTo`, `references` | `string` | First occurrence, encoded words decoded |
| `date` | `string` | ISO 8601, or the raw value if unparseable |
| `otp` | `{ code, origin }` | From a single top-level `OTP-Token` header (draft-goto-otp-token) with a canonical https (or loopback http) origin, absent otherwise. Not authenticated, verify DKIM for the origin domain. Experimental, follows the draft |
| `text`, `html` | `string` | LF line endings. Absent when the message has no part of either type; filled by conversion when the message mixes types. `html` is not sanitized |
| `attachments` | `Attachment[]` | Always present |

Optional properties are absent, not `null`, when the message has no value. `Address` is `{ name, address }` (mailbox) or `{ name, group: Mailbox[] }` (group); test `addr.group` to tell them apart. Details: [Email Object](./api/email).

## Attachment object

| Property | Type | Notes |
|----------|------|-------|
| `filename` | `string \| null` | Decoded, sender-controlled: sanitize before using as a path |
| `mimeType` | `string` | Lowercase, sender-controlled, not validated (may hold whitespace, quotes or path separators) |
| `disposition` | `string \| null` | Lowercased Content-Disposition token |
| `related` | `true` or absent | Inline resource in `multipart/related` with a Content-ID |
| `contentId` | `string` or absent | Usually with angle brackets, not validated (may lack them or repeat); `cid:` URLs omit them |
| `description` | `string` or absent | Decoded Content-Description |
| `method` | `string` or absent | Uppercased calendar method, eg. `REQUEST` |
| `rfc822DepthExceeded` | `true` or absent | Unparsed nested message; its content is not reflected anywhere else |
| `content` | `ArrayBuffer \| Uint8Array \| string` | `ArrayBuffer` by default, `Uint8Array` for `text/calendar` and `application/ics`, a string with `base64`/`utf8` |
| `encoding` | `'base64' \| 'utf8'` or absent | Set exactly when `content` is a string |

## Errors

Every thrown error has `code` (since 4.1.0). `PostalMime.parse()` always rejects rather than throwing; `new PostalMime()` throws `EINVALIDOPTION` synchronously.

| Code | Type | Meaning |
|------|------|---------|
| `EINVALIDOPTION` | `TypeError` | Invalid option value |
| `EINVALIDINPUT` | `TypeError` | Unsupported input type, or non-byte stream chunk |
| `EPARSERREUSED` | `Error` | `parse()` called twice on one instance |
| `EMAXNESTINGDEPTH`, `EMAXHEADERSIZE`, `EMAXPARTCOUNT`, `EMAXFORWARDEDADDRESSES` | `Error` | A security limit was exceeded |

Malformed messages do not throw. `null`, `undefined` and `''` parse to an empty message. A malformed message is read the way Python's `email` package and mailparser read it: a `message/rfc822` part encoded as `base64` or `quoted-printable` is an attachment, `format=flowed` applies to `text/plain` only, a multipart whose boundary holds a non-ASCII character is plain text, a quoted `"base64"` transfer encoding is not decoded, and only `utf-16`, `utf16`, `utf_16`, `utf-16le` and `utf-16be` are read as UTF-16 (since 4.1.4). Details: [Errors](./api/errors), [Security](./guides/security#parsing-safeguards).

## Common mistakes to avoid

- Reusing a `PostalMime` instance. Use `PostalMime.parse()` for each message.
- Decoding a message to a string before parsing it. Pass the bytes.
- Reading `message.raw` in a Cloudflare Email Worker twice. It is a stream; read it once into an `ArrayBuffer` if it is needed again.
- Inserting `html` into a page without a sandboxed iframe or a sanitizer, or `text` without escaping.
- Using `filename` as a file path, or `contentId` in a `RegExp`, without sanitizing it.
- Reading `content.byteLength` after choosing the `base64` or `utf8` encoding, where `content` is a string.
- Treating `attachments` as complete in a scanner without checking `rfc822DepthExceeded`.
- Passing an options object from untrusted input to the parser.
- Matching on `err.message` instead of `err.code`.

## See Also

- [Quick Start](./getting-started/quick-start) - A first parse with explanations
- [Email Object](./api/email) - The full result reference
- [Parser Options](./api/options) - The full options reference
- [Security](./guides/security) - Handling untrusted mail
