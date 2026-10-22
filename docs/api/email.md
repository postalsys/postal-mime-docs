---
title: Email Object
sidebar_position: 3
description: Reference for the parsed Email object returned by PostalMime.parse(), including headers, addresses, text and HTML bodies, nested messages and attachments.
---

# Email Object

<img src="/img/mascot/checklist.png" alt="postal-mime mascot with checklist" className="mascot-header" />

`PostalMime.parse()` resolves to an `Email` object. `headers`, `headerLines` and `attachments` are always present. Every other property is present only when the message supplies a non-empty value for it, so check for `undefined` before using one.

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse(`From: Alice <alice@example.com>
To: bob@example.com
Subject: Hello
Date: Mon, 15 Jan 2024 10:30:00 +0000
Message-ID: <hello-1@example.com>

Hi Bob!`);

console.log(email.from);      // { address: 'alice@example.com', name: 'Alice' }
console.log(email.to);        // [ { address: 'bob@example.com', name: '' } ]
console.log(email.subject);   // "Hello"
console.log(email.date);      // "2024-01-15T10:30:00.000Z"
console.log(email.messageId); // "<hello-1@example.com>"
console.log(email.text);      // "Hi Bob!\n"
console.log(email.html);      // undefined
```

## Properties

| Property | Type | Description |
|----------|------|-------------|
| `headers` | [`Header[]`](#header-object) | Every header of the top-level message, in message order, duplicates included |
| `headerLines` | [`HeaderLine[]`](#headerline-object) | The raw header lines, in the same order as `headers` (since 2.7.0) |
| `from` | [`Address`](#addresses) | The first `From` header |
| `sender` | [`Address`](#addresses) | The first `Sender` header |
| `replyTo` | [`Address[]`](#addresses) | Every `Reply-To` header |
| `to` | [`Address[]`](#addresses) | Every `To` header |
| `cc` | [`Address[]`](#addresses) | Every `Cc` header |
| `bcc` | [`Address[]`](#addresses) | Every `Bcc` header |
| `deliveredTo` | `string` | The address of the first `Delivered-To` header |
| `returnPath` | `string` | The address of the first `Return-Path` header |
| `subject` | `string` | The first `Subject` header, encoded words decoded |
| `messageId` | `string` | The first `Message-ID` header, angle brackets included |
| `inReplyTo` | `string` | The first `In-Reply-To` header |
| `references` | `string` | The first `References` header, a space separated list of message IDs as written |
| `date` | `string` | The first `Date` header as an ISO 8601 string, see [Date](#date) |
| `text` | `string` | The plain text body, see [Text and HTML](#text-and-html) |
| `html` | `string` | The HTML body, see [Text and HTML](#text-and-html) |
| `attachments` | [`Attachment[]`](#attachment-object) | Every part that is not part of the body |

`subject`, `messageId`, `inReplyTo` and `references` are run through [`decodeWords()`](./decode-words), so RFC 2047 encoded words in them are decoded.

### Duplicate headers

Where a header is exposed as a single property, the first occurrence wins. The address lists `to`, `cc`, `bcc` and `replyTo` collect the addresses of every occurrence, in message order. Both have been the behavior since 3.0.0; earlier releases used the last occurrence and returned the lists reversed.

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse(`Subject: first
Subject: second
To: a@example.com
To: b@example.com

Body`);

console.log(email.subject);                                          // "first"
console.log(email.to.map(addr => addr.address));                     // [ 'a@example.com', 'b@example.com' ]
console.log(email.headers.filter(h => h.key === 'subject').length); // 2
```

## Header object

| Property | Type | Description |
|----------|------|-------------|
| `key` | `string` | The header name, lowercased |
| `originalKey` | `string` | The header name as written in the message, case preserved (since 2.7.4) |
| `value` | `string` | The header value, unfolded and trimmed, encoded words not decoded |

The value is unfolded per RFC 5322: the line break of a folded header is removed and the folding whitespace is kept, so `Subject: Hello\r\n    World` reads as `Hello    World`. Before 3.0.0 every whitespace run was collapsed to a single space. Use [`decodeWords()`](./decode-words) to decode encoded words in a value.

The name is otherwise kept as written. Since 4.1.1, whitespace between the name and the colon stays in the key, so a `From :` line is listed with the key `"from "` and is not read as the `From` header. This keeps a line that some parsers ignore from overriding the header that every other parser reads.

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse('From : spoofed@example.com\nFrom: real@example.com\n\nBody');

console.log(email.headers.map(h => h.key)); // [ 'from ', 'from' ]
console.log(email.from.address);            // "real@example.com"
```

Only the headers of the top-level message are listed. The headers of MIME parts and of nested messages are not.

## HeaderLine object

| Property | Type | Description |
|----------|------|-------------|
| `key` | `string` | The header name, lowercased, as in `Header.key` |
| `line` | `string` | The complete raw header line, name included. The lines of a folded header are joined with a LF |

`headerLines` keeps what `headers` normalizes away: the folding and the exact bytes of the value. Use it where the original form matters, such as DKIM verification. A line is raw, so unlike `value` it can contain a bare CR; sanitize it before writing it into another message.

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse('Subject: =?UTF-8?B?SGVsbG8=?=\r\n World\r\n\r\nBody');

console.log(email.headerLines[0].line); // "Subject: =?UTF-8?B?SGVsbG8=?=\n World"
console.log(email.headers[0].value);    // "=?UTF-8?B?SGVsbG8=?= World"
console.log(email.subject);             // "Hello World"
```

## Addresses

`from`, `sender`, `to`, `cc`, `bcc` and `replyTo` are parsed with [`addressParser()`](./address-parser). Each address is either a mailbox or a group:

| Shape | Properties |
|-------|------------|
| Mailbox | `name`: the decoded display name, or `""`; `address`: the email address |
| Group | `name`: the decoded group name; `group`: an array of mailboxes |

A group has no `address` and a mailbox has no `group`, which is how to tell them apart:

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse('To: Team: alice@example.com, bob@example.com;, carol@example.com\n\nBody');

for (const addr of email.to) {
    if (addr.group) {
        console.log(`Group ${addr.name}:`, addr.group.map(member => member.address));
    } else {
        console.log('Mailbox:', addr.address);
    }
}
// Group Team: [ 'alice@example.com', 'bob@example.com' ]
// Mailbox: carol@example.com
```

`from` and `sender` hold the first address of the header, which can be a group too. `deliveredTo` and `returnPath` are plain strings holding the first mailbox address of their header, and are left out when the header holds no address.

## Date

`date` is the first `Date` header converted to an ISO 8601 string with `new Date(value).toISOString()`. If the runtime's `Date` cannot parse the value, `date` is the header value as it was written.

```javascript
import PostalMime from 'postal-mime';

console.log((await PostalMime.parse('Date: Mon, 15 Jan 2024 10:30:00 +0200\n\nx')).date); // "2024-01-15T08:30:00.000Z"
console.log((await PostalMime.parse('Date: yesterday\n\nx')).date);                       // "yesterday"
```

## Text and HTML

`text` and `html` are assembled from the inline text parts of the message:

- A `text/plain` or `text/html` part is inline unless it has `Content-Disposition: attachment`. Any other type, including `text/calendar` and `text/csv`, is an attachment.
- In a `multipart/alternative`, the plain text and the HTML representation are kept apart, and each ends up in the property of its type.
- Several inline parts of the same type, such as the text parts of a `multipart/mixed`, are joined with a line break, in message order.
- If the message has an HTML part anywhere, a text-only part is converted to HTML so that `html` covers the whole body, and likewise an HTML-only part is converted to plain text for `text`. If the message has parts of one type only, the other property is `undefined`.

The content is decoded from its transfer encoding and charset, and CRLF line endings are normalized to LF. A part without a charset, or with a label that cannot be resolved, is decoded as UTF-8 when its bytes are valid UTF-8 and as windows-1252 otherwise, and an HTML part without one may declare its charset in a `<meta>` tag (since 4.0.5). See [Supported charsets](./decode-words#supported-charsets) for the labels that are recognized. `format=flowed` text (RFC 3676) is unfolded, honoring `delsp=yes`.

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse(`Content-Type: multipart/mixed; boundary="b"

--b
Content-Type: text/plain

Plain part
--b
Content-Type: text/html

<p>HTML part</p>
--b--
`);

console.log(email.text); // "Plain part\n\nHTML part\n"
console.log(email.html); // "<div>Plain part</div>\n<p>HTML part</p>"
```

:::warning
`html` is the sender's markup, decoded but not sanitized. Never insert it into a page without sanitizing it or isolating it in a sandboxed iframe. `text` has to be escaped before it is inserted into HTML. See [Sanitize HTML content](../guides/security#5-sanitize-html-content).
:::

### Nested messages

A `message/rfc822` part is parsed inline unless the [classification options](./options#classification-options) or a delivery report make it an attachment. An inline message contributes a header block with its From, Subject, Date, To, Cc and Bcc, followed by its own text, to `text` and `html`, and its attachments are added to `attachments`. The date in the header block is formatted for the runtime's default locale.

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse(`Subject: Fwd: Report
Content-Type: multipart/mixed; boundary="b"

--b
Content-Type: text/plain

See the forwarded message.
--b
Content-Type: message/rfc822

From: Carol <carol@example.com>
Subject: Report

Report body
--b--
`);

console.log(email.text);
// See the forwarded message.
//
// ----------------------------------
// From:    Carol <carol@example.com>
// Subject: Report
// ----------------------------------
//
// Report body
```

Parts of a `multipart/digest` default to `message/rfc822` (RFC 2046), so each message of a digest is parsed inline the same way. The depth of inline parsing is bounded by [`maxRfc822NestingDepth`](./options#maxrfc822nestingdepth).

## Attachment object

Every part that does not end up in `text` or `html` is listed in `attachments`, in message order, including inline images and nested messages that were not parsed inline.

| Property | Type | Description |
|----------|------|-------------|
| `filename` | `string \| null` | The decoded file name from the `filename` parameter of Content-Disposition, or the `name` parameter of Content-Type, or `null`. RFC 2231 continuations and encoded words are decoded |
| `mimeType` | `string` | The lowercased MIME type, `text/plain` when the part has no Content-Type (`message/rfc822` inside a `multipart/digest`) |
| `disposition` | `string \| null` | The lowercased Content-Disposition type, usually `"attachment"` or `"inline"`, or `null` when the part has none. Other tokens, such as `form-data`, are passed through as they are |
| `related` | `boolean` | `true` for a part inside a `multipart/related` that has a Content-ID, such as an inline image referenced from the HTML. Not set otherwise |
| `contentId` | `string` | The Content-ID header, angle brackets included. Not set when the part has none |
| `description` | `string` | The decoded Content-Description header (since 2.2.3). Not set when the part has none |
| `method` | `string` | The uppercased `method` parameter of a `text/calendar` or `application/ics` part, such as `"REQUEST"`. Not set otherwise |
| `rfc822DepthExceeded` | `boolean` | `true` for a `message/rfc822` part that was nested deeper than [`maxRfc822NestingDepth`](./options#maxrfc822nestingdepth) and was not parsed. Not set otherwise (since 2.7.6) |
| `content` | `ArrayBuffer \| Uint8Array \| string` | The content, see below |
| `encoding` | `'base64' \| 'utf8'` | Set when `content` is a string, to the `attachmentEncoding` that produced it |

### content

`content` holds the decoded bytes of the part exactly as they were sent (since 4.0.5): a `7bit`, `8bit` or `binary` part keeps its line endings byte for byte, and a `base64` or `quoted-printable` part comes out as the bytes that were encoded. The line break in front of a multipart boundary belongs to the boundary (RFC 2046), so it is not part of the content. The [`attachmentEncoding`](./options#attachmentencoding) option decides its type:

| `attachmentEncoding` | Regular part | Calendar part |
|----------------------|--------------|---------------|
| `'arraybuffer'` (default) | `ArrayBuffer` | `Uint8Array` |
| `'base64'` | base64 `string` | base64 `string` |
| `'utf8'` | `string` | `string` |

Calendar parts (`text/calendar` and `application/ics`) are the exception to the "as sent" rule: they are decoded from their charset to text, normalized to LF line endings with exactly one trailing line break, and re-encoded as UTF-8.

Each attachment has its own `ArrayBuffer`, so the buffers can be transferred to a worker independently.

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse(`Content-Type: multipart/mixed; boundary="b"

--b
Content-Type: text/plain

Meeting invite attached.
--b
Content-Type: text/calendar; method=REQUEST; charset=utf-8
Content-Disposition: attachment; filename="invite.ics"

BEGIN:VCALENDAR\r
METHOD:REQUEST\r
END:VCALENDAR\r
--b--
`);

const invite = email.attachments[0];
console.log(invite.filename, invite.mimeType, invite.method); // invite.ics text/calendar REQUEST
console.log(new TextDecoder().decode(invite.content));
// BEGIN:VCALENDAR
// METHOD:REQUEST
// END:VCALENDAR
```

:::warning
`filename` is chosen by the sender. It can contain path separators, `..`, control characters or bidirectional overrides. Never use it as a file path without sanitizing it. See [Filename traversal](../guides/security#filename-traversal).
:::

## See Also

- [Working with Attachments](../guides/working-with-attachments) - Saving, filtering and displaying attachments
- [Parsing Emails](../guides/parsing-emails) - Input types and common parsing tasks
- [Parser Options](./options) - Options that change what ends up in `attachments`
- [Types](./types) - The TypeScript declarations of these objects
