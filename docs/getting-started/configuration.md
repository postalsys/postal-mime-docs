---
sidebar_position: 3
---

# Configuration

postal-mime provides several options to customize how emails are parsed.

## Options Overview

```javascript
const options = {
    rfc822Attachments: false,      // Treat message/rfc822 as attachments
    forceRfc822Attachments: false, // Force ALL message/rfc822 as attachments
    attachmentEncoding: 'arraybuffer', // How to encode attachment content
    maxNestingDepth: 256,          // Maximum MIME nesting depth
    maxHeadersSize: 2097152        // Maximum header size (2MB)
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

Maximum allowed total header size in bytes. Prevents memory exhaustion from emails with extremely large headers.

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

## TypeScript Configuration

```typescript
import PostalMime from 'postal-mime';
import type { PostalMimeOptions, Email } from 'postal-mime';

const options: PostalMimeOptions = {
    attachmentEncoding: 'base64',
    maxNestingDepth: 100,
    maxHeadersSize: 1048576
};

const email: Email = await PostalMime.parse(rawEmail, options);
```

## Security Recommendations

When parsing untrusted email input:

```javascript
const secureOptions = {
    maxNestingDepth: 50,        // Reduce nesting limit
    maxHeadersSize: 524288,     // 512KB header limit
    forceRfc822Attachments: true // Don't auto-parse nested emails
};

const email = await PostalMime.parse(untrustedEmail, secureOptions);
```

## Default Values Summary

| Option | Default Value |
|--------|---------------|
| `rfc822Attachments` | `false` |
| `forceRfc822Attachments` | `false` |
| `attachmentEncoding` | `'arraybuffer'` |
| `maxNestingDepth` | `256` |
| `maxHeadersSize` | `2097152` (2MB) |
