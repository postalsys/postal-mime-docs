---
sidebar_position: 1
---

# Basic Parsing

Examples of common email parsing scenarios.

## Simple Text Email

```javascript
import PostalMime from 'postal-mime';

const rawEmail = `From: alice@example.com
To: bob@example.com
Subject: Hello Bob
Date: Mon, 15 Jan 2024 10:30:00 +0000
Content-Type: text/plain; charset=utf-8

Hi Bob,

Just wanted to say hello!

Best,
Alice`;

const email = await PostalMime.parse(rawEmail);

console.log('From:', email.from);
// { name: '', address: 'alice@example.com' }

console.log('To:', email.to);
// [{ name: '', address: 'bob@example.com' }]

console.log('Subject:', email.subject);
// "Hello Bob"

console.log('Date:', email.date);
// "2024-01-15T10:30:00.000Z"

console.log('Text:', email.text);
// "Hi Bob,\n\nJust wanted to say hello!\n\nBest,\nAlice"
```

## HTML Email

```javascript
const htmlEmail = `From: newsletter@example.com
To: subscriber@example.com
Subject: Weekly Update
Content-Type: text/html; charset=utf-8
MIME-Version: 1.0

<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; }
        .header { background: #007bff; color: white; padding: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Weekly Newsletter</h1>
    </div>
    <p>Here's what happened this week...</p>
</body>
</html>`;

const email = await PostalMime.parse(htmlEmail);

console.log('HTML available:', !!email.html);
// true

console.log('Text available:', !!email.text);
// true (automatically converted from HTML)

// Render the HTML safely (always sanitize first!)
document.getElementById('email-content').innerHTML = email.html;
```

## Multipart Email (Text + HTML)

```javascript
const multipartEmail = `From: sender@example.com
To: recipient@example.com
Subject: Important Update
MIME-Version: 1.0
Content-Type: multipart/alternative; boundary="boundary123"

--boundary123
Content-Type: text/plain; charset=utf-8

This is the plain text version.

--boundary123
Content-Type: text/html; charset=utf-8

<html>
<body>
<p>This is the <strong>HTML</strong> version.</p>
</body>
</html>

--boundary123--`;

const email = await PostalMime.parse(multipartEmail);

console.log('Text:', email.text);
// "This is the plain text version."

console.log('HTML:', email.html);
// "<html>\n<body>\n<p>This is the <strong>HTML</strong> version.</p>\n</body>\n</html>"
```

## Email with Attachments

```javascript
const emailWithAttachment = `From: sender@example.com
To: recipient@example.com
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

JVBERi0xLjQKJeLjz9MKCjEgMCBvYmoKPDwvVHlwZS9DYXRhbG9n
Pj4KZW5kb2JqCgp0cmFpbGVyCjw8L1Jvb3QgMSAwIFI+Pgolh

--boundary456--`;

const email = await PostalMime.parse(emailWithAttachment);

console.log('Text:', email.text);
// "Please find the document attached."

console.log('Attachments:', email.attachments.length);
// 1

const attachment = email.attachments[0];
console.log('Filename:', attachment.filename);
// "document.pdf"
console.log('MIME Type:', attachment.mimeType);
// "application/pdf"
console.log('Size:', attachment.content.byteLength, 'bytes');
```

## Multiple Recipients

```javascript
const multiRecipientEmail = `From: sender@example.com
To: alice@example.com, bob@example.com
Cc: charlie@example.com
Bcc: admin@example.com
Subject: Team Update

Hello team!`;

const email = await PostalMime.parse(multiRecipientEmail);

console.log('To recipients:');
email.to?.forEach(addr => {
    console.log(`  - ${addr.address}`);
});
// alice@example.com
// bob@example.com

console.log('CC recipients:');
email.cc?.forEach(addr => {
    console.log(`  - ${addr.address}`);
});
// charlie@example.com
```

## Encoded Headers

```javascript
const encodedEmail = `From: =?UTF-8?B?5bGx55Sw5aSq6YOO?= <yamada@example.jp>
To: user@example.com
Subject: =?UTF-8?Q?Caf=C3=A9_Menu?=
Content-Type: text/plain; charset=utf-8

Content here`;

const email = await PostalMime.parse(encodedEmail);

console.log('From name:', email.from?.name);
// "山田太郎" (decoded from Base64)

console.log('Subject:', email.subject);
// "Cafe Menu" (decoded from Quoted-Printable)
```

## Reading from File (Node.js)

```javascript
import PostalMime from 'postal-mime';
import { readFile } from 'fs/promises';

async function parseEmailFile(filepath) {
    const buffer = await readFile(filepath);
    const email = await PostalMime.parse(buffer);

    console.log('Subject:', email.subject);
    console.log('From:', email.from?.address);
    console.log('Attachments:', email.attachments.length);

    return email;
}

const email = await parseEmailFile('./message.eml');
```

## Reading from Fetch Response

```javascript
async function parseRemoteEmail(url) {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const email = await PostalMime.parse(buffer);

    return email;
}

const email = await parseRemoteEmail('https://example.com/email.eml');
```

## Reading from File Input (Browser)

```javascript
const fileInput = document.querySelector('#email-file');

fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const email = await PostalMime.parse(file);

    console.log('Parsed email:', email.subject);

    // Display results
    document.getElementById('subject').textContent = email.subject;
    document.getElementById('from').textContent = email.from?.address;
    document.getElementById('body').innerHTML = email.html || email.text;
});
```

## Error Handling

```javascript
async function safeParse(rawEmail) {
    try {
        const email = await PostalMime.parse(rawEmail, {
            maxNestingDepth: 50,
            maxHeadersSize: 524288 // 512KB
        });

        return {
            success: true,
            email
        };
    } catch (error) {
        console.error('Parsing failed:', error.message);

        return {
            success: false,
            error: error.message
        };
    }
}

const result = await safeParse(rawEmail);

if (result.success) {
    console.log('Subject:', result.email.subject);
} else {
    console.log('Error:', result.error);
}
```

## Complete Email Parser Function

```javascript
import PostalMime from 'postal-mime';

async function parseEmail(input, options = {}) {
    const defaultOptions = {
        attachmentEncoding: 'base64',
        maxNestingDepth: 100,
        maxHeadersSize: 1048576 // 1MB
    };

    const email = await PostalMime.parse(input, {
        ...defaultOptions,
        ...options
    });

    return {
        // Sender info
        from: email.from?.address || null,
        fromName: email.from?.name || null,
        sender: email.sender?.address || null,

        // Recipients
        to: email.to?.map(a => a.address) || [],
        cc: email.cc?.map(a => a.address) || [],
        bcc: email.bcc?.map(a => a.address) || [],
        replyTo: email.replyTo?.map(a => a.address) || [],

        // Message details
        subject: email.subject || '(no subject)',
        date: email.date ? new Date(email.date) : null,
        messageId: email.messageId || null,

        // Content
        text: email.text || null,
        html: email.html || null,
        hasHtml: !!email.html,

        // Attachments
        attachments: email.attachments.map(att => ({
            filename: att.filename,
            mimeType: att.mimeType,
            size: typeof att.content === 'string'
                ? Math.floor(att.content.length * 0.75)
                : att.content.byteLength,
            isInline: att.disposition === 'inline',
            contentId: att.contentId || null
        })),
        attachmentCount: email.attachments.length,

        // Raw headers for advanced use
        headers: email.headers
    };
}

// Usage
const parsed = await parseEmail(rawEmail);
console.log(JSON.stringify(parsed, null, 2));
```
