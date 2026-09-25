---
sidebar_position: 4
---

# Types

<img src="/img/mascot/checklist.png" alt="postal-mime mascot with checklist" className="mascot-header" />

TypeScript type definitions for postal-mime. The library is written in TypeScript, and the declarations below are generated from the source during the build.

## Importing Types

```typescript
import PostalMime, { addressParser, decodeWords } from 'postal-mime';
import type {
    Email,
    Address,
    Mailbox,
    AddressGroup,
    Header,
    HeaderLine,
    Attachment,
    AttachmentEncoding,
    PostalMimeOptions,
    AddressParserOptions,
    RawEmail
} from 'postal-mime';
```

Every optional property is declared as `T | undefined`, so the types also work in projects that compile with `exactOptionalPropertyTypes`.

## RawEmail

Input types accepted by `PostalMime.parse()`:

```typescript
type RawEmail = string | ArrayBuffer | ArrayBufferView | Blob | ReadableStream<Uint8Array>;
```

A Node.js `Buffer` is a `Uint8Array`, so it is covered by `ArrayBufferView` together with every other typed array and `DataView`. A `File` is a `Blob`. A stream is read to completion before parsing starts.

## PostalMimeOptions

Configuration options for parsing:

```typescript
type AttachmentEncoding = 'base64' | 'utf8' | 'arraybuffer';

interface PostalMimeOptions {
    rfc822Attachments?: boolean | undefined;
    forceRfc822Attachments?: boolean | undefined;
    attachmentEncoding?: AttachmentEncoding | undefined;
    maxNestingDepth?: number | undefined;
    maxHeadersSize?: number | undefined;
    maxRfc822NestingDepth?: number | undefined;
}
```

### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `rfc822Attachments` | `boolean` | `false` | Treat `message/rfc822` without Content-Disposition as attachments |
| `forceRfc822Attachments` | `boolean` | `false` | Treat all `message/rfc822` as attachments |
| `attachmentEncoding` | `AttachmentEncoding` | `'arraybuffer'` | Attachment content encoding |
| `maxNestingDepth` | `number` | `256` | Maximum MIME nesting depth |
| `maxHeadersSize` | `number` | `2097152` | Maximum total header size (bytes) |
| `maxRfc822NestingDepth` | `number` | `10` | Maximum depth of inline `message/rfc822` parsing |

See [Configuration](../getting-started/configuration) for the details of each option.

## Header

Individual email header:

```typescript
interface Header {
    key: string;         // Lowercase header name
    originalKey: string; // Original header name, preserving case
    value: string;       // Header value, unfolded but not decoded
}
```

### Example

```typescript
const contentType = email.headers.find(
    (h: Header) => h.key === 'content-type'
);
```

## HeaderLine

Raw header line preserving original formatting:

```typescript
interface HeaderLine {
    key: string;   // Lowercase header name
    line: string;  // Complete raw header line (key + value, folded lines joined with newlines)
}
```

`Header.value` is unfolded: the line break of a folded header is removed and the folding whitespace is kept. `HeaderLine.line` keeps the header name and the original line breaks of a folded header instead. Neither decodes encoded words.

This is useful for:
- DKIM signature verification
- Passing headers to external decoders like `libmime.decodeHeader()`
- Debugging email formatting issues

### Example

```typescript
const email = await PostalMime.parse(rawEmail);

// headers[].value is unfolded but encoded words are NOT decoded
const subjectHeader = email.headers.find(h => h.key === 'subject');
console.log(subjectHeader.value); // "=?UTF-8?B?SGVsbG8=?= World" (encoded words preserved)

// email.subject IS decoded (postal-mime decodes specific properties automatically)
console.log(email.subject); // "Hello World"

// Use decodeWords() to decode header values manually:
// import { decodeWords } from 'postal-mime';
// console.log(decodeWords(subjectHeader.value)); // "Hello World"

// headerLines preserves the complete raw format including folding
const subjectLine = email.headerLines.find(h => h.key === 'subject');
console.log(subjectLine.line); // "Subject: =?UTF-8?B?SGVsbG8=?= World"
```

## Address

Union type for email addresses (can be individual or group):

```typescript
type Address = Mailbox | AddressGroup;
```

## Mailbox

Individual email address:

```typescript
interface Mailbox {
    name: string;        // Display name (empty string if none)
    address: string;     // Email address
    group?: undefined;   // Explicitly undefined (for type narrowing)
}
```

## AddressGroup

An RFC 5322 address group such as `Team: a@example.com, b@example.com;`:

```typescript
interface AddressGroup {
    name: string;         // Group name
    address?: undefined;  // Explicitly undefined (for type narrowing)
    group: Mailbox[];     // Members of the group, never nested
}
```

### Type Guard Example

```typescript
function isMailbox(addr: Address): addr is Mailbox {
    return addr.group === undefined;
}

// Usage
if (email.from && isMailbox(email.from)) {
    console.log(email.from.address); // TypeScript knows this is Mailbox
}
```

## Attachment

Email attachment:

```typescript
interface Attachment {
    filename: string | null;
    mimeType: string;
    disposition: 'attachment' | 'inline' | null;
    related?: boolean | undefined;
    description?: string | undefined;
    contentId?: string | undefined;
    method?: string | undefined;
    rfc822DepthExceeded?: boolean | undefined;
    content: ArrayBuffer | Uint8Array | string;
    encoding?: 'base64' | 'utf8' | undefined;
}
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `filename` | `string \| null` | Decoded filename, or `null` if the part did not name one |
| `mimeType` | `string` | Lowercase MIME type |
| `disposition` | `'attachment' \| 'inline' \| null` | Content-Disposition value, or `null` if there was none |
| `related` | `boolean` | `true` for a part with a Content-ID inside a `multipart/related` tree, such as an inline image |
| `description` | `string` | Decoded Content-Description header |
| `contentId` | `string` | Content-ID header, angle brackets included |
| `method` | `string` | Uppercased calendar method (for `text/calendar` and `application/ics`) |
| `rfc822DepthExceeded` | `boolean` | `true` for a `message/rfc822` part that hit `maxRfc822NestingDepth` and was not parsed |
| `content` | `ArrayBuffer \| Uint8Array \| string` | File content: `ArrayBuffer` by default, `Uint8Array` for calendar parts, a string with the `base64` and `utf8` encodings |
| `encoding` | `'base64' \| 'utf8'` | Set when `content` is a string |

## Email

Complete parsed email:

```typescript
interface Email {
    headers: Header[];
    headerLines: HeaderLine[];
    from?: Address | undefined;
    sender?: Address | undefined;
    replyTo?: Address[] | undefined;
    deliveredTo?: string | undefined;
    returnPath?: string | undefined;
    to?: Address[] | undefined;
    cc?: Address[] | undefined;
    bcc?: Address[] | undefined;
    subject?: string | undefined;
    messageId?: string | undefined;
    inReplyTo?: string | undefined;
    references?: string | undefined;
    date?: string | undefined;
    html?: string | undefined;
    text?: string | undefined;
    attachments: Attachment[];
}
```

### Property Details

| Property | Type | Description |
|----------|------|-------------|
| `headers` | `Header[]` | Every header in message order, duplicates included (values unfolded, not decoded) |
| `headerLines` | `HeaderLine[]` | Raw header lines, in the same order as `headers` |
| `from` | `Address` | From address (first occurrence) |
| `sender` | `Address` | Sender address (first occurrence) |
| `replyTo` | `Address[]` | Reply-To addresses |
| `deliveredTo` | `string` | Delivered-To address |
| `returnPath` | `string` | Return-Path address |
| `to` | `Address[]` | To addresses |
| `cc` | `Address[]` | CC addresses |
| `bcc` | `Address[]` | BCC addresses |
| `subject` | `string` | Subject line (decoded) |
| `messageId` | `string` | Message-ID |
| `inReplyTo` | `string` | In-Reply-To |
| `references` | `string` | References |
| `date` | `string` | Date (ISO 8601, or the raw header value if it does not parse as a date) |
| `html` | `string` | HTML content |
| `text` | `string` | Plain text content |
| `attachments` | `Attachment[]` | Attachments |

## AddressParserOptions

Options for `addressParser()`:

```typescript
interface AddressParserOptions {
    flatten?: boolean | undefined;
}
```

## Complete Example

```typescript
import PostalMime from 'postal-mime';
import type {
    Email,
    Address,
    Mailbox,
    Attachment,
    PostalMimeOptions
} from 'postal-mime';

// Type guard for mailbox
function isMailbox(addr: Address): addr is Mailbox {
    return addr.group === undefined;
}

// Parse with options
const options: PostalMimeOptions = {
    attachmentEncoding: 'base64',
    maxNestingDepth: 50
};

async function processEmail(rawEmail: string): Promise<void> {
    const email: Email = await PostalMime.parse(rawEmail, options);

    // Access from address
    if (email.from) {
        if (isMailbox(email.from)) {
            console.log(`From: ${email.from.address}`);
        } else {
            console.log(`From group: ${email.from.name}`);
        }
    }

    // Access recipients
    email.to?.forEach((recipient: Address) => {
        if (isMailbox(recipient)) {
            console.log(`To: ${recipient.address}`);
        }
    });

    // Access subject
    const subject: string | undefined = email.subject;

    // Access attachments
    email.attachments.forEach((att: Attachment) => {
        console.log(`Attachment: ${att.filename}`);

        if (att.encoding === 'base64') {
            const base64Content: string = att.content as string;
        } else {
            const binaryContent: ArrayBuffer = att.content as ArrayBuffer;
        }
    });
}
```

## Using with Cloudflare Workers

```typescript
import PostalMime from 'postal-mime';
import type { Email } from 'postal-mime';

interface Env {
    MY_KV: KVNamespace;
}

export default {
    async email(
        message: ForwardableEmailMessage,
        env: Env,
        ctx: ExecutionContext
    ): Promise<void> {
        const email: Email = await PostalMime.parse(message.raw);

        // Type-safe access
        const subject: string = email.subject ?? '(no subject)';
        const fromAddress: string = email.from?.address ?? 'unknown';

        await env.MY_KV.put(`email:${Date.now()}`, JSON.stringify({
            from: fromAddress,
            subject
        }));
    }
};
```

## Declaration File Location

The declarations are generated from the TypeScript source and shipped next to each build: `dist/esm/postal-mime.d.ts` for the ES module build and `dist/cjs/postal-mime.d.ts` for the CommonJS build. TypeScript picks the right one through the package `exports` map, so nothing needs to be configured.

## See Also

- [PostalMime](./postal-mime) - Main parsing class
- [addressParser()](./address-parser) - Address parsing utility
- [decodeWords()](./decode-words) - MIME decoding utility
