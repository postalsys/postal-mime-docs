---
sidebar_position: 4
---

# Security

<img src="/img/mascot/catching.png" alt="postal-mime mascot catching threats" className="mascot-header" />

postal-mime includes built-in security measures and provides configuration options for handling untrusted email input safely.

## Built-in Protections

### Nesting Depth Limit

Malicious emails can contain deeply nested MIME structures designed to cause stack overflow or performance degradation. postal-mime prevents this with a configurable nesting depth limit.

```javascript
// Default limit is 256 levels
const email = await PostalMime.parse(rawEmail);

// Custom limit for stricter security
const email = await PostalMime.parse(rawEmail, {
    maxNestingDepth: 50
});
```

When the limit is exceeded, an error is thrown:

```javascript
try {
    const email = await PostalMime.parse(maliciousEmail);
} catch (error) {
    console.error(error.message);
    // "Maximum MIME nesting depth of 256 levels exceeded"
}
```

### Header Size Limit

Oversized headers can cause memory exhaustion. postal-mime enforces a configurable maximum header size, counted across every MIME part of the message, so a multipart message cannot spend the budget again for each part it declares.

```javascript
// Default limit is 2MB (2,097,152 bytes)
const email = await PostalMime.parse(rawEmail);

// Stricter limit for untrusted input
const email = await PostalMime.parse(rawEmail, {
    maxHeadersSize: 524288 // 512KB
});
```

### Nested Message Recursion Limit

Inline `message/rfc822` parts are parsed by a new parser instance per level, and each instance holds the whole nested message, so a small email that nests messages hundreds of levels deep could exhaust memory. `maxRfc822NestingDepth` (default: 10) caps that recursion: a message nested deeper is returned as an attachment flagged with `rfc822DepthExceeded: true`, and nothing inside it is reflected in `text`, `html` or `attachments`.

```javascript
const email = await PostalMime.parse(rawEmail, {
    maxRfc822NestingDepth: 3
});
```

:::warning Hidden nested content
If you scan messages for malicious content, do not treat `attachments` as complete without checking `rfc822DepthExceeded`. A sender can push a payload past the limit on purpose to keep it out of the parsed output. Re-parse a flagged attachment if you need to see inside it, and bound how many times you do so:

```javascript
for (const attachment of email.attachments) {
    if (attachment.rfc822DepthExceeded) {
        const nested = await PostalMime.parse(attachment.content);
        // scan `nested` too
    }
}
```
:::

### Limit Option Validation

The three limit options must be non-negative integers. A numeric string, `NaN`, `Infinity` or a negative number rejects the parse with a `TypeError` instead of silently switching the limit off, so options forwarded from a request or a configuration file cannot be used to disable the protections.

### Consistent Header Resolution

Where a message carries a header more than once, postal-mime always resolves the first occurrence, both for the headers that decide how a part is read (`Content-Type`, `Content-Transfer-Encoding`, `Content-Disposition`, `Content-ID`, `Content-Description`) and for single-value properties such as `subject` and `from`. A message therefore cannot present one `Content-Type` to a security scanner and a different one to the parser. Duplicate parameters inside a header, such as two `boundary` values, resolve to the first one as well.

Header names are trimmed of nothing but the SP and HTAB characters RFC 5322 allows, and only SP and HTAB continue a folded header. A line that starts with a non-breaking space, a byte order mark or another Unicode space is kept as a header of its own with its original name, so it cannot collide with, or outrank, a genuine `From:` header. Every header is listed in `headers`, duplicates included, so a scanner can see them all.

### Address Extraction Safeguards

`addressParser()` never extracts an address from inside a quoted string, because RFC 5321 allows `@` in a quoted local part and pulling `user@domain` out of `"user@domain"@example.com` would misroute mail. It also does not turn a bare encoded word such as `=?utf-8?B?...?=` into an address after decoding it unless the decoded text carries an explicit angle bracket address; otherwise the decoded text becomes a display name only. Nested address groups, which RFC 5322 does not allow, are limited to 50 levels of recursion and flattened into the outer group.

### Linear Time Parsing

Header trimming, comment stripping, address detection, encoded word handling, `format=flowed` unfolding and the HTML to text conversion are all implemented in linear time, so a crafted header or body cannot hold a core busy with regular expression backtracking. The limits above bound nesting, not breadth: a single multipart part with a very large number of children is still work, so bound the size of untrusted input before it reaches the parser.

## Security Best Practices

### 1. Set Appropriate Limits

For processing untrusted email (user uploads, incoming mail, etc.):

```javascript
const secureOptions = {
    maxNestingDepth: 50,          // Reduce from default 256
    maxHeadersSize: 524288,       // 512KB instead of 2MB
    maxRfc822NestingDepth: 3,     // Fewer levels of nested messages
    forceRfc822Attachments: true  // Don't auto-parse nested emails
};

const email = await PostalMime.parse(untrustedEmail, secureOptions);
```

### 2. Handle Parsing Errors

Always wrap parsing in try-catch:

```javascript
async function parseEmailSafely(rawEmail) {
    try {
        return await PostalMime.parse(rawEmail, {
            maxNestingDepth: 50,
            maxHeadersSize: 524288,
            maxRfc822NestingDepth: 3
        });
    } catch (error) {
        console.error('Email parsing failed:', error.message);
        return null;
    }
}
```

### 3. Validate Attachment Types

Don't trust attachment MIME types blindly:

```javascript
const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain'
];

const safeAttachments = email.attachments.filter(att =>
    ALLOWED_TYPES.includes(att.mimeType)
);
```

### 4. Limit Attachment Sizes

```javascript
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TOTAL_SIZE = 25 * 1024 * 1024;      // 25MB

const totalSize = email.attachments.reduce(
    (sum, att) => sum + att.content.byteLength,
    0
);

if (totalSize > MAX_TOTAL_SIZE) {
    throw new Error('Total attachment size exceeds limit');
}

const oversized = email.attachments.filter(
    att => att.content.byteLength > MAX_ATTACHMENT_SIZE
);

if (oversized.length > 0) {
    throw new Error('Individual attachment too large');
}
```

### 5. Sanitize HTML Content

postal-mime does not sanitize HTML content. Always sanitize before rendering:

```javascript
import DOMPurify from 'dompurify';

const container = document.getElementById('email-content');

// NEVER render email HTML directly
container.innerHTML = email.html; // DANGEROUS!

// Always sanitize first
const cleanHtml = DOMPurify.sanitize(email.html, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'u', 'a', 'img', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'src', 'alt']
});
container.innerHTML = cleanHtml; // Safe
```

### 6. Handle Nested Emails Carefully

Nested emails (message/rfc822) can be used to bypass security:

```javascript
// Option 1: Force all nested emails to be attachments
const email = await PostalMime.parse(rawEmail, {
    forceRfc822Attachments: true
});

// Option 2: Let the parser inline them, but check the flagged ones
const email = await PostalMime.parse(rawEmail);
// email.text and email.html may contain content from nested emails, and any
// attachment with rfc822DepthExceeded holds a nested message that was not parsed
```

## Common Attack Vectors

### Billion Laughs (XML Bomb variant)

Deeply nested MIME structures expanding exponentially.

**Protection:** `maxNestingDepth` option limits recursion depth.

### Header Overflow

Extremely large headers causing memory exhaustion.

**Protection:** `maxHeadersSize` option limits total header size across every part.

### Nested Message Bombs

Messages nested inside messages, each level spawning a parser that holds the whole nested message.

**Protection:** `maxRfc822NestingDepth` caps the recursion and flags the skipped messages with `rfc822DepthExceeded`.

### Recursive Address Groups

Nested address groups causing stack overflow.

**Protection:** Built-in recursion limit (50 levels) and automatic flattening.

### Parser Differentials

Duplicated `Content-Type` or `From` headers, or header names padded with Unicode whitespace, that a scanner and the parser resolve differently.

**Protection:** The first occurrence of a header always wins, and only RFC 5322 whitespace is trimmed from header names.

### Malicious HTML

XSS attacks via HTML email content.

**Protection:** postal-mime doesn't render HTML - sanitize before display using DOMPurify or similar.

### Filename Traversal

Attachment filenames like `../../../etc/passwd`. postal-mime decodes RFC 2231 continuations exactly as written, so a percent encoded traversal cannot be smuggled through a section that was not marked as encoded, but the decoded name is still whatever the sender chose.

**Protection:** Always sanitize filenames before saving:

```javascript
function sanitizeFilename(filename) {
    if (!filename) return 'attachment';

    // Remove path components
    const basename = filename.split(/[/\\]/).pop();

    // Remove dangerous characters
    return basename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

const safeFilename = sanitizeFilename(attachment.filename);
```

## Security Checklist

- [ ] Set `maxNestingDepth` to a reasonable limit (e.g., 50)
- [ ] Set `maxHeadersSize` to a reasonable limit (e.g., 512KB)
- [ ] Set `maxRfc822NestingDepth` to the number of nested levels you actually need
- [ ] Check `rfc822DepthExceeded` on attachments if you scan content
- [ ] Bound the size of untrusted input before parsing it
- [ ] Wrap parsing in try-catch
- [ ] Validate attachment MIME types against allowlist
- [ ] Limit individual and total attachment sizes
- [ ] Sanitize HTML content before rendering
- [ ] Sanitize attachment filenames before saving
- [ ] Consider using `forceRfc822Attachments: true` for untrusted input
- [ ] Log parsing failures for monitoring

## Recommended Configuration

For production use with untrusted input:

```javascript
const PRODUCTION_OPTIONS = {
    maxNestingDepth: 50,
    maxHeadersSize: 524288,       // 512KB
    maxRfc822NestingDepth: 3,
    forceRfc822Attachments: true,
    attachmentEncoding: 'base64'  // Easier to validate
};

async function parseEmail(rawEmail) {
    try {
        const email = await PostalMime.parse(rawEmail, PRODUCTION_OPTIONS);

        // Validate total size
        const totalSize = email.attachments.reduce(
            (sum, att) => sum + (
                typeof att.content === 'string'
                    ? att.content.length * 0.75  // Base64 overhead
                    : att.content.byteLength
            ),
            0
        );

        if (totalSize > 25 * 1024 * 1024) {
            throw new Error('Email too large');
        }

        return email;
    } catch (error) {
        console.error('Email parsing failed:', error);
        throw error;
    }
}
```
