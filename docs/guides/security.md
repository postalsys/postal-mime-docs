---
title: Security
sidebar_position: 4
description: The resource limits and parsing safeguards built into postal-mime, and how to handle untrusted email, HTML, attachments and file names safely.
---

# Security

<img src="/img/mascot/catching.png" alt="postal-mime mascot catching threats" className="mascot-header" />

Email is input from strangers. postal-mime bounds how much work and memory a single message can cost, and resolves ambiguous messages the way other mail software does, but it does not sanitize what it returns. This page covers both sides: what the parser protects against, and what remains the caller's job.

## Resource limits

Five options bound the cost of a message. Each is documented in [Parser Options](../api/options#security-limits).

| Option | Default | Stops | When exceeded |
|--------|---------|-------|---------------|
| `maxNestingDepth` | `256` | Multipart parts nested inside each other thousands of levels deep | `EMAXNESTINGDEPTH` error |
| `maxHeadersSize` | `2097152` (2 MiB) | Oversized headers, and millions of tiny header lines | `EMAXHEADERSIZE` error |
| `maxPartCount` | `10000` | A flat multipart of a huge number of empty parts. An empty part costs a few bytes of input and over a kilobyte of parser state, so a million of them took a 7 MB message to 1.4 GB of memory | `EMAXPARTCOUNT` error |
| `maxRfc822NestingDepth` | `10` | Messages nested inside messages, each level parsed by its own nested parser | Deeper messages become attachments flagged `rfc822DepthExceeded` |
| `maxForwardedAddresses` | `10000` | Inline forwards whose many short addresses render into far more `text` and `html` than the message is long | `EMAXFORWARDEDADDRESSES` error |

`maxHeadersSize`, `maxPartCount` and `maxForwardedAddresses` are counted across the whole message, every part and every inline forward together (since 4.0.8), so neither a multipart nor a chain of forwards can claim a fresh budget for each part. A header line counts for at least 64 bytes, since what the parser keeps for a line is far larger than a short line.

The limit options must be non-negative integers. A numeric string, `NaN`, `Infinity` or a negative number is an `EINVALIDOPTION` error instead of silently switching a limit off (since 2.7.6), and `0` means zero. Even so, a large enough value is as good as none, so do not pass an options object from an untrusted source to the parser.

:::warning Bound the input size
The whole message is held in memory while it is parsed, a `ReadableStream` included. The limits bound what the parser does with a message, not how big it is, so reject oversized input before it reaches the parser.
:::

### Nested message recursion limit

Each inline `message/rfc822` part is parsed by a nested parser, so a small message that nests messages hundreds of levels deep would otherwise multiply its cost. Past `maxRfc822NestingDepth` levels, a nested message is returned as an attachment with `rfc822DepthExceeded: true`, and nothing inside it is reflected in `text`, `html` or `attachments`.

:::warning Hidden nested content
If you scan messages for malicious content, do not treat `attachments` as complete without checking `rfc822DepthExceeded`. A sender can push a payload past the limit on purpose to keep it out of the parsed output. Re-parse a flagged attachment if you need to see inside it, and bound how many times you do so:

```javascript
import PostalMime from 'postal-mime';

async function collectAttachments(raw, depth = 0, maxDepth = 20) {
    const email = await PostalMime.parse(raw);
    const found = [];
    for (const att of email.attachments) {
        if (att.rfc822DepthExceeded) {
            if (depth >= maxDepth) {
                throw new Error('Message nested too deeply to scan');
            }
            found.push(...(await collectAttachments(att.content, depth + 1, maxDepth)));
        } else {
            found.push(att);
        }
    }
    return found;
}
```
:::

## Parsing safeguards

A message that two programs read differently can show one thing to a spam filter, a virus scanner or a DMARC verifier and another to the user. postal-mime resolves the ambiguous cases the way the RFCs and the widely used parsers do.

### Consistent header resolution

- Where a header occurs more than once, the first occurrence wins, both for the headers that decide how a part is read (`Content-Type`, `Content-Transfer-Encoding`, `Content-Disposition`, `Content-ID`, `Content-Description`) and for properties such as `subject` and `from`. A duplicated parameter, such as a second `boundary`, resolves to the first one as well.
- Only SP and HTAB continue a folded header. A line that starts with a non-breaking space, a byte order mark or another Unicode space is a header line of its own.
- The header name is kept as written, whitespace included (since 4.1.1). A `From :` line, or a first line that starts with a space, is listed under a key such as `"from "` and is not read as the `From` header. Before 4.1.1 the name was trimmed, so such a line could become the sender here while a verifier that ignores it authenticated a different one.
- Every header is listed in `headers`, duplicates included, so a scanner can see them all.

### MIME structure

- A line that matches the boundary of more than one open multipart is read as the boundary of the outermost one (since 4.1.1), as RFC 2046 implies and as Python and Go read it. A nested multipart cannot redeclare an ancestor's boundary to move parts in or out of the epilogue.
- The Content-Transfer-Encoding token is matched whole (since 4.1.1), so `x-base64` is not decoded as base64.
- Text in a charset of the WHATWG replacement encoding (ISO-2022-KR, ISO-2022-CN, HZ-GB-2312) decodes to a single replacement character (since 4.1.1), because its shift sequences let the same bytes read as text to one decoder and as markup to another.
- A UTF-16 byte order mark only decides the byte order under a label that leaves it open, such as `utf-16` (since 4.1.3). Under `utf-16be` or `utf-16le` the bytes are read in the order the label names, as Python reads them.

### Address extraction safeguards

[`addressParser()`](../api/address-parser), and with it `from`, `to` and the other address properties, only ever reads an address out of the raw header:

- An RFC 2047 encoded word is decoded into a display name, never into an address (since 4.1.1). A word that decodes to `Name <name@example.com>` gives that text as the name and an empty address, because the raw header holds no mailbox a DMARC verifier could have authenticated.
- No address is read out of a quoted string or a comment. RFC 5321 allows `@` in a quoted local part, so `"user@evil.com"@good.com` is returned as written, with one `@` outside the quotes to split the domain at, and a quoted `,` or `;` cannot turn into a recipient separator.
- A comment ends a domain instead of joining the text around it, inside angle brackets too: `Name <user@example.com(x)evil.com>` gives the address `user@example.com`, never `user@example.comevil.com`.
- Text inside angle brackets that is not the mailbox becomes display text, so `<user@example.com foo>` gives the address `user@example.com`.
- Groups are read in one pass without recursion. A group nested inside another, which RFC 5322 does not allow, is flattened into the outer one, so nesting cannot be used to cost stack depth.

### Linear time parsing

Header trimming, comment stripping, address parsing, encoded word handling, `format=flowed` unfolding and the HTML to text conversion run in linear time in the size of their input, so a crafted header or body cannot keep a CPU core busy with regular expression backtracking or quadratic loops.

## Handling untrusted mail

### 1. Set limits that fit your mail

The defaults suit general mail. For a service that accepts mail from anyone, tighter values cost nothing for legitimate messages:

```javascript
import PostalMime from 'postal-mime';

const UNTRUSTED_OPTIONS = {
    maxNestingDepth: 50,
    maxHeadersSize: 512 * 1024,
    maxPartCount: 1000,
    maxRfc822NestingDepth: 3,
    maxForwardedAddresses: 1000
};

const MAX_MESSAGE_SIZE = 25 * 1024 * 1024;

async function parseUntrusted(bytes) {
    if (bytes.byteLength > MAX_MESSAGE_SIZE) {
        throw new Error('Message too large');
    }
    return PostalMime.parse(bytes, UNTRUSTED_OPTIONS);
}

const email = await parseUntrusted(new TextEncoder().encode('Subject: Hello\n\nBody'));
console.log(email.subject); // "Hello"
```

Setting `forceRfc822Attachments: true` as well keeps forwarded messages out of `text` and `html` entirely, if your application has no use for them inline.

### 2. Handle limit errors

Tell a message that exceeds a limit apart from a bug in the calling code by its [error code](../api/errors):

```javascript
import PostalMime from 'postal-mime';

const LIMIT_ERRORS = new Set(['EMAXNESTINGDEPTH', 'EMAXHEADERSIZE', 'EMAXPARTCOUNT', 'EMAXFORWARDEDADDRESSES']);

async function parseOrReject(raw) {
    try {
        return await PostalMime.parse(raw, { maxPartCount: 1000 });
    } catch (err) {
        if (LIMIT_ERRORS.has(err.code)) {
            console.error('Email rejected:', err.code);
            return null;
        }
        throw err;
    }
}

console.log(await parseOrReject('Subject: Hello\n\nBody')); // the parsed message
```

### 3. Validate attachment types

`mimeType` and `filename` are whatever the sender wrote. Allow only the types you need, and check the content where it matters:

```javascript
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf', 'text/plain']);

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // "%PDF"

function isAllowed(att) {
    if (!ALLOWED_TYPES.has(att.mimeType)) {
        return false;
    }
    if (att.mimeType === 'application/pdf') {
        const bytes = new Uint8Array(att.content).subarray(0, 4);
        return PDF_MAGIC.every((byte, i) => bytes[i] === byte);
    }
    return true;
}
```

### 4. Limit attachment sizes

With the default `arraybuffer` encoding, `byteLength` is the decoded size:

```javascript
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

function checkSizes(email) {
    for (const att of email.attachments) {
        if (att.content.byteLength > MAX_ATTACHMENT_SIZE) {
            throw new Error(`Attachment too large: ${att.content.byteLength} bytes`);
        }
    }
}
```

### 5. Sanitize HTML content

`html` is the sender's markup, decoded but not sanitized. Inserted into a page as it is, a script in the message runs with the privileges of your page. Either isolate it in a sandboxed iframe, which is what the [demo](/demo) and the [Email Viewer](../examples/email-viewer) do:

```javascript
const iframe = document.createElement('iframe');
// An empty sandbox blocks scripts, forms, plugins and top-level navigation
iframe.setAttribute('sandbox', '');
iframe.srcdoc = email.html;
document.body.appendChild(iframe);
```

or sanitize it with a library such as [DOMPurify](https://github.com/cure53/DOMPurify):

```javascript
import DOMPurify from 'dompurify';

document.getElementById('email-content').innerHTML = DOMPurify.sanitize(email.html);
```

An email can also load remote images and stylesheets, which tells the sender when the message was opened. Block remote content with a Content Security Policy or a sanitizer hook if that matters to your users.

`text` is plain text and must be escaped before it is inserted into HTML. Assign it to `textContent` rather than `innerHTML`.

### 6. Treat nested messages as content

`text` and `html` contain the content of inline forwarded messages, rendered after a header block. A scanner that checks `text`, `html` and `attachments` sees everything the parser read, except what sits in an attachment flagged `rfc822DepthExceeded`, see [Nested message recursion limit](#nested-message-recursion-limit).

## Filename traversal

An attachment `filename` like `../../.ssh/authorized_keys` writes outside the target directory if it is used as a path. A name can also hold control characters, or a bidirectional override (U+202E) that makes `invoice` + U+202E + `fdp.exe` display as `invoiceexe.pdf`. postal-mime decodes RFC 2231 continuations exactly as written, so a percent-encoded traversal cannot be smuggled through a section that was not marked as encoded, but the decoded name is still whatever the sender chose.

Reduce the name to a safe base name before using it:

```javascript
function sanitizeFilename(filename) {
    const base = String(filename || '').split(/[/\\]/).pop();
    // Keep a conservative set of characters, and no leading dots
    const safe = base.replace(/[^\w.-]/g, '_').replace(/^\.+/, '');
    return safe || 'attachment';
}

console.log(sanitizeFilename('../../.ssh/authorized_keys')); // "authorized_keys"
console.log(sanitizeFilename('invoice\u202Efdp.exe'));        // "invoice_fdp.exe"
console.log(sanitizeFilename(null));                          // "attachment"
```

Write the file inside a directory you control, and do not let two attachments with the same name overwrite each other. See [Saving attachments](./working-with-attachments#saving-attachments-in-nodejs).

## Checklist

- Bound the size of untrusted input before parsing it
- Set the limit options to what your mail actually needs
- Handle the `EMAX*` error codes, and let the other codes surface as bugs
- Check `rfc822DepthExceeded` on attachments if you scan content
- Allow only the attachment types you need, and check content rather than `mimeType`
- Limit individual and total attachment sizes
- Render `html` in a sandboxed iframe or sanitize it; escape `text`
- Sanitize attachment file names before using them as paths or showing them
- Never pass an options object from an untrusted source to the parser

## See Also

- [Parser Options](../api/options) - The limit options in detail
- [Errors](../api/errors) - The error codes the limits raise
- [Email Object](../api/email) - What the parsed values contain
- [Working with Attachments](./working-with-attachments) - Saving attachments safely
