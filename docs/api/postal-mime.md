---
sidebar_position: 1
---

# PostalMime

The main class for parsing RFC822 email messages.

## Import

```javascript
import PostalMime from 'postal-mime';
```

## Static Methods

### PostalMime.parse()

Parse an email message using the static method (recommended for most use cases).

```javascript
PostalMime.parse(email, options?) -> Promise<Email>
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | `RawEmail` | Yes | The raw email content to parse |
| `options` | `PostalMimeOptions` | No | Parsing configuration options |

#### RawEmail Types

The `email` parameter accepts multiple input formats:

| Type | Description |
|------|-------------|
| `string` | Raw email as a string |
| `ArrayBuffer` | Raw email as ArrayBuffer |
| `Uint8Array` | Raw email as Uint8Array |
| `Blob` | Blob object (browser only) |
| `Buffer` | Node.js Buffer |
| `ReadableStream` | Web ReadableStream |

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `rfc822Attachments` | `boolean` | `false` | Treat `message/rfc822` parts without Content-Disposition as attachments |
| `forceRfc822Attachments` | `boolean` | `false` | Treat all `message/rfc822` parts as attachments |
| `attachmentEncoding` | `string` | `'arraybuffer'` | How to encode attachment content: `'arraybuffer'`, `'base64'`, or `'utf8'` |
| `maxNestingDepth` | `number` | `256` | Maximum MIME part nesting depth |
| `maxHeadersSize` | `number` | `2097152` | Maximum header size in bytes (2MB) |

#### Returns

`Promise<Email>` - A Promise that resolves to the parsed email object.

#### Example

```javascript
import PostalMime from 'postal-mime';

const rawEmail = `From: sender@example.com
To: recipient@example.com
Subject: Hello
Content-Type: text/plain

Hello, World!`;

const email = await PostalMime.parse(rawEmail);
console.log(email.subject); // "Hello"
```

#### With Options

```javascript
const email = await PostalMime.parse(rawEmail, {
    attachmentEncoding: 'base64',
    maxNestingDepth: 50
});
```

## Constructor

### new PostalMime()

Create a new parser instance.

```javascript
new PostalMime(options?)
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `options` | `PostalMimeOptions` | No | Parsing configuration options |

#### Example

```javascript
const parser = new PostalMime({ attachmentEncoding: 'base64' });
const email = await parser.parse(rawEmail);
```

:::caution
Parser instances cannot be reused. Create a new instance for each email you parse.
:::

## Instance Methods

### parse()

Parse an email message.

```javascript
parser.parse(email) -> Promise<Email>
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | `RawEmail` | Yes | The raw email content to parse |

#### Returns

`Promise<Email>` - A Promise that resolves to the parsed email object.

#### Example

```javascript
const parser = new PostalMime();
const email = await parser.parse(rawEmail);
```

## Email Object

The parsed email object contains the following properties:

### Headers

| Property | Type | Description |
|----------|------|-------------|
| `headers` | `Header[]` | Array of all headers |

```javascript
email.headers.forEach(header => {
    console.log(header.key);   // Lowercase header name
    console.log(header.value); // Header value
});
```

### Addresses

| Property | Type | Description |
|----------|------|-------------|
| `from` | `Address \| undefined` | From address |
| `sender` | `Address \| undefined` | Sender address |
| `replyTo` | `Address[] \| undefined` | Reply-To addresses |
| `to` | `Address[] \| undefined` | To addresses |
| `cc` | `Address[] \| undefined` | CC addresses |
| `bcc` | `Address[] \| undefined` | BCC addresses |
| `deliveredTo` | `string \| undefined` | Delivered-To address (string only) |
| `returnPath` | `string \| undefined` | Return-Path address (string only) |

### Message Identifiers

| Property | Type | Description |
|----------|------|-------------|
| `messageId` | `string \| undefined` | Message-ID header |
| `inReplyTo` | `string \| undefined` | In-Reply-To header |
| `references` | `string \| undefined` | References header |

### Content

| Property | Type | Description |
|----------|------|-------------|
| `subject` | `string \| undefined` | Subject line (decoded) |
| `date` | `string \| undefined` | Date in ISO 8601 format |
| `text` | `string \| undefined` | Plain text content |
| `html` | `string \| undefined` | HTML content |
| `attachments` | `Attachment[]` | Array of attachments |

## Complete Example

```javascript
import PostalMime from 'postal-mime';

async function processEmail(rawEmail) {
    const email = await PostalMime.parse(rawEmail, {
        attachmentEncoding: 'base64'
    });

    console.log('From:', email.from?.address);
    console.log('To:', email.to?.map(a => a.address).join(', '));
    console.log('Subject:', email.subject);
    console.log('Date:', email.date);

    if (email.text) {
        console.log('Text content:', email.text);
    }

    if (email.html) {
        console.log('HTML content available');
    }

    console.log(`Attachments: ${email.attachments.length}`);
    email.attachments.forEach(att => {
        console.log(`  - ${att.filename} (${att.mimeType})`);
    });
}
```

## TypeScript

```typescript
import PostalMime from 'postal-mime';
import type { Email, PostalMimeOptions } from 'postal-mime';

const options: PostalMimeOptions = {
    attachmentEncoding: 'base64',
    maxNestingDepth: 100
};

const email: Email = await PostalMime.parse(rawEmail, options);
```

## Error Handling

```javascript
try {
    const email = await PostalMime.parse(rawEmail);
} catch (error) {
    if (error.message.includes('nesting depth')) {
        console.error('Email has too many nested parts');
    } else if (error.message.includes('header size')) {
        console.error('Email headers are too large');
    } else if (error.message.includes('Can not reuse parser')) {
        console.error('Parser instance already used');
    } else {
        console.error('Parsing failed:', error);
    }
}
```

## See Also

- [addressParser()](./address-parser) - Parse email addresses
- [decodeWords()](./decode-words) - Decode MIME encoded words
- [Types](./types) - TypeScript type definitions
