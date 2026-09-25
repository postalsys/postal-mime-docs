---
sidebar_position: 3
---

# Configuration

<img src="/img/mascot/sorting.png" alt="postal-mime mascot sorting" className="mascot-header" />

postal-mime provides several options to customize how emails are parsed.

## Options Overview

```javascript
const options = {
    rfc822Attachments: false,          // Treat message/rfc822 parts without a disposition as attachments
    forceRfc822Attachments: false,     // Treat ALL message/rfc822 parts as attachments
    attachmentEncoding: 'arraybuffer', // How to return attachment content
    maxNestingDepth: 256,              // Maximum MIME nesting depth
    maxHeadersSize: 2097152,           // Maximum total header size (2MB)
    maxRfc822NestingDepth: 10          // Maximum depth of inline message/rfc822 parsing
};

const email = await PostalMime.parse(rawEmail, options);
```

## Option Details

### rfc822Attachments

When set to `true`, treats `message/rfc822` parts without a Content-Disposition header as attachments instead of inlining them.

```javascript
// Default behavior: nested emails are parsed and inlined
const email = await PostalMime.parse(emailWithNestedMessage);
console.log(email.text); // Includes content from nested message

// With rfc822Attachments: nested emails become attachments
const email = await PostalMime.parse(emailWithNestedMessage, {
    rfc822Attachments: true
});
console.log(email.attachments); // Contains the nested email as attachment
```

### forceRfc822Attachments

When set to `true`, treats **all** `message/rfc822` parts as attachments, regardless of Content-Disposition.

```javascript
const email = await PostalMime.parse(rawEmail, {
    forceRfc822Attachments: true
});

// All nested emails are now attachments
email.attachments.forEach(att => {
    if (att.mimeType === 'message/rfc822') {
        console.log('Found nested email attachment');
    }
});
```

:::note Auto-detection for Delivery Reports
Even without this option, postal-mime automatically enables `forceRfc822Attachments` behavior when it detects `message/delivery-status` or `message/feedback-report` content types. This ensures bounce messages and feedback reports are parsed correctly with their nested original messages available as attachments.
:::

#### Example: Parsing a Bounce Message

```javascript
const email = await PostalMime.parse(bounceMessage);

// Check for delivery status parts
const deliveryStatus = email.attachments.find(
    att => att.mimeType === 'message/delivery-status'
);

// The original message is automatically available as an attachment
const originalMessage = email.attachments.find(
    att => att.mimeType === 'message/rfc822'
);

if (originalMessage) {
    // Parse the original bounced message from its raw bytes, so that a
    // message in a non UTF-8 charset stays intact
    const original = await PostalMime.parse(originalMessage.content);
    console.log('Bounced subject:', original.subject);
}
```

### attachmentEncoding

Controls how attachment content is returned. Options:

| Value | Type | Description |
|-------|------|-------------|
| `'arraybuffer'` | `ArrayBuffer` | Raw binary data (default) |
| `'base64'` | `string` | Base64-encoded string |
| `'utf8'` | `string` | UTF-8 decoded string |

```javascript
// Default: ArrayBuffer
const email1 = await PostalMime.parse(rawEmail);
console.log(email1.attachments[0].content instanceof ArrayBuffer); // true

// Base64 encoding
const email2 = await PostalMime.parse(rawEmail, {
    attachmentEncoding: 'base64'
});
console.log(typeof email2.attachments[0].content); // "string"
console.log(email2.attachments[0].encoding);       // "base64"

// UTF-8 encoding (for text attachments)
const email3 = await PostalMime.parse(rawEmail, {
    attachmentEncoding: 'utf8'
});
console.log(typeof email3.attachments[0].content); // "string"
console.log(email3.attachments[0].encoding);       // "utf8"
```

:::note
Calendar parts (`text/calendar` and `application/ics`) are normalized to UTF-8 text with LF line endings and returned as a `Uint8Array` under the default encoding. See [Calendar Attachments](../guides/working-with-attachments#calendar-attachments).
:::

### maxNestingDepth

Maximum allowed MIME part nesting depth. Prevents stack overflow attacks from maliciously crafted emails with deeply nested structures.

```javascript
// Allow deeper nesting (use with caution)
const email = await PostalMime.parse(rawEmail, {
    maxNestingDepth: 512
});

// Stricter limit for untrusted input
const email = await PostalMime.parse(rawEmail, {
    maxNestingDepth: 50
});
```

**Default:** `256`

If the nesting depth is exceeded, an error is thrown:

```javascript
try {
    const email = await PostalMime.parse(maliciousEmail, {
        maxNestingDepth: 10
    });
} catch (error) {
    console.error(error.message);
    // "Maximum MIME nesting depth of 10 levels exceeded"
}
```

### maxHeadersSize

Maximum allowed total header size in bytes. Prevents memory exhaustion from emails with extremely large headers. The limit counts the header bytes of every MIME part of the message together, so a multipart message cannot spend the budget again for each part it declares.

```javascript
// Default is 2MB (2097152 bytes)
const email = await PostalMime.parse(rawEmail, {
    maxHeadersSize: 1048576 // 1MB limit
});
```

**Default:** `2097152` (2MB)

If the header size is exceeded, an error is thrown:

```javascript
try {
    const email = await PostalMime.parse(emailWithLargeHeaders, {
        maxHeadersSize: 1024
    });
} catch (error) {
    console.error(error.message);
    // "Maximum header size of 1024 bytes exceeded"
}
```

### maxRfc822NestingDepth

Maximum depth of inline `message/rfc822` parsing. Each inline nested message is parsed by a new parser instance that holds the whole nested message, so without a limit a small crafted email could nest messages until memory runs out. A message nested deeper than the limit is returned as a regular attachment with `rfc822DepthExceeded: true` instead of being parsed, and nothing inside it is reflected in `text`, `html` or `attachments`.

```javascript
const email = await PostalMime.parse(rawEmail, {
    maxRfc822NestingDepth: 3
});

for (const attachment of email.attachments) {
    if (attachment.rfc822DepthExceeded) {
        // Parse it yourself if you need to see inside, and bound how often you do this
        const nested = await PostalMime.parse(attachment.content);
    }
}
```

**Default:** `10`

Use `0` to disable inline parsing entirely, so that every `message/rfc822` part becomes an attachment.

:::warning
If you scan messages for malicious content, do not treat `attachments` as complete without checking `rfc822DepthExceeded`. A sender can push a payload past the limit to keep it out of `text`, `html` and `attachments`. See the [Security guide](../guides/security#nested-message-recursion-limit).
:::

## Limit Validation

The three limit options must be non-negative integers. Any other value, including a numeric string, `NaN` or `Infinity`, rejects the parse with a `TypeError` rather than silently disabling the limit, and `0` means a literal zero, not "use the default". This matters when options are forwarded from a request or a configuration file:

```javascript
try {
    await PostalMime.parse(rawEmail, { maxNestingDepth: '50' });
} catch (error) {
    console.error(error instanceof TypeError, error.message);
    // true "maxNestingDepth must be a non-negative integer"
}
```

## TypeScript Configuration

```typescript
import PostalMime from 'postal-mime';
import type { PostalMimeOptions, Email } from 'postal-mime';

const options: PostalMimeOptions = {
    attachmentEncoding: 'base64',
    maxNestingDepth: 100,
    maxHeadersSize: 1048576,
    maxRfc822NestingDepth: 3
};

const email: Email = await PostalMime.parse(rawEmail, options);
```

## Security Recommendations

When parsing untrusted email input:

```javascript
const secureOptions = {
    maxNestingDepth: 50,          // Reduce nesting limit
    maxHeadersSize: 524288,       // 512KB header limit
    maxRfc822NestingDepth: 3,     // Fewer levels of nested messages
    forceRfc822Attachments: true  // Don't auto-parse nested emails
};

const email = await PostalMime.parse(untrustedEmail, secureOptions);
```

These options limit nesting, not breadth. A single multipart part with a very large number of children is still expensive to parse, so bound the size of untrusted input before it reaches the parser.

## Default Values Summary

| Option | Default Value |
|--------|---------------|
| `rfc822Attachments` | `false` |
| `forceRfc822Attachments` | `false` |
| `attachmentEncoding` | `'arraybuffer'` |
| `maxNestingDepth` | `256` |
| `maxHeadersSize` | `2097152` (2MB) |
| `maxRfc822NestingDepth` | `10` |
