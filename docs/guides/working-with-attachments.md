---
title: Working with Attachments
sidebar_position: 2
description: How to read, filter, save and display email attachments parsed by postal-mime, including inline images, calendar invites and nested messages.
---

# Working with Attachments

<img src="/img/mascot/attachments.png" alt="postal-mime mascot with attachments" className="mascot-header" />

Every part of a message that does not end up in `text` or `html` is listed in `email.attachments`. This guide covers the common tasks. The properties of an attachment are documented in [Attachment object](../api/email#attachment-object).

## Listing attachments

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse(`Subject: Files
Content-Type: multipart/mixed; boundary="b"

--b
Content-Type: text/plain

Two files attached.
--b
Content-Type: application/pdf; name="report.pdf"
Content-Disposition: attachment; filename="report.pdf"
Content-Transfer-Encoding: base64

JVBERi0xLjQK
--b
Content-Type: image/png
Content-Disposition: inline; filename="chart.png"
Content-Transfer-Encoding: base64

iVBORw0KGgo=
--b--
`);

for (const att of email.attachments) {
    console.log(att.filename, att.mimeType, att.disposition, att.content.byteLength);
}
// report.pdf application/pdf attachment 9
// chart.png image/png inline 8
```

`disposition` is the Content-Disposition type as the message gives it, usually `"attachment"` or `"inline"`, or `null` when the part has none. `filename` is `null` when the part names no file.

## Content types

`content` holds the decoded bytes exactly as they were sent. Its type depends on the [`attachmentEncoding`](../api/options#attachmentencoding) option:

| `attachmentEncoding` | `content` | Use it when |
|----------------------|-----------|-------------|
| `'arraybuffer'` (default) | `ArrayBuffer` (`Uint8Array` for calendar parts) | You write, hash or upload the bytes |
| `'base64'` | base64 `string` | You build data URLs or send the content as JSON |
| `'utf8'` | `string` | Every attachment is known to be UTF-8 text |

```javascript
import PostalMime from 'postal-mime';

const raw = `Content-Type: multipart/mixed; boundary="b"

--b
Content-Type: text/plain

See attached.
--b
Content-Type: text/plain; name="note.txt"
Content-Disposition: attachment; filename="note.txt"

Attached note
--b--
`;

const asBytes = await PostalMime.parse(raw);
console.log(new Uint8Array(asBytes.attachments[0].content)); // Uint8Array(13) [ 65, 116, ... ]

const asBase64 = await PostalMime.parse(raw, { attachmentEncoding: 'base64' });
console.log(asBase64.attachments[0].content); // "QXR0YWNoZWQgbm90ZQ=="

const asText = await PostalMime.parse(raw, { attachmentEncoding: 'utf8' });
console.log(asText.attachments[0].content); // "Attached note"
```

With the default encoding, `content.byteLength` is the size of the attachment in bytes for both `ArrayBuffer` and `Uint8Array` content. A string has no `byteLength`, so size checks belong before any conversion to base64 or text.

## Filtering

```javascript
// Files the sender attached, as opposed to images embedded in the HTML
const files = email.attachments.filter(att => !att.related);

// By type
const images = email.attachments.filter(att => att.mimeType.startsWith('image/'));
const pdfs = email.attachments.filter(att => att.mimeType === 'application/pdf');

// By size, with the default arraybuffer encoding
const large = email.attachments.filter(att => att.content.byteLength > 5 * 1024 * 1024);
```

The MIME type and the file name are chosen by the sender. Check the content itself, for example its magic bytes, before trusting either. See [Validate attachment types](./security#3-validate-attachment-types).

## Saving attachments in Node.js

Never use `filename` as a path as it is: it can contain `../`, absolute paths or control characters. Reduce it to a safe base name and write it inside a directory you control:

```javascript
import PostalMime from 'postal-mime';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

function safeFilename(filename, index) {
    // Drop any directory part, then replace everything outside a conservative set
    const name = basename(String(filename || '').replace(/\\/g, '/'))
        .replace(/[^\w.-]/g, '_')
        .replace(/^\.+/, '');
    return name || `attachment-${index}`;
}

const email = await PostalMime.parse(await readFile('message.eml'));

const directory = './attachments';
await mkdir(directory, { recursive: true });

for (const [index, att] of email.attachments.entries()) {
    // content is an ArrayBuffer or, for calendar parts, a Uint8Array
    const filepath = join(directory, `${index}-${safeFilename(att.filename, index)}`);
    await writeFile(filepath, new Uint8Array(att.content));
    console.log('Saved', filepath);
}
```

The index prefix keeps two attachments with the same name from overwriting each other.

## Downloading attachments in the browser

```javascript
function downloadAttachment(att) {
    const blob = new Blob([att.content], { type: att.mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    // The browser sanitizes the download name, but strip directory parts anyway
    link.download = (att.filename || 'attachment').split(/[/\\]/).pop();
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 0);
}
```

## Displaying inline images

An image embedded in an HTML message sits in a `multipart/related` part with a Content-ID, and the HTML refers to it as `cid:<content-id>`. Such attachments have `related: true`. To show them, replace the `cid:` references with data URLs. Parse with `attachmentEncoding: 'base64'` so the content is ready for a data URL:

```javascript
import PostalMime from 'postal-mime';

function inlineImages(html, attachments) {
    const urls = new Map();
    for (const att of attachments) {
        if (att.related && att.contentId && att.encoding === 'base64') {
            // contentId keeps its angle brackets, the cid: URL does not
            const cid = att.contentId.replace(/^<|>$/g, '').toLowerCase();
            urls.set(cid, `data:${att.mimeType};base64,${att.content}`);
        }
    }
    // Look each reference up instead of building a RegExp from the sender's Content-ID
    return html.replace(/cid:([^"'\s)>]+)/gi, (match, cid) => urls.get(cid.toLowerCase()) || match);
}

const email = await PostalMime.parse(
    `Content-Type: multipart/related; boundary="b"

--b
Content-Type: text/html

<p><img src="cid:logo@example.com"></p>
--b
Content-Type: image/png
Content-ID: <logo@example.com>
Content-Transfer-Encoding: base64

iVBORw0KGgo=
--b--
`,
    { attachmentEncoding: 'base64' }
);

console.log(inlineImages(email.html, email.attachments));
// <p><img src="data:image/png;base64,iVBORw0KGgo="></p>
```

The result is still the sender's HTML. Render it in a sandboxed iframe or sanitize it, see [Sanitize HTML content](./security#5-sanitize-html-content).

## Calendar invites

`text/calendar` and `application/ics` parts are attachments, never part of `text`. postal-mime normalizes them to UTF-8 text with LF line endings, and sets `method` to the uppercased `method` parameter of the Content-Type, such as `REQUEST`, `REPLY`, `CANCEL` or `PUBLISH`. With the default encoding, `content` is a `Uint8Array`:

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse(`Subject: Invitation
Content-Type: multipart/mixed; boundary="b"

--b
Content-Type: text/plain

You are invited.
--b
Content-Type: text/calendar; method=REQUEST; charset=utf-8

BEGIN:VCALENDAR\r
METHOD:REQUEST\r
BEGIN:VEVENT\r
SUMMARY:Planning\r
DTSTART:20240115T103000Z\r
END:VEVENT\r
END:VCALENDAR\r
--b--
`);

const invite = email.attachments.find(att => att.mimeType === 'text/calendar');
console.log(invite.method); // "REQUEST"

const ics = new TextDecoder().decode(invite.content);
console.log(ics.match(/^SUMMARY:(.*)$/m)?.[1]); // "Planning"
```

The regular expression above is enough for a quick look. iCalendar folds long lines and escapes special characters, so use an iCalendar parser to read events reliably.

## Nested messages

A `message/rfc822` part is parsed inline by default, and only shows up in `attachments` when:

- it has a Content-Disposition other than `inline`, such as `attachment`,
- the `rfc822Attachments` or `forceRfc822Attachments` [option](../api/options#classification-options) applies,
- the message is a bounce or an abuse report, or
- it is nested deeper than [`maxRfc822NestingDepth`](../api/options#maxrfc822nestingdepth) allows, in which case it carries `rfc822DepthExceeded: true`.

Parse its `content` to read it. Pass the bytes, not a decoded string, so that a message in another charset stays intact:

```javascript
import PostalMime from 'postal-mime';

const email = await PostalMime.parse(`Subject: Fwd
Content-Type: multipart/mixed; boundary="b"

--b
Content-Type: text/plain

Forwarding as an attachment.
--b
Content-Type: message/rfc822
Content-Disposition: attachment; filename="original.eml"

Subject: Original

Original body
--b--
`);

for (const att of email.attachments) {
    if (att.mimeType === 'message/rfc822') {
        const nested = await PostalMime.parse(att.content);
        console.log(att.filename, nested.subject); // original.eml Original
    }
}
```

When you follow nested messages yourself, bound how many levels you follow, as the parser does.

## See Also

- [Attachment object](../api/email#attachment-object) - Every attachment property
- [Parser Options](../api/options) - `attachmentEncoding` and the options that classify nested messages
- [Security](./security) - Untrusted file names, types and sizes
- [Email Viewer example](../examples/email-viewer) - Showing a message with its attachments in a page
