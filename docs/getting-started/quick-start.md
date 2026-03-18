---
sidebar_position: 2
---

# Quick Start

This guide will help you parse your first email with postal-mime in just a few minutes.

## Basic Usage

The simplest way to parse an email is using the static `PostalMime.parse()` method:

```javascript
import PostalMime from 'postal-mime';

const rawEmail = `From: sender@example.com
To: recipient@example.com
Subject: Hello World
Content-Type: text/plain

This is the email body.`;

const email = await PostalMime.parse(rawEmail);

console.log(email.from);    // { name: '', address: 'sender@example.com' }
console.log(email.subject); // "Hello World"
console.log(email.text);    // "This is the email body."
```

## Understanding the Email Object

The parsed email object contains all the information from the message:

```javascript
const email = await PostalMime.parse(rawEmail);

// Headers
console.log(email.headers);     // Array of all headers

// Sender information
console.log(email.from);        // From address
console.log(email.sender);      // Sender address (if different)
console.log(email.replyTo);     // Reply-To addresses

// Recipients
console.log(email.to);          // To addresses (array)
console.log(email.cc);          // CC addresses (array)
console.log(email.bcc);         // BCC addresses (array)

// Message identifiers
console.log(email.messageId);   // Message-ID header
console.log(email.inReplyTo);   // In-Reply-To header
console.log(email.references);  // References header

// Content
console.log(email.subject);     // Subject line
console.log(email.date);        // Date in ISO 8601 format
console.log(email.text);        // Plain text content
console.log(email.html);        // HTML content

// Attachments
console.log(email.attachments); // Array of attachments
```

## Parsing HTML Emails

postal-mime extracts content based on what is present in the email:

```javascript
const htmlEmail = `Subject: Newsletter
Content-Type: text/html; charset=utf-8

<h1>Welcome!</h1>
<p>Thanks for subscribing.</p>`;

const email = await PostalMime.parse(htmlEmail);

console.log(email.html); // "<h1>Welcome!</h1>\n<p>Thanks for subscribing.</p>"
console.log(email.text); // undefined (only HTML was provided)
```

:::note
For single-part emails, only the format present in the message is returned. If the email contains only HTML, `email.text` will be `undefined`, and vice versa. Both `text` and `html` are available when the email uses `multipart/alternative` to provide both formats.
:::

## Parsing Emails with Attachments

Attachments are automatically extracted:

```javascript
const email = await PostalMime.parse(emailWithAttachments);

for (const attachment of email.attachments) {
    console.log(attachment.filename);    // "document.pdf"
    console.log(attachment.mimeType);    // "application/pdf"
    console.log(attachment.disposition); // "attachment" or "inline"
    console.log(attachment.content);     // ArrayBuffer with file content
}
```

## Input Formats

postal-mime accepts multiple input formats:

```javascript
// String input
const email1 = await PostalMime.parse(emailString);

// ArrayBuffer
const email2 = await PostalMime.parse(arrayBuffer);

// Uint8Array
const email3 = await PostalMime.parse(uint8Array);

// Blob (browser)
const email4 = await PostalMime.parse(blob);

// Buffer (Node.js)
const email5 = await PostalMime.parse(buffer);

// ReadableStream
const email6 = await PostalMime.parse(readableStream);
```

## TypeScript Example

```typescript
import PostalMime from 'postal-mime';
import type { Email, Attachment } from 'postal-mime';

const email: Email = await PostalMime.parse(rawEmail);

// Type-safe access to properties
const subject: string | undefined = email.subject;

// Working with attachments
email.attachments.forEach((att: Attachment) => {
    console.log(att.filename, att.mimeType);
});
```

## Next Steps

- [Configuration](./configuration) - Learn about parsing options
- [Parsing Emails](../guides/parsing-emails) - Deep dive into email parsing
- [Working with Attachments](../guides/working-with-attachments) - Handle email attachments
