---
title: Parsing Emails
sidebar_position: 1
description: How to feed messages to postal-mime from strings, files, uploads, fetch and streams, and how to read headers, addresses, bodies, nested messages and charsets.
---

# Parsing Emails

<img src="/img/mascot/parsing.png" alt="postal-mime mascot parsing" className="mascot-header" />

This guide covers the common parsing tasks. The exact behavior of every property is documented on the [Email Object](../api/email) page.

## Message structure

An RFC 822 message is a block of headers, a blank line, and a body. In a MIME message, the body can be split into parts, each with headers of its own:

```text
From: alice@example.com
Subject: Example
Content-Type: multipart/alternative; boundary="b"

--b
Content-Type: text/plain

Plain text version
--b
Content-Type: text/html

<p>HTML version</p>
--b--
```

postal-mime reads this into a tree of parts, then turns the text parts into `text` and `html` and every other part into an entry of `attachments`.

## Choosing an entry point

`PostalMime.parse()` creates a parser, parses one message and returns the result:

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse('Subject: Hello\n\nBody');
```

A parser instance does the same in two steps, and parses a single message:

```javascript
import PostalMime from 'postal-mime';

const parser = new PostalMime({ attachmentEncoding: 'base64' });
const email = await parser.parse('Subject: Hello\n\nBody');
```

Calling `parse()` again on the same instance rejects with `EPARSERREUSED`. See [PostalMime](../api/postal-mime).

## Reading messages from different sources

The parser accepts a string, an `ArrayBuffer`, any `ArrayBufferView` (a `Uint8Array`, a Node.js `Buffer`, a `DataView`), a `Blob` or `File`, and a `ReadableStream`. Pass bytes whenever you have them: a message is bytes, and decoding it to a string first breaks 8-bit text that is not UTF-8.

### A file in Node.js

```javascript
import PostalMime from 'postal-mime';
import { readFile } from 'node:fs/promises';

const email = await PostalMime.parse(await readFile('message.eml'));
```

### A fetch response

```javascript
import PostalMime from 'postal-mime';

const response = await fetch('https://example.com/message.eml');

// Either read the body into memory first
const email = await PostalMime.parse(await response.arrayBuffer());

// or pass the stream, which the parser reads to the end before parsing
// const email = await PostalMime.parse(response.body);
```

Passing a stream is a convenience, not a way to bound memory: the whole message is held in memory while it is parsed. Limit the size of untrusted input before it reaches the parser.

### A file upload in the browser

A `File` from an `<input type="file">` or a drop event is a `Blob`, and can be passed as it is:

```javascript
import PostalMime from 'postal-mime';

document.querySelector('input[type="file"]').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (file) {
        const email = await PostalMime.parse(file);
        console.log(email.subject);
    }
});
```

## Headers

`headers` lists every header of the message in order, duplicates included. Keys are lowercase and values are unfolded but not decoded:

```javascript
import PostalMime from 'postal-mime';
import { decodeWords } from 'postal-mime';

const email = await PostalMime.parse(`X-Mailer: Example Mailer 1.0
X-Note: =?UTF-8?Q?Caf=C3=A9?=
Subject: Hello

Body`);

const mailer = email.headers.find(h => h.key === 'x-mailer');
console.log(mailer.value); // "Example Mailer 1.0"

const note = email.headers.find(h => h.key === 'x-note');
console.log(decodeWords(note.value)); // "Café"
```

Where a header occurs more than once, the single-value properties such as `subject` and `from` use the first occurrence, and the address lists collect every occurrence. `headerLines` holds the raw lines, folds included. See [Header object](../api/email#header-object).

## Addresses

`from` and `sender` are a single address, `to`, `cc`, `bcc` and `replyTo` are arrays. An address is either a mailbox with `name` and `address`, or a group with `name` and a `group` array of mailboxes:

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse(`From: John Doe <john@example.com>
To: Alice <alice@example.com>, Team: bob@example.com, carol@example.com;

Body`);

console.log(email.from); // { address: 'john@example.com', name: 'John Doe' }

for (const addr of email.to) {
    if (addr.group) {
        console.log(`Group ${addr.name}:`, addr.group.map(m => m.address).join(', '));
    } else {
        console.log(`${addr.name} <${addr.address}>`);
    }
}
// Alice <alice@example.com>
// Group Team: bob@example.com, carol@example.com
```

Use [`addressParser()`](../api/address-parser) to parse address headers that are not exposed as properties, such as `Resent-To`.

## Text and HTML

`text` and `html` are built from the inline text parts. A message with both a plain text and an HTML part, usually in a `multipart/alternative`, has both; a message with only one kind has only that property:

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse(`Content-Type: multipart/alternative; boundary="b"

--b
Content-Type: text/plain

Plain text version
--b
Content-Type: text/html

<p>HTML version</p>
--b--
`);

console.log(email.text); // "Plain text version"
console.log(email.html); // "<p>HTML version</p>"
```

Line endings are normalized to LF. When parts of different types are mixed, such as in a `multipart/mixed` with one plain and one HTML part, each part is converted so that both `text` and `html` hold the whole body. See [Text and HTML](../api/email#text-and-html) for the full rules.

### format=flowed

Plain text with `format=flowed` (RFC 3676) is unfolded: a line that ends with a space continues on the next one. The parameter is ignored on an HTML part (since 4.1.4). Quoted paragraphs are unfolded the same way, a change of quote depth ends a paragraph, and the `-- ` signature separator is kept as it is. With `delsp=yes`, the space before the soft break is removed, which is how text in languages without word spaces is folded.

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse(
    'Content-Type: text/plain; charset=utf-8; format=flowed\r\n\r\n' +
        'This is a long paragraph that has been \r\n' +
        'soft-wrapped by the email client.\r\n' +
        '\r\n' +
        '> Quoted text that was \r\n' +
        '> wrapped as well.\r\n' +
        '-- \r\n' +
        'Signature'
);

console.log(email.text);
// This is a long paragraph that has been soft-wrapped by the email client.
//
// > Quoted text that was wrapped as well.
// -- 
// Signature
```

## Nested messages

A forwarded message attached as a `message/rfc822` part is parsed inline by default. Its headers are rendered as a block in `text` and `html`, followed by its body, and its attachments are added to `attachments`. To keep a nested message as an attachment instead, use the [`rfc822Attachments` or `forceRfc822Attachments`](../api/options#classification-options) options, then parse the attachment yourself when you need it:

```javascript
import PostalMime from 'postal-mime';

const raw = `Subject: Fwd: Report
Content-Type: multipart/mixed; boundary="b"

--b
Content-Type: text/plain

See the forwarded message.
--b
Content-Type: message/rfc822

From: carol@example.com
Subject: Report

Report body
--b--
`;

const email = await PostalMime.parse(raw, { forceRfc822Attachments: true });

const forwarded = email.attachments.find(att => att.mimeType === 'message/rfc822');
// Pass the raw bytes, not a decoded string, so a non UTF-8 message stays intact
const nested = await PostalMime.parse(forwarded.content);
console.log(nested.subject); // "Report"
```

Bounces and abuse reports (messages with a `message/delivery-status` or `message/feedback-report` part) always keep the original message as an attachment. Inline parsing stops at [`maxRfc822NestingDepth`](../api/options#maxrfc822nestingdepth) levels, and a deeper message is returned as an attachment flagged with `rfc822DepthExceeded`.

## Character encoding

Headers, bodies and file names are decoded from the charset they declare. Every WHATWG charset label is supported, along with the aliases mail clients use, such as `cp932` and `iso-2022-jp-2`. A body without a charset, or with a label that cannot be resolved, is decoded as UTF-8 when its bytes are valid UTF-8 and as windows-1252 otherwise. See [Supported charsets](../api/decode-words#supported-charsets).

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse('Subject: =?UTF-8?B?44GT44KT44Gr44Gh44Gv?=\n\nBody');
console.log(email.subject); // "こんにちは"
```

## Dates

`date` is the `Date` header as an ISO 8601 string, or the header as written when it cannot be parsed:

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse('Date: Mon, 15 Jan 2024 10:30:00 +0000\n\nBody');
console.log(email.date); // "2024-01-15T10:30:00.000Z"

// Convert it back to a Date, checking for an unparseable value
const sent = new Date(email.date);
console.log(Number.isNaN(sent.getTime()) ? 'unknown date' : sent.toUTCString());
// Mon, 15 Jan 2024 10:30:00 GMT
```

## Errors

Malformed content does not cause an error: the parser recovers and returns what it could read. Errors are raised for invalid options or input, and for a message that exceeds a security limit. Each has a `code`:

```javascript
import PostalMime from 'postal-mime';

try {
    await PostalMime.parse('Subject: Hello\n\nBody', { maxHeadersSize: 10 });
} catch (err) {
    console.log(err.code); // "EMAXHEADERSIZE"
}
```

See [Errors](../api/errors) for every code.

## See Also

- [Email Object](../api/email) - The exact behavior of every property
- [Working with Attachments](./working-with-attachments) - Saving, filtering and displaying attachments
- [Parser Options](../api/options) - Classification options and security limits
- [Security](./security) - Parsing untrusted mail
