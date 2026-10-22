---
title: Quick Start
sidebar_position: 2
description: Parse a first email with postal-mime and read its sender, recipients, subject, body and attachments.
---

# Quick Start

<img src="/img/mascot/carrying.png" alt="postal-mime mascot carrying emails" className="mascot-header" />

This page parses a message and reads the most used properties of the result. It assumes postal-mime is [installed](./installation).

## Parse a message

`PostalMime.parse()` takes the raw message and returns a promise of the parsed [`Email`](../api/email) object:

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse(`From: Alice <alice@example.com>
To: bob@example.com
Subject: Hello World
Date: Mon, 15 Jan 2024 10:30:00 +0000
Content-Type: text/plain; charset=utf-8

This is the email body.`);

console.log(email.from);    // { address: 'alice@example.com', name: 'Alice' }
console.log(email.to);      // [ { address: 'bob@example.com', name: '' } ]
console.log(email.subject); // "Hello World"
console.log(email.date);    // "2024-01-15T10:30:00.000Z"
console.log(email.text);    // "This is the email body.\n"
```

The raw message can be a string, an `ArrayBuffer`, a `Uint8Array` or Node.js `Buffer`, a `Blob` or `File`, or a `ReadableStream`. When you read a message from a file or the network, pass the bytes rather than a decoded string, so that text in other charsets is decoded correctly:

```javascript
import PostalMime from 'postal-mime';
import { readFile } from 'node:fs/promises';

const email = await PostalMime.parse(await readFile('message.eml'));
console.log(email.subject);
```

## What the result holds

| Property | Holds |
|----------|-------|
| `from`, `sender` | A single address object |
| `to`, `cc`, `bcc`, `replyTo` | Arrays of address objects |
| `subject` | The decoded subject |
| `date` | The date as an ISO 8601 string |
| `messageId`, `inReplyTo`, `references` | Threading headers |
| `text`, `html` | The plain text and HTML bodies |
| `attachments` | Every part that is not part of the body |
| `headers`, `headerLines` | Every header, parsed and raw |

Properties other than `headers`, `headerLines` and `attachments` are left out when the message has no value for them. The [Email Object](../api/email) page documents each one.

## Text and HTML

`text` and `html` are filled from the parts the message has. A message with only an HTML part has no `text`:

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse(`Subject: Newsletter
Content-Type: text/html; charset=utf-8

<h1>Welcome!</h1>
<p>Thanks for subscribing.</p>`);

console.log(email.html); // "<h1>Welcome!</h1>\n<p>Thanks for subscribing.</p>\n"
console.log(email.text); // undefined
```

A `multipart/alternative` message usually carries both. See [Text and HTML](../api/email#text-and-html) for how a body made of several parts is assembled.

:::warning
`html` is the sender's markup and is not sanitized. Sanitize it or render it in a sandboxed iframe before showing it, see the [Security guide](../guides/security#5-sanitize-html-content).
:::

## Attachments

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse(`Subject: Report
Content-Type: multipart/mixed; boundary="b"

--b
Content-Type: text/plain

The report is attached.
--b
Content-Type: text/csv; name="report.csv"
Content-Disposition: attachment; filename="report.csv"

month,total
--b--
`);

for (const attachment of email.attachments) {
    console.log(attachment.filename);           // "report.csv"
    console.log(attachment.mimeType);           // "text/csv"
    console.log(attachment.disposition);        // "attachment"
    console.log(attachment.content.byteLength); // 11
}
```

`content` is an `ArrayBuffer` by default. The [`attachmentEncoding`](../api/options#attachmentencoding) option returns it as a base64 or UTF-8 string instead.

## TypeScript

```typescript
import PostalMime from 'postal-mime';
import type { Email } from 'postal-mime';

const email: Email = await PostalMime.parse('Subject: Hello\n\nHi there');
const subject: string = email.subject ?? '(no subject)';
console.log(subject);
```

## See Also

- [Parsing Emails](../guides/parsing-emails) - Input types, headers, addresses and nested messages
- [Working with Attachments](../guides/working-with-attachments) - Saving, filtering and displaying attachments
- [Parser Options](../api/options) - Attachment encoding and security limits
- [Email Object](../api/email) - Every property of the result
