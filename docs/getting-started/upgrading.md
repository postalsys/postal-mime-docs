---
title: Upgrading
sidebar_position: 3
description: Breaking changes in postal-mime 3.0 and 4.0, and the behavior changes in later releases that code may depend on.
---

# Upgrading

This page lists the changes that can break code written against an earlier release. The full history is in the [CHANGELOG](https://github.com/postalsys/postal-mime/blob/master/CHANGELOG.md).

## From 3.x to 4.x

Version 4 is a TypeScript rewrite. Code that imports `postal-mime` by name keeps working, and the parsed output is unchanged. What did change:

- **Node.js 20 or newer is required.**
- **Browser deep imports moved.** The ES module build moved from `src/postal-mime.js` to `dist/esm/postal-mime.js`. Only code that loads the file from `node_modules` by its path is affected:

  ```javascript
  // 3.x
  import PostalMime from './node_modules/postal-mime/src/postal-mime.js';
  // 4.x
  import PostalMime from './node_modules/postal-mime/dist/esm/postal-mime.js';
  ```

- **`Attachment.disposition` is typed as `AttachmentDisposition | null`.** The parser has always passed the Content-Disposition token through as it is, so the type now accepts any string instead of claiming that only `'attachment'` and `'inline'` occur. Code that assigns the value to the narrower type has to widen it.
- **Stream input is typed as `ReadableStream<Uint8Array>`.** A `ReadableStream<ArrayBuffer>` or `ReadableStream<string>` never parsed correctly and no longer type-checks. Any `ArrayBufferView`, including a `DataView`, is accepted.
- **`addressParser()` no longer reads the undocumented `_depth` option.**
- **CommonJS TypeScript projects** get a declaration that matches what `require()` returns (`export =`). A project that compiles with both `esModuleInterop` and `allowSyntheticDefaultImports` switched off has to use `import PostalMime = require('postal-mime')` instead of a default import. See [Types](../api/types#importing-types).

## From 2.x to 3.x

Version 3.0.0 changed how headers are read:

- **Folding whitespace is kept.** `headers[].value` keeps the whitespace that folding introduced, so `Subject: Hello\r\n    World` reads as `Hello    World`. Before 3.0.0 every whitespace run was collapsed to a single space.
- **The first occurrence of a header wins.** Single-value properties such as `subject` and `from` resolve to the first occurrence of a duplicated header rather than the last.
- **Address lists are in document order.** `to`, `cc`, `bcc` and `replyTo` are returned in the order the addresses appear, rather than reversed.

## Behavior changes within 4.x

These releases did not change the API, but changed results that code may rely on:

| Version | Change |
|---------|--------|
| 4.0.5 | Attachment `content` holds the bytes as sent, line endings included; `text` and `html` are normalized to LF. Text without a usable charset is read as UTF-8 or windows-1252, and an HTML part may name its charset in a `<meta>` tag. A multipart without a `boundary` parameter is read as plain text. New `maxPartCount` option |
| 4.0.7 | New `maxForwardedAddresses` option |
| 4.0.8 | `maxHeadersSize` and `maxPartCount` count inline forwards together with the message that carries them, and a header line counts for at least 64 bytes. A message with many forwards that used to parse may now be rejected |
| 4.1.0 | Every error has a [`code`](../api/errors). An unknown `attachmentEncoding` is rejected before parsing starts |
| 4.1.1 | Whitespace around a header name stays in its `key` (`"from "` for a `From :` line). An encoded word never yields a mailbox address. A Content-Transfer-Encoding token is matched whole, so `x-base64` is not decoded. ISO-2022-KR, ISO-2022-CN and HZ-GB-2312 decode to a replacement character |
| 4.1.3 | A UTF-16 byte order mark is honored only under a label that leaves the byte order open, such as `utf-16` |

## See Also

- [Installation](./installation) - Requirements and import paths
- [Types](../api/types) - The current type declarations
- [Email Object](../api/email) - The current behavior of every property
- [CHANGELOG](https://github.com/postalsys/postal-mime/blob/master/CHANGELOG.md) - Every release
