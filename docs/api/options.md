---
title: Parser Options
sidebar_position: 2
description: Reference for every PostalMimeOptions setting, its type, default, validation and the error it raises.
---

# Parser Options

<img src="/img/mascot/sorting.png" alt="postal-mime mascot sorting" className="mascot-header" />

`PostalMime.parse(email, options)` and `new PostalMime(options)` take an optional `PostalMimeOptions` object. Every option is optional, and an omitted option, `undefined` or `null` uses the default.

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse('Subject: Hello\n\nHi there', {
    attachmentEncoding: 'base64',
    maxNestingDepth: 50
});
```

## Summary

| Option | Type | Default | Since | Description |
|--------|------|---------|-------|-------------|
| [`rfc822Attachments`](#rfc822attachments) | `boolean` | `false` | 2.2.7 | Treat `message/rfc822` parts without a Content-Disposition as attachments |
| [`forceRfc822Attachments`](#forcerfc822attachments) | `boolean` | `false` | 2.3.1 | Treat every `message/rfc822` part as an attachment |
| [`attachmentEncoding`](#attachmentencoding) | `'arraybuffer' \| 'base64' \| 'utf8'` | `'arraybuffer'` | 2.4.0 | How attachment `content` is returned |
| [`maxNestingDepth`](#maxnestingdepth) | `number` | `256` | 2.4.6 | Maximum MIME part nesting depth |
| [`maxHeadersSize`](#maxheaderssize) | `number` | `2097152` (2 MiB) | 2.4.6 | Maximum total header size in bytes |
| [`maxPartCount`](#maxpartcount) | `number` | `10000` | 4.0.5 | Maximum number of MIME parts |
| [`maxRfc822NestingDepth`](#maxrfc822nestingdepth) | `number` | `10` | 2.7.6 | Maximum depth of inline `message/rfc822` parsing |
| [`maxForwardedAddresses`](#maxforwardedaddresses) | `number` | `10000` | 4.0.7 | Maximum From, To, Cc and Bcc addresses rendered from inline forwards |

## Validation {#limit-validation}

The options are validated when the parser is created, before any input is read.

- The five `max*` limit options must be non-negative integers. Any other value, including a numeric string such as `'50'`, `NaN`, `Infinity`, a negative number or a fraction, is an [`EINVALIDOPTION`](./errors) `TypeError`. Before 2.7.6 such values were not checked, and a string or `NaN` switched the limit off.
- `0` means a literal zero, not "use the default". `maxPartCount` must be at least `1`, since the message itself is a part: `maxPartCount: 0` is an `EINVALIDOPTION` `TypeError` (since 4.1.4; before that it threw `EMAXPARTCOUNT` from the constructor).
- An unknown `attachmentEncoding` is an `EINVALIDOPTION` `TypeError` (before 4.1.0 it was reported only after the whole message had been parsed).
- `PostalMime.parse()` reports the error by rejecting its promise. `new PostalMime(options)` throws it synchronously.

```javascript
import PostalMime from 'postal-mime';

try {
    await PostalMime.parse('Subject: Hello\n\nHi', { maxNestingDepth: '50' });
} catch (err) {
    console.log(err.code, err.message);
    // EINVALIDOPTION maxNestingDepth must be a non-negative integer
}
```

:::warning
The options are configuration, not input. A large enough limit is as good as none, so do not pass an options object that comes from an untrusted source, such as a request body, to the parser as it is.
:::

## Classification Options

These options decide whether a `message/rfc822` part (an attached or forwarded email) is parsed inline, so that its text, HTML and attachments become part of the parent, or returned as an attachment. See [Nested messages](./email#nested-messages) for how an inline message is rendered.

They apply to the parts of the message passed to `parse()`. A `message/rfc822` part that is parsed inline is parsed with the default classification, so these options do not reach the parts nested inside it.

### rfc822Attachments

When `true`, a `message/rfc822` part without a `Content-Disposition` header is returned as an attachment instead of being parsed inline. A part with `Content-Disposition: inline` is still parsed inline.

By default (`false`), a `message/rfc822` part is parsed inline unless it has `Content-Disposition: attachment` or any other disposition than `inline` (since 2.2.7).

### forceRfc822Attachments

When `true`, every `message/rfc822` part is returned as an attachment, whatever its Content-Disposition.

The same applies automatically, without the option, to a message that contains a `message/delivery-status` or `message/feedback-report` part anywhere in its tree (since 2.3.0). The original message carried by a bounce or an abuse report is evidence rather than content, so it is kept as an attachment and not mixed into `text` and `html`.

```javascript
import PostalMime from 'postal-mime';

const bounce = `Subject: Undelivered Mail Returned to Sender
Content-Type: multipart/report; report-type=delivery-status; boundary="b"

--b
Content-Type: text/plain

The message could not be delivered.
--b
Content-Type: message/delivery-status

Reporting-MTA: dns; mx.example.com
--b
Content-Type: message/rfc822

Subject: Original message

Original body
--b--
`;

const email = await PostalMime.parse(bounce);
console.log(email.attachments.map(att => att.mimeType));
// [ 'message/delivery-status', 'message/rfc822' ]

const original = email.attachments.find(att => att.mimeType === 'message/rfc822');
// Parse the raw bytes, not a decoded string, so a non UTF-8 message stays intact
const parsedOriginal = await PostalMime.parse(original.content);
console.log(parsedOriginal.subject); // "Original message"
```

## attachmentEncoding

Controls the type of [`Attachment.content`](./email#attachment-object).

| Value | `content` type | `encoding` property |
|-------|----------------|---------------------|
| `'arraybuffer'` (default) | `ArrayBuffer`, or `Uint8Array` for calendar parts | not set |
| `'base64'` | `string`, base64 encoded | `'base64'` |
| `'utf8'` | `string`, the bytes decoded as UTF-8 | `'utf8'` |

The value is matched case-insensitively and with `-`, `_` and whitespace removed, so `'UTF-8'` and `'ArrayBuffer'` are accepted. Any other value is an `EINVALIDOPTION` error.

`'utf8'` decodes every attachment as UTF-8, whatever charset the part declares, so binary attachments and text in other charsets come out with replacement characters. Use it only when you know the attachments are UTF-8 text.

```javascript
import PostalMime from 'postal-mime';

const raw = `Content-Type: multipart/mixed; boundary="b"

--b
Content-Type: text/plain

See attached.
--b
Content-Type: text/plain; name="note.txt"
Content-Disposition: attachment; filename="note.txt"

Attached note
--b--
`;

const email = await PostalMime.parse(raw, { attachmentEncoding: 'base64' });
console.log(email.attachments[0].encoding); // "base64"
console.log(email.attachments[0].content);  // "QXR0YWNoZWQgbm90ZQ=="
```

## Security Limits

The limit options bound the work and memory a single message can cost. Their defaults are generous enough for legitimate mail. The [Security guide](../guides/security) explains which attack each one stops and suggests stricter values for untrusted input.

The counted limits (`maxHeadersSize`, `maxPartCount` and `maxForwardedAddresses`) are counted across the whole message: every MIME part, and every inline `message/rfc822` sub-message at every level, draw from the same budget (since 4.0.8). A multipart message cannot carry the budget again for each part it declares, and a forward cannot start the count over.

### maxNestingDepth

Maximum MIME part nesting depth, the number of multipart levels between the top of a message and its deepest part. The depth of a message parsed inline from a `message/rfc822` part starts again from zero; [`maxRfc822NestingDepth`](#maxrfc822nestingdepth) bounds those levels.

**Default:** `256`

Exceeding it rejects the parse with `EMAXNESTINGDEPTH`:

```javascript
import PostalMime from 'postal-mime';

const raw = `Content-Type: multipart/mixed; boundary="a"

--a
Content-Type: multipart/mixed; boundary="b"

--b
Content-Type: text/plain

Deep part
--b--
--a--
`;

try {
    await PostalMime.parse(raw, { maxNestingDepth: 1 });
} catch (err) {
    console.log(err.code, err.message);
    // EMAXNESTINGDEPTH Maximum MIME nesting depth of 1 levels exceeded
}
```

### maxHeadersSize

Maximum total size of the headers of the message in bytes, counted across every part and every inline `message/rfc822` sub-message. Each header line counts for at least 64 bytes, because what the parser keeps for a line is far larger than a short line itself (since 4.0.8).

**Default:** `2097152` (2 MiB)

Exceeding it rejects the parse with `EMAXHEADERSIZE`:

```javascript
import PostalMime from 'postal-mime';

try {
    await PostalMime.parse(`Subject: ${'x'.repeat(2000)}\n\nBody`, { maxHeadersSize: 1024 });
} catch (err) {
    console.log(err.code, err.message);
    // EMAXHEADERSIZE Maximum header size of 1024 bytes exceeded
}
```

### maxPartCount

Maximum number of MIME parts, the top-level part and the parts of inline `message/rfc822` sub-messages included. Nesting depth does not bound the size of the tree: an empty part costs a few bytes of input and over a kilobyte of parser state. The value must be at least `1`, since the message itself is a part (since 4.1.4).

**Default:** `10000`

Exceeding it rejects the parse with `EMAXPARTCOUNT`:

```javascript
import PostalMime from 'postal-mime';

const parts = Array.from({ length: 5 }, (_, i) => `--b\nContent-Type: text/plain\n\nPart ${i}\n`).join('');

try {
    await PostalMime.parse(`Content-Type: multipart/mixed; boundary="b"\n\n${parts}--b--\n`, { maxPartCount: 3 });
} catch (err) {
    console.log(err.code, err.message);
    // EMAXPARTCOUNT Maximum MIME part count of 3 parts exceeded
}
```

### maxRfc822NestingDepth

Maximum depth of inline `message/rfc822` parsing. Each inline message is parsed by a nested parser, and a message forwarded inside a forwarded message adds a level.

**Default:** `10`

Exceeding the limit is not an error. A `message/rfc822` part deeper than the limit is returned as an attachment with [`rfc822DepthExceeded: true`](./email#attachment-object) instead of being parsed, and nothing inside it is reflected in `text`, `html` or `attachments`. `0` disables inline parsing, so every `message/rfc822` part becomes an attachment.

```javascript
import PostalMime from 'postal-mime';

const raw = `Subject: Outer
Content-Type: multipart/mixed; boundary="b"

--b
Content-Type: text/plain

See the forwarded message.
--b
Content-Type: message/rfc822

Subject: Forwarded

Forwarded body
--b--
`;

const email = await PostalMime.parse(raw, { maxRfc822NestingDepth: 0 });
console.log(email.attachments[0].mimeType);            // "message/rfc822"
console.log(email.attachments[0].rfc822DepthExceeded); // true
```

:::warning
If you scan messages for malicious content, do not treat `attachments` as complete without checking `rfc822DepthExceeded`. A sender can push a payload past the limit to keep it out of the parsed output. See [Nested message recursion](../guides/security#nested-message-recursion-limit).
:::

### maxForwardedAddresses

Maximum number of From, To, Cc and Bcc addresses across all inline `message/rfc822` sub-messages, a group and each of its members counted. The headers of every inline message are rendered into the `text` and `html` of the result, and a one-character address becomes some 60 characters of HTML, so without this limit the output grows with the number of forwarded addresses rather than with the size of the message. The headers of the top-level message are not rendered and do not count.

**Default:** `10000`

Exceeding it rejects the parse with `EMAXFORWARDEDADDRESSES`:

```javascript
import PostalMime from 'postal-mime';

const raw = `Content-Type: multipart/mixed; boundary="b"

--b
Content-Type: message/rfc822

From: a@example.com
To: b@example.com, c@example.com

Forwarded body
--b--
`;

try {
    await PostalMime.parse(raw, { maxForwardedAddresses: 2 });
} catch (err) {
    console.log(err.code, err.message);
    // EMAXFORWARDEDADDRESSES Maximum forwarded address count of 2 addresses exceeded
}
```

## TypeScript

```typescript
import PostalMime from 'postal-mime';
import type { Email, PostalMimeOptions } from 'postal-mime';

const options: PostalMimeOptions = {
    attachmentEncoding: 'base64',
    maxNestingDepth: 50,
    maxHeadersSize: 512 * 1024,
    maxPartCount: 1000,
    maxRfc822NestingDepth: 3,
    maxForwardedAddresses: 1000
};

const email: Email = await PostalMime.parse('Subject: Hello\n\nHi', options);
```

## See Also

- [PostalMime](./postal-mime) - The methods that take these options
- [Email object](./email) - What the classification and encoding options change in the result
- [Errors](./errors) - The error codes the limits raise
- [Security](../guides/security) - Recommended limits for untrusted input
