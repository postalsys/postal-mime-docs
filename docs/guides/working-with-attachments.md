---
sidebar_position: 2
---

# Working with Attachments

This guide covers how to extract, process, and work with email attachments using postal-mime.

## Understanding Attachments

postal-mime automatically handles RFC 2231 parameter value continuations, which are used for long filenames that span multiple header lines. You don't need to do anything special - filenames are automatically reassembled.

Attachments in postal-mime are returned as an array of objects with the following properties:

```javascript
{
    filename: string | null,       // Original filename (may be null)
    mimeType: string,              // MIME type (e.g., "application/pdf")
    disposition: string | null,    // "attachment", "inline", or null
    related?: boolean,             // true if inline image (optional)
    contentId?: string,            // Content-ID for inline images (optional)
    description?: string,          // Content-Description header (optional)
    content: ArrayBuffer | string, // File content
    encoding?: string,             // "base64" or "utf8" if converted (optional)
    method?: string                // Calendar method for ICS files (optional)
}
```

## Basic Attachment Access

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse(rawEmail);

console.log(`Found ${email.attachments.length} attachments`);

email.attachments.forEach((attachment, index) => {
    console.log(`Attachment ${index + 1}:`);
    console.log(`  Filename: ${attachment.filename}`);
    console.log(`  Type: ${attachment.mimeType}`);
    console.log(`  Size: ${attachment.content.byteLength} bytes`);
});
```

## Attachment Types

### Regular Attachments

Standard file attachments have `disposition: "attachment"`:

```javascript
const regularAttachments = email.attachments.filter(
    att => att.disposition === 'attachment'
);
```

### Inline Attachments

Inline attachments (like embedded images) have `disposition: "inline"`:

```javascript
const inlineAttachments = email.attachments.filter(
    att => att.disposition === 'inline'
);
```

### Related Attachments

Images referenced in HTML content are marked with `related: true`:

```javascript
const relatedImages = email.attachments.filter(att => att.related);

// These can be referenced in HTML via their contentId
relatedImages.forEach(img => {
    console.log(`CID: ${img.contentId}`);
    // Referenced in HTML as: <img src="cid:${img.contentId}">
});
```

## Encoding Options

### ArrayBuffer (Default)

By default, attachment content is returned as `ArrayBuffer`:

```javascript
const email = await PostalMime.parse(rawEmail);
const attachment = email.attachments[0];

// Convert to Uint8Array for processing
const bytes = new Uint8Array(attachment.content);
```

### Base64 Encoding

Use `attachmentEncoding: 'base64'` to get base64-encoded strings:

```javascript
const email = await PostalMime.parse(rawEmail, {
    attachmentEncoding: 'base64'
});

const attachment = email.attachments[0];
console.log(attachment.content);   // Base64 string
console.log(attachment.encoding);  // "base64"

// Create data URL for images
if (attachment.mimeType.startsWith('image/')) {
    const dataUrl = `data:${attachment.mimeType};base64,${attachment.content}`;
}
```

### UTF-8 Encoding

Use `attachmentEncoding: 'utf8'` for text-based attachments:

```javascript
const email = await PostalMime.parse(rawEmail, {
    attachmentEncoding: 'utf8'
});

const textAttachment = email.attachments.find(
    att => att.mimeType === 'text/plain'
);
console.log(textAttachment.content); // UTF-8 string
```

## Saving Attachments

### Browser - File Download

```javascript
function downloadAttachment(attachment) {
    const blob = new Blob([attachment.content], {
        type: attachment.mimeType
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.filename || 'attachment';
    link.click();

    URL.revokeObjectURL(url);
}

// Download all attachments
email.attachments.forEach(downloadAttachment);
```

### Node.js - Save to Disk

```javascript
import { writeFile } from 'fs/promises';

async function saveAttachment(attachment, directory = './attachments') {
    const filename = attachment.filename || 'attachment';
    const filepath = `${directory}/${filename}`;

    await writeFile(filepath, Buffer.from(attachment.content));
    console.log(`Saved: ${filepath}`);
}

for (const attachment of email.attachments) {
    await saveAttachment(attachment);
}
```

## Displaying Inline Images

Replace CID references in HTML with data URLs:

```javascript
function replaceInlineImages(html, attachments) {
    let processedHtml = html;

    const inlineImages = attachments.filter(
        att => att.related && att.contentId
    );

    for (const img of inlineImages) {
        // Remove angle brackets from contentId
        const cid = img.contentId.replace(/^<|>$/g, '');

        // Convert to base64 data URL
        const bytes = new Uint8Array(img.content);
        const base64 = btoa(String.fromCharCode(...bytes));
        const dataUrl = `data:${img.mimeType};base64,${base64}`;

        // Replace all CID references
        processedHtml = processedHtml.replace(
            new RegExp(`cid:${cid}`, 'gi'),
            dataUrl
        );
    }

    return processedHtml;
}

const htmlWithImages = replaceInlineImages(email.html, email.attachments);
```

## Filtering Attachments

### By MIME Type

```javascript
// Get all images
const images = email.attachments.filter(
    att => att.mimeType.startsWith('image/')
);

// Get all PDFs
const pdfs = email.attachments.filter(
    att => att.mimeType === 'application/pdf'
);

// Get all text files
const textFiles = email.attachments.filter(
    att => att.mimeType.startsWith('text/')
);
```

### By File Extension

```javascript
function getExtension(filename) {
    if (!filename) return '';
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

const spreadsheets = email.attachments.filter(att => {
    const ext = getExtension(att.filename);
    return ['xlsx', 'xls', 'csv'].includes(ext);
});
```

### By Size

```javascript
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const largeAttachments = email.attachments.filter(
    att => att.content.byteLength > MAX_SIZE
);

const smallAttachments = email.attachments.filter(
    att => att.content.byteLength <= MAX_SIZE
);
```

## Calendar Attachments

Calendar events (ICS files) receive special handling:

- Content is decoded to UTF-8 text
- Line endings are normalized to `\n` (LF)
- The `method` parameter is extracted from the Content-Type header
- Content is returned as `Uint8Array` (not `ArrayBuffer`)

```javascript
const calendarEvents = email.attachments.filter(
    att => att.mimeType === 'text/calendar' ||
           att.mimeType === 'application/ics'
);

calendarEvents.forEach(event => {
    console.log(`Calendar event method: ${event.method}`);
    // event.method can be "REQUEST", "REPLY", "CANCEL", etc.

    // Content is already normalized UTF-8 as Uint8Array
    const decoder = new TextDecoder();
    const icsContent = decoder.decode(event.content);
    console.log(icsContent);
});
```

:::tip
The `method` property indicates the calendar action: `REQUEST` for meeting invitations, `REPLY` for responses, `CANCEL` for cancellations, and `PUBLISH` for published events.
:::

## Complete Attachment Handler

```javascript
class AttachmentHandler {
    constructor(email) {
        this.attachments = email.attachments;
    }

    getAll() {
        return this.attachments;
    }

    getByType(mimeType) {
        return this.attachments.filter(att =>
            att.mimeType === mimeType
        );
    }

    getImages() {
        return this.attachments.filter(att =>
            att.mimeType.startsWith('image/')
        );
    }

    getInlineImages() {
        return this.attachments.filter(att =>
            att.related && att.mimeType.startsWith('image/')
        );
    }

    getDocuments() {
        const docTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument'
        ];
        return this.attachments.filter(att =>
            docTypes.some(type => att.mimeType.startsWith(type))
        );
    }

    getTotalSize() {
        return this.attachments.reduce(
            (total, att) => total + att.content.byteLength,
            0
        );
    }

    toDataUrl(attachment) {
        const bytes = new Uint8Array(attachment.content);
        const base64 = btoa(String.fromCharCode(...bytes));
        return `data:${attachment.mimeType};base64,${base64}`;
    }
}

// Usage
const handler = new AttachmentHandler(email);
console.log(`Total attachment size: ${handler.getTotalSize()} bytes`);
console.log(`Images: ${handler.getImages().length}`);
console.log(`Documents: ${handler.getDocuments().length}`);
```
