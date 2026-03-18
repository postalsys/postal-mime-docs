---
sidebar_position: 4
---

# Types

TypeScript type definitions for postal-mime.

## Importing Types

```typescript
import PostalMime, { addressParser, decodeWords } from 'postal-mime';
import type {
    Email,
    Address,
    Mailbox,
    Header,
    HeaderLine,
    Attachment,
    PostalMimeOptions,
    AddressParserOptions,
    RawEmail
} from 'postal-mime';
```

## RawEmail

Input types accepted by `PostalMime.parse()`:

```typescript
type RawEmail =
    | string
    | ArrayBuffer
    | Uint8Array
    | Blob
    | Buffer
    | ReadableStream;
```

## PostalMimeOptions

Configuration options for parsing:

```typescript
type PostalMimeOptions = {
    rfc822Attachments?: boolean;
    forceRfc822Attachments?: boolean;
    attachmentEncoding?: 'base64' | 'utf8' | 'arraybuffer';
    maxNestingDepth?: number;
    maxHeadersSize?: number;
};
```

### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `rfc822Attachments` | `boolean` | `false` | Treat `message/rfc822` without Content-Disposition as attachments |
| `forceRfc822Attachments` | `boolean` | `false` | Treat all `message/rfc822` as attachments |
| `attachmentEncoding` | `string` | `'arraybuffer'` | Attachment content encoding |
| `maxNestingDepth` | `number` | `256` | Maximum MIME nesting depth |
| `maxHeadersSize` | `number` | `2097152` | Maximum header size (bytes) |

## Header

Individual email header:

```typescript
type Header = {
    key: string;         // Lowercase header name
    originalKey: string; // Original header name case
    value: string;       // Header value
};
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
type HeaderLine = {
    key: string;   // Lowercase header name
    line: string;  // Complete raw header line (key + value, folded lines merged)
};
```

Unlike `Header.value`, the `line` property preserves the original header formatting before normalization, including:
- Encoded words (MIME encoded-word syntax)
- Original whitespace
- Folded lines (merged with newlines preserved)

This is useful for:
- DKIM signature verification
- Passing headers to external decoders like `libmime.decodeHeader()`
- Debugging email formatting issues

### Example

```typescript
const email = await PostalMime.parse(rawEmail);

// headers[].value has folding whitespace collapsed but encoded words are NOT decoded
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
type Address = Mailbox | {
    name: string;
    address?: undefined;
    group: Mailbox[];
};
```

## Mailbox

Individual email address:

```typescript
type Mailbox = {
    name: string;        // Display name (empty string if none)
    address: string;     // Email address
    group?: undefined;   // Explicitly undefined (for type narrowing)
};
```

### Type Guard Example

```typescript
function isMailbox(addr: Address): addr is Mailbox {
    return !('group' in addr) || addr.group === undefined;
}

// Usage
if (email.from && isMailbox(email.from)) {
    console.log(email.from.address); // TypeScript knows this is Mailbox
}
```

## Attachment

Email attachment:

```typescript
type Attachment = {
    filename: string | null;
    mimeType: string;
    disposition: 'attachment' | 'inline' | null;
    related?: boolean;
    description?: string;
    contentId?: string;
    method?: string;
    content: ArrayBuffer | Uint8Array | string;
    encoding?: 'base64' | 'utf8';
};
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `filename` | `string \| null` | Original filename |
| `mimeType` | `string` | MIME type |
| `disposition` | `string \| null` | `'attachment'`, `'inline'`, or `null` |
| `related` | `boolean` | `true` if inline image for HTML |
| `description` | `string` | Content-Description header |
| `contentId` | `string` | Content-ID (for inline references) |
| `method` | `string` | Calendar method (for text/calendar) |
| `content` | `ArrayBuffer \| Uint8Array \| string` | File content |
| `encoding` | `string` | `'base64'` or `'utf8'` if converted |

## Email

Complete parsed email:

```typescript
type Email = {
    headers: Header[];
    headerLines: HeaderLine[];
    from?: Address;
    sender?: Address;
    replyTo?: Address[];
    deliveredTo?: string;
    returnPath?: string;
    to?: Address[];
    cc?: Address[];
    bcc?: Address[];
    subject?: string;
    messageId?: string;
    inReplyTo?: string;
    references?: string;
    date?: string;
    html?: string;
    text?: string;
    attachments: Attachment[];
};
```

### Property Details

| Property | Type | Description |
|----------|------|-------------|
| `headers` | `Header[]` | All email headers (folding whitespace collapsed, values not decoded) |
| `headerLines` | `HeaderLine[]` | Raw header lines (original formatting) |
| `from` | `Address` | From address |
| `sender` | `Address` | Sender address |
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
| `date` | `string` | Date (ISO 8601) |
| `html` | `string` | HTML content |
| `text` | `string` | Plain text content |
| `attachments` | `Attachment[]` | Attachments |

## AddressParserOptions

Options for `addressParser()`:

```typescript
type AddressParserOptions = {
    flatten?: boolean;
};
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
    return !('group' in addr) || addr.group === undefined;
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

Types are defined in `postal-mime.d.ts` at the package root. They are automatically loaded when importing postal-mime in TypeScript projects.

## See Also

- [PostalMime](./postal-mime) - Main parsing class
- [addressParser()](./address-parser) - Address parsing utility
- [decodeWords()](./decode-words) - MIME decoding utility
