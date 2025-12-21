---
sidebar_position: 4
---

# Security

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

Oversized headers can cause memory exhaustion. postal-mime enforces a configurable maximum header size.

```javascript
// Default limit is 2MB (2,097,152 bytes)
const email = await PostalMime.parse(rawEmail);

// Stricter limit for untrusted input
const email = await PostalMime.parse(rawEmail, {
    maxHeadersSize: 524288 // 512KB
});
```

### Address Group Nesting Protection

RFC 5322 doesn't allow nested address groups, but malicious input could attempt to create them. postal-mime limits address group recursion to 50 levels and automatically flattens any nested groups.

```javascript
import { addressParser } from 'postal-mime';

// Deeply nested groups are safely handled
const addresses = addressParser(maliciousAddressString);
// Groups are flattened, preventing stack overflow
```

## Security Best Practices

### 1. Set Appropriate Limits

For processing untrusted email (user uploads, incoming mail, etc.):

```javascript
const secureOptions = {
    maxNestingDepth: 50,          // Reduce from default 256
    maxHeadersSize: 524288,       // 512KB instead of 2MB
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
            maxHeadersSize: 524288
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

// NEVER render email HTML directly
document.innerHTML = email.html; // DANGEROUS!

// Always sanitize first
const cleanHtml = DOMPurify.sanitize(email.html, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'u', 'a', 'img', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'src', 'alt']
});
document.innerHTML = cleanHtml; // Safe
```

### 6. Handle Nested Emails Carefully

Nested emails (message/rfc822) can be used to bypass security:

```javascript
// Option 1: Force all nested emails to be attachments
const email = await PostalMime.parse(rawEmail, {
    forceRfc822Attachments: true
});

// Option 2: Manually validate nested email content
const email = await PostalMime.parse(rawEmail);
// Be aware that email.text and email.html may contain
// content from nested emails
```

## Common Attack Vectors

### Billion Laughs (XML Bomb variant)

Deeply nested MIME structures expanding exponentially.

**Protection:** `maxNestingDepth` option limits recursion depth.

### Header Overflow

Extremely large headers causing memory exhaustion.

**Protection:** `maxHeadersSize` option limits total header size.

### Recursive Address Groups

Nested address groups causing stack overflow.

**Protection:** Built-in recursion limit (50 levels) and automatic flattening.

### Malicious HTML

XSS attacks via HTML email content.

**Protection:** postal-mime doesn't render HTML - sanitize before display using DOMPurify or similar.

### Filename Traversal

Attachment filenames like `../../../etc/passwd`.

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
