---
title: Basic Parsing
sidebar_position: 1
description: Complete postal-mime examples for plain text, HTML, multipart, attachments, multiple recipients, encoded headers, files, fetch, uploads and Cloudflare Email Workers.
---

# Basic Parsing

<img src="/img/mascot/overwhelmed.png" alt="postal-mime mascot with emails" className="mascot-header" />

Each example on this page runs as written in Node.js 20 or newer, unless it says it is for the browser or a worker. The comments show what the current release prints.

## Plain text message

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse(`From: alice@example.com
To: bob@example.com
Subject: Hello Bob
Date: Mon, 15 Jan 2024 10:30:00 +0000
Content-Type: text/plain; charset=utf-8

Hi Bob,

Just wanted to say hello!

Best,
Alice`);

console.log(email.from);    // { address: 'alice@example.com', name: '' }
console.log(email.to);      // [ { address: 'bob@example.com', name: '' } ]
console.log(email.subject); // "Hello Bob"
console.log(email.date);    // "2024-01-15T10:30:00.000Z"
console.log(JSON.stringify(email.text));
// "Hi Bob,\n\nJust wanted to say hello!\n\nBest,\nAlice\n"
```

## HTML message

A single-part HTML message has `html` and no `text`:

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse(`From: newsletter@example.com
Subject: Weekly Update
MIME-Version: 1.0
Content-Type: text/html; charset=utf-8

<h1>Weekly Newsletter</h1>
<p>Here is what happened this week.</p>`);

console.log(Boolean(email.html)); // true
console.log(email.text);          // undefined
```

## Multipart message with text and HTML

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse(`From: sender@example.com
Subject: Important Update
MIME-Version: 1.0
Content-Type: multipart/alternative; boundary="boundary123"

--boundary123
Content-Type: text/plain; charset=utf-8

This is the plain text version.

--boundary123
Content-Type: text/html; charset=utf-8

<p>This is the <strong>HTML</strong> version.</p>

--boundary123--`);

console.log(JSON.stringify(email.text)); // "This is the plain text version.\n"
console.log(JSON.stringify(email.html)); // "<p>This is the <strong>HTML</strong> version.</p>\n"
```

The blank line before each boundary is part of the content, which is why both bodies end with a line break. The line break directly in front of a boundary belongs to the boundary.

## Message with an attachment

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse(`From: sender@example.com
Subject: Document Attached
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="boundary456"

--boundary456
Content-Type: text/plain; charset=utf-8

Please find the document attached.
--boundary456
Content-Type: application/pdf; name="document.pdf"
Content-Disposition: attachment; filename="document.pdf"
Content-Transfer-Encoding: base64

JVBERi0xLjQKJeLjz9MK
--boundary456--`);

console.log(email.text);               // "Please find the document attached.\n"
console.log(email.attachments.length); // 1

const [attachment] = email.attachments;
console.log(attachment.filename);           // "document.pdf"
console.log(attachment.mimeType);           // "application/pdf"
console.log(attachment.disposition);        // "attachment"
console.log(attachment.content.byteLength); // 15
```

## Multiple recipients

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse(`From: sender@example.com
To: alice@example.com, Bob <bob@example.com>
Cc: charlie@example.com
Bcc: admin@example.com
Subject: Team Update

Hello team!`);

console.log(email.to.map(addr => addr.address));  // [ 'alice@example.com', 'bob@example.com' ]
console.log(email.cc.map(addr => addr.address));  // [ 'charlie@example.com' ]
console.log(email.bcc.map(addr => addr.address)); // [ 'admin@example.com' ]
```

A `Bcc` header is present only in a copy that kept it, such as a message read from the sender's Sent folder.

## Encoded headers

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse(`From: =?UTF-8?B?5bGx55Sw5aSq6YOO?= <yamada@example.jp>
To: user@example.com
Subject: =?UTF-8?Q?Caf=C3=A9_Menu?=
Content-Type: text/plain; charset=utf-8

Content here`);

console.log(email.from.name); // "山田太郎", decoded from base64
console.log(email.subject);   // "Café Menu", decoded from quoted-printable
```

## Reading a file in Node.js

```javascript
import PostalMime from 'postal-mime';
import { readFile } from 'node:fs/promises';

async function parseEmailFile(filepath) {
    // Pass the Buffer, not a string, so text in any charset decodes correctly
    return PostalMime.parse(await readFile(filepath));
}

const email = await parseEmailFile('./message.eml');
console.log(email.subject);
```

## Reading a fetch response

```javascript
import PostalMime from 'postal-mime';

async function parseRemoteEmail(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
    }
    return PostalMime.parse(await response.arrayBuffer());
}

const email = await parseRemoteEmail('https://example.com/message.eml');
console.log(email.subject);
```

## Reading a file input in the browser

This runs in a page with an `<input type="file" id="email-file">` and elements with the IDs `subject`, `from` and `body`. The body is shown as text, which needs no sanitizing; see the [Email Viewer](./email-viewer) for rendering HTML safely.

```javascript
import PostalMime from 'postal-mime';

document.querySelector('#email-file').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    // A File is a Blob, which the parser reads as bytes
    const email = await PostalMime.parse(file);

    document.getElementById('subject').textContent = email.subject || '(no subject)';
    document.getElementById('from').textContent = email.from?.address || '';
    document.getElementById('body').textContent = email.text || '';
});
```

## Cloudflare Email Worker

In an Email Worker, pass `message.raw`, a `ReadableStream`, to the parser. The stream can be read only once, so parse it a single time and reuse the result:

```javascript
import PostalMime from 'postal-mime';

export default {
    async email(message, env, ctx) {
        const email = await PostalMime.parse(message.raw);

        console.log('Envelope from:', message.from);
        console.log('Subject:', email.subject);
        console.log('Attachments:', email.attachments.length);

        await message.forward('inbox@example.com');
    }
};
```

See the [Cloudflare Workers guide](../guides/cloudflare-workers) for TypeScript, local testing with Wrangler, storing attachments in R2 and handling limit errors.

## Handling errors

Malformed content does not throw. A parse rejects only for an invalid option or input, or a message that exceeds a [security limit](../api/options#security-limits):

```javascript
import PostalMime from 'postal-mime';

async function safeParse(raw) {
    try {
        return { success: true, email: await PostalMime.parse(raw, { maxHeadersSize: 512 * 1024 }) };
    } catch (err) {
        // err.code is one of the codes on the Errors page, eg. EMAXHEADERSIZE
        return { success: false, code: err.code, error: err.message };
    }
}

const result = await safeParse('Subject: Hello\n\nBody');
console.log(result.success, result.email.subject); // true Hello
```

## Normalizing a message for storage

A function that turns a parsed message into a flat record, for a database or a JSON API:

```javascript
import PostalMime from 'postal-mime';

// Mailboxes and the members of groups, as plain addresses
function addresses(list = []) {
    return list.flatMap(addr => (addr.group ? addr.group : [addr])).map(addr => addr.address);
}

async function toRecord(raw) {
    const email = await PostalMime.parse(raw, {
        maxNestingDepth: 100,
        maxHeadersSize: 1024 * 1024
    });

    return {
        from: email.from?.address ?? null,
        fromName: email.from?.name || null,
        to: addresses(email.to),
        cc: addresses(email.cc),
        replyTo: addresses(email.replyTo),
        subject: email.subject ?? null,
        date: email.date ?? null,
        messageId: email.messageId ?? null,
        text: email.text ?? null,
        html: email.html ?? null,
        attachments: email.attachments.map(att => ({
            filename: att.filename,
            mimeType: att.mimeType,
            size: att.content.byteLength,
            inline: att.related === true,
            contentId: att.contentId ?? null
        }))
    };
}

const record = await toRecord('From: Alice <alice@example.com>\nTo: Team: bob@example.com;\nSubject: Hi\n\nBody');
console.log(record.from, record.to, record.subject); // alice@example.com [ 'bob@example.com' ] Hi
```

`size` reads `byteLength`, so the function keeps the default `arraybuffer` encoding.

## See Also

- [Quick Start](../getting-started/quick-start) - The same basics with more explanation
- [Email Object](../api/email) - Every property used on this page
- [Working with Attachments](../guides/working-with-attachments) - Saving and displaying attachments
- [Web Worker example](./web-worker) - Parsing off the main thread
