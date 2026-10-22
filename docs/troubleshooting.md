---
title: Troubleshooting
sidebar_position: 6
description: Fixes for common postal-mime problems, from error codes and missing bodies to garbled text, missing attachments and import errors.
---

# Troubleshooting

<img src="/img/mascot/confused.png" alt="postal-mime mascot confused" className="mascot-header" />

## Errors

Every error the parser throws has a `code` property. Check `err.code` rather than the message text, see [Errors](./api/errors) for the full list.

### EPARSERREUSED: "Can not reuse parser, create a new PostalMime object"

A `PostalMime` instance parses one message, and `parse()` was called on it a second time. Use the static method, which creates a parser for every call, or a new instance per message:

```javascript
import PostalMime from 'postal-mime';

const first = await PostalMime.parse('Subject: One\n\nBody');
const second = await PostalMime.parse('Subject: Two\n\nBody');
console.log(first.subject, second.subject); // One Two
```

### EMAXNESTINGDEPTH, EMAXHEADERSIZE, EMAXPARTCOUNT, EMAXFORWARDEDADDRESSES

The message exceeds one of the [security limits](./api/options#security-limits). The defaults are generous, so a message that reaches them is usually malicious or broken, and rejecting it is the usual response:

```javascript
import PostalMime from 'postal-mime';

async function parseOrSkip(raw) {
    try {
        return await PostalMime.parse(raw);
    } catch (err) {
        if (err.code?.startsWith('EMAX')) {
            console.warn('Skipping message:', err.code);
            return null;
        }
        throw err;
    }
}
```

If legitimate mail you need to accept hits a limit, raise only that limit, and only as far as you need. A message with many inline forwards can reach `maxHeadersSize` or `maxPartCount` since 4.0.8, because inline forwards share the budget of the message that carries them.

### EINVALIDOPTION: "maxNestingDepth must be a non-negative integer"

A limit option is not a non-negative integer, for example a numeric string read from an environment variable, `NaN` or `Infinity`; `maxPartCount` must be at least `1` ("maxPartCount must be a positive integer"). Convert the value and check it, and leave the option out to use the default:

```javascript
import PostalMime from 'postal-mime';

const configured = Number.parseInt(process.env.MAX_NESTING_DEPTH ?? '', 10);
const options = Number.isInteger(configured) && configured >= 0 ? { maxNestingDepth: configured } : {};

const email = await PostalMime.parse('Subject: Hello\n\nBody', options);
```

`0` is a valid value and means zero, not the default.

### EINVALIDOPTION: "Unknown attachment encoding"

`attachmentEncoding` accepts `'arraybuffer'`, `'base64'` and `'utf8'`, see [attachmentEncoding](./api/options#attachmentencoding).

### EINVALIDINPUT: "Unsupported email input type"

The message was not a string, `ArrayBuffer`, `ArrayBufferView`, `Blob` or `ReadableStream`, for example a number or a plain object such as a parsed JSON body. Pass the raw bytes. A `ReadableStream` whose chunks are not byte views (`ArrayBufferView` values), such as a text stream, raises the same code.

## Content issues

### `html` is undefined although the message has HTML

- The HTML part has `Content-Disposition: attachment`, so it is in `attachments`:

  ```javascript
  const htmlAttachment = email.attachments.find(att => att.mimeType === 'text/html');
  if (htmlAttachment) {
      const html = new TextDecoder().decode(htmlAttachment.content);
  }
  ```

- The HTML is inside a forwarded message that was kept as an attachment, by `forceRfc822Attachments`, `rfc822Attachments`, a delivery report, or `maxRfc822NestingDepth`. Parse the `message/rfc822` attachment's `content`.

### Text content has strange characters

The text was decoded with the wrong charset. Check what the message declares:

```javascript
const contentType = email.headers.find(h => h.key === 'content-type');
console.log(contentType?.value);
```

- A declared charset is followed even when the bytes are not valid in it, so a message that declares the wrong charset decodes to the wrong text. This is the sender's error.
- If the message was passed in as a string that was decoded from bytes first, text in a charset other than UTF-8 was already damaged. Pass the bytes (`Buffer`, `ArrayBuffer`, `Uint8Array` or `Blob`) instead.
- A part without a charset, or with a label that cannot be resolved, is read as UTF-8 when its bytes are valid UTF-8 and as windows-1252 otherwise.

See [Supported charsets](./api/decode-words#supported-charsets).

### A header looks missing

List every header the parser saw:

```javascript
for (const header of email.headers) {
    console.log(JSON.stringify(header.key), header.value);
}
```

- Keys are lowercase, so look for `'subject'`, not `'Subject'`.
- A header written with whitespace before the colon, such as `Subject :`, is listed under the key `"subject "` and is not read as the `Subject` header (since 4.1.1).
- Where a header occurs more than once, `subject`, `from` and the other single-value properties use the first occurrence.
- Only the headers of the top-level message are listed, not those of MIME parts or forwarded messages.

### An address has an empty `address`

The display name holds an encoded word that decodes to something like `Name <name@example.com>`. postal-mime reads addresses only from the raw header (since 4.1.1), so such text stays in `name`. See [Encoded display names](./api/address-parser#encoded-display-names).

### `addressParser()` returns a group without `address`

An entry like `Team: a@example.com, b@example.com;` is a group. Read its members from `group`, or pass `{ flatten: true }` to get mailboxes only. See [addressParser()](./api/address-parser#groups).

## Attachment issues

### The attachments array is empty

- The message has no attachments. Text and HTML parts without `Content-Disposition: attachment` are part of the body, not attachments.
- A forwarded `message/rfc822` part was parsed inline, so its body is in `text` and `html`. Its own attachments are in `attachments`; to get the forwarded message itself as an attachment, use the [`forceRfc822Attachments`](./api/options#forcerfc822attachments) option.

Inline images are not missing: they are listed in `attachments` with `related: true`.

### Attachment content looks wrong

Check which type `content` has:

```javascript
for (const att of email.attachments) {
    console.log(att.filename, att.encoding, Object.prototype.toString.call(att.content));
}
```

- With the default encoding, `content` is an `ArrayBuffer`, or a `Uint8Array` for calendar parts. Wrap it as `new Uint8Array(att.content)` or `Buffer.from(att.content)` to read or write the bytes.
- With `attachmentEncoding: 'base64'` it is a base64 string, and with `'utf8'` a string decoded as UTF-8, which damages binary files.
- Calendar parts are normalized to UTF-8 text with LF line endings, so their bytes differ from the message. Every other part holds the bytes exactly as sent.

### An attachment has `rfc822DepthExceeded: true`

The forwarded message was nested deeper than [`maxRfc822NestingDepth`](./api/options#maxrfc822nestingdepth) allows (default 10), so it was not parsed and nothing inside it is reflected in the result. Parse its `content` yourself if you need it, and bound how many levels you follow.

### `filename` is null

The part names no file in Content-Disposition or Content-Type. Choose a name yourself:

```javascript
const EXTENSIONS = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'text/plain': 'txt' };

function displayName(att, index) {
    return att.filename || `attachment-${index}.${EXTENSIONS[att.mimeType] || 'bin'}`;
}
```

## Environment issues

### Import or module resolution errors

- ES modules: `import PostalMime from 'postal-mime'`
- CommonJS: `const PostalMime = require('postal-mime')`
- Browser without a bundler: `import PostalMime from './node_modules/postal-mime/dist/esm/postal-mime.js'`. The 3.x releases shipped this file at `src/postal-mime.js`, see [Upgrading](./getting-started/upgrading)
- TypeScript with CommonJS and `esModuleInterop` off: `import PostalMime = require('postal-mime')`, see [Types](./api/types#importing-types)

### "Blob is not defined" or "TextDecoder is not defined"

The runtime is older than postal-mime supports. Version 4 requires Node.js 20 or newer, see [Requirements](./getting-started/installation#requirements).

## Performance issues

### Parsing blocks the page

Move parsing into a Web Worker, see the [Web Worker example](./examples/web-worker).

### Memory use is high

- The whole message is held in memory while it is parsed, including when a `ReadableStream` is passed in. Bound the size of input before parsing it.
- The `base64` and `utf8` attachment encodings turn every attachment into a string, which takes more memory than the bytes it holds. Keep the default encoding unless you need strings.
- Process messages one at a time, and release references to parsed messages, and to their attachments, once you have stored what you need.

## Reporting a bug

If the parser returns something you believe is wrong, open an issue at [github.com/postalsys/postal-mime/issues](https://github.com/postalsys/postal-mime/issues) with:

- the postal-mime version and the runtime and its version
- a minimal message that reproduces the problem, with personal data removed
- the code that parses it, what it returns and what you expected

## See Also

- [Errors](./api/errors) - Every error code
- [Parser Options](./api/options) - Limits and attachment encoding
- [Email Object](./api/email) - What each property holds
- [Security](./guides/security) - Handling untrusted mail
