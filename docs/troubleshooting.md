---
sidebar_position: 6
---

# Troubleshooting

<img src="/img/mascot/confused.png" alt="postal-mime mascot confused" className="mascot-header" />

Common issues and their solutions when using postal-mime.

## Parsing Errors

### "Can not reuse parser, create a new PostalMime object"

**Cause**: Attempting to use the same parser instance twice.

**Solution**: Create a new parser instance for each email:

```javascript
// Wrong
const parser = new PostalMime();
await parser.parse(email1);
await parser.parse(email2); // Error!

// Correct
const email1Parsed = await PostalMime.parse(email1);
const email2Parsed = await PostalMime.parse(email2);

// Or with instances
const parser1 = new PostalMime();
const parser2 = new PostalMime();
await parser1.parse(email1);
await parser2.parse(email2);
```

### "Maximum MIME nesting depth exceeded"

**Cause**: The email contains more nested MIME parts than allowed (default: 256).

**Solutions**:

1. Increase the limit (use with caution):
```javascript
const email = await PostalMime.parse(rawEmail, {
    maxNestingDepth: 512
});
```

2. The email may be malicious - consider rejecting it:
```javascript
try {
    const email = await PostalMime.parse(rawEmail);
} catch (error) {
    if (error.message.includes('nesting depth')) {
        console.log('Rejecting potentially malicious email');
        return;
    }
    throw error;
}
```

### "Maximum header size exceeded"

**Cause**: Headers exceed the size limit (default: 2MB).

**Solutions**:

1. Increase the limit:
```javascript
const email = await PostalMime.parse(rawEmail, {
    maxHeadersSize: 5 * 1024 * 1024 // 5MB
});
```

2. Check if the email is malformed or malicious.

### "maxNestingDepth must be a non-negative integer"

**Cause**: One of the limit options (`maxNestingDepth`, `maxHeadersSize` or `maxRfc822NestingDepth`) was given a value that is not a non-negative integer, such as a numeric string, `NaN` or `Infinity`. The parser rejects these with a `TypeError` instead of silently switching the limit off.

**Solution**: Pass a number. `0` is accepted and means a literal zero, not "use the default":

```javascript
const email = await PostalMime.parse(rawEmail, {
    maxNestingDepth: Number(process.env.MAX_DEPTH) || 256
});
```

## Content Issues

### HTML content is empty but email has HTML

**Possible causes**:

1. The HTML is in an attachment with `Content-Disposition: attachment`:
```javascript
// Check attachments for HTML
const htmlAttachment = email.attachments.find(
    att => att.mimeType === 'text/html'
);

if (htmlAttachment) {
    const decoder = new TextDecoder();
    const html = decoder.decode(htmlAttachment.content);
}
```

2. The email uses `forceRfc822Attachments` and HTML is in a nested email.

### Text content has strange characters

**Cause**: Character encoding issues.

**Solution**: Verify the email has correct Content-Type charset:
```javascript
const contentType = email.headers.find(h => h.key === 'content-type');
console.log('Content-Type:', contentType?.value);
```

postal-mime does not guess the encoding: a part without a charset is decoded as UTF-8, and a charset label that cannot be resolved falls back to windows-1252. If the message declares the wrong charset, the text comes out wrong too.

### Missing subject or other headers

**Check**: List every header the parser saw. Where a header appears more than once, a property such as `subject` reflects the first occurrence:

```javascript
// Check all headers
email.headers.forEach(h => {
    console.log(`${h.key}: ${h.value}`);
});

// Keys are always lowercase, so no case handling is needed
const subject = email.headers.find(h => h.key === 'subject');
```

## Attachment Issues

### Attachments array is empty

**Possible causes**:

1. Email doesn't have attachments (check raw email)

2. All attachments are inline (related to HTML):
```javascript
// Check for related attachments
const relatedAttachments = email.attachments.filter(a => a.related);
console.log('Related attachments:', relatedAttachments.length);
```

3. Nested email attachments with default settings:
```javascript
// By default, message/rfc822 parts are inlined
// Use this option to treat them as attachments:
const email = await PostalMime.parse(rawEmail, {
    forceRfc822Attachments: true
});
```

### Attachment content is corrupted

**Check the encoding**:

```javascript
const email = await PostalMime.parse(rawEmail);

email.attachments.forEach(att => {
    console.log('Filename:', att.filename);
    console.log('Content type:', typeof att.content);
    console.log('Size:', att.content.byteLength);
});
```

**Solution**: Ensure you're handling the ArrayBuffer correctly:

```javascript
// For saving in Node.js
import { writeFile } from 'fs/promises';

const buffer = Buffer.from(att.content);
await writeFile('file.pdf', buffer);

// For downloading in browser
const blob = new Blob([att.content], { type: att.mimeType });
const url = URL.createObjectURL(blob);
```

### A message/rfc822 attachment has `rfc822DepthExceeded: true`

**Cause**: The nested message sits deeper than `maxRfc822NestingDepth` (default: 10) allows, so the parser returned it as an attachment instead of parsing it inline. Nothing inside it is reflected in `text`, `html` or `attachments`.

**Solution**: Parse the attachment content yourself if you need to see inside, and bound how many levels you follow:

```javascript
if (attachment.rfc822DepthExceeded) {
    const nested = await PostalMime.parse(attachment.content);
}
```

### Filename is null

**Cause**: The attachment doesn't have a filename in Content-Disposition or Content-Type.

**Solution**: Generate a filename based on MIME type:

```javascript
function getFilename(attachment) {
    if (attachment.filename) return attachment.filename;

    const extensions = {
        'application/pdf': 'pdf',
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'text/plain': 'txt',
        'text/html': 'html'
    };

    const ext = extensions[attachment.mimeType] || 'bin';
    return `attachment.${ext}`;
}
```

## Address Parsing Issues

### Group addresses not parsed correctly

**Solution**: Use type checking to handle groups:

```javascript
import { addressParser } from 'postal-mime';

const addresses = addressParser(headerValue);

addresses.forEach(addr => {
    if (addr.group) {
        console.log(`Group: ${addr.name}`);
        addr.group.forEach(member => {
            console.log(`  Member: ${member.address}`);
        });
    } else {
        console.log(`Address: ${addr.address}`);
    }
});
```

### Encoded names not decoded

**Check**: Ensure the encoded-word format is correct:

```javascript
import { decodeWords } from 'postal-mime';

const encoded = '=?UTF-8?B?SGVsbG8=?=';
const decoded = decodeWords(encoded);
console.log(decoded); // "Hello"
```

If decoding fails, the charset might be unsupported.

## Environment Issues

### Module not found / import errors

**For ESM (recommended)**:
```javascript
import PostalMime from 'postal-mime';
```

**For CommonJS**:
```javascript
const PostalMime = require('postal-mime');
```

**For browser direct import** (postal-mime 4.0 and later; 3.x releases ship the module at `src/postal-mime.js` instead):
```javascript
import PostalMime from './node_modules/postal-mime/dist/esm/postal-mime.js';
```

### TypeScript errors

**Solution**: Ensure types are properly imported:

```typescript
import PostalMime from 'postal-mime';
import type { Email, PostalMimeOptions } from 'postal-mime';

const options: PostalMimeOptions = {
    attachmentEncoding: 'base64'
};

const email: Email = await PostalMime.parse(rawEmail, options);
```

### Blob not defined (Node.js)

**Cause**: Node.js older than 18 has no global `Blob`, and postal-mime needs Node.js 18 or newer.

**Solution**: Upgrade Node.js. The parser checks every input against `Blob`, so passing a Buffer does not avoid the error on older versions:

```javascript
import { readFile } from 'fs/promises';

const buffer = await readFile('email.eml');
const email = await PostalMime.parse(buffer);
```

## Performance Issues

### Parsing large emails is slow

**Solutions**:

1. Use Web Workers for browser environments (see [Web Worker example](./examples/web-worker))

2. The entire message is held in memory while it is parsed, including when a `ReadableStream` is passed in, so bound the size of untrusted input before parsing it

3. Keep the default `attachmentEncoding` of `'arraybuffer'` unless you need strings: the `base64` and `utf8` encodings do extra work after parsing

### Memory usage is high

**Causes**:

1. Large attachments are kept in memory
2. Multiple emails parsed without releasing memory

**Solutions**:

1. Process one email at a time and allow garbage collection

2. Extract and save attachments immediately, then clear references:
```javascript
const email = await PostalMime.parse(rawEmail);

// Save attachments to disk/storage
for (const att of email.attachments) {
    await saveAttachment(att);
}

// Clear the email object
email = null;
```

## Still Having Issues?

1. **Check the raw email**: Use a text editor to verify the email format
2. **Validate the MIME structure**: Tools like `munpack` can help
3. **Enable debugging**: Add console.log statements to trace the issue
4. **Report a bug**: [GitHub Issues](https://github.com/postalsys/postal-mime/issues)

When reporting issues, please include:
- postal-mime version
- Node.js/browser version
- Minimal reproducible example
- Sample email (if possible, anonymized)
