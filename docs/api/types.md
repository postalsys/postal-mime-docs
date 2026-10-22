---
title: Types
sidebar_position: 6
description: The TypeScript declarations postal-mime exports, how to import them in ES module and CommonJS projects, and how to narrow an Address.
---

# Types

postal-mime is written in TypeScript (since 4.0.0). The declarations are generated from the source during the build and ship next to both builds, `dist/esm/postal-mime.d.ts` and `dist/cjs/postal-mime.d.ts`, so no `@types` package is needed. TypeScript finds the right one through the package `exports` map.

This page lists the declarations. What each property means is documented on the [Email Object](./email), [Parser Options](./options) and [Errors](./errors) pages.

## Importing types

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
    AttachmentDisposition,
    AttachmentEncoding,
    PostalMimeOptions,
    AddressParserOptions,
    RawEmail,
    PostalMimeError,
    ErrorCode
} from 'postal-mime';
```

In a CommonJS project, the declaration exports the class with `export =`, which is the shape `require()` returns. The types are members of the class namespace:

```typescript
import PostalMime = require('postal-mime');

const email: PostalMime.Email = await PostalMime.parse('Subject: Hello\n\nBody');
const addresses: PostalMime.Address[] = PostalMime.addressParser('Name <name@example.com>');
```

With `esModuleInterop` enabled, `import PostalMime, { addressParser, decodeWords } from 'postal-mime'` works in a CommonJS project as well. A project that compiles with both `esModuleInterop` and `allowSyntheticDefaultImports` switched off has to use the `import ... = require()` form.

## Declarations

The public types are type aliases rather than interfaces, so a parsed message stays assignable to `Record<string, unknown>`. Every optional property is declared as `T | undefined`, so the types also work under `exactOptionalPropertyTypes`.

### RawEmail

```typescript
type RawEmail = string | ArrayBuffer | ArrayBufferView | Blob | ReadableStream<Uint8Array>;
```

See [Input types](./postal-mime#input-types).

### PostalMimeOptions

```typescript
type AttachmentEncoding = 'base64' | 'utf8' | 'arraybuffer';

type PostalMimeOptions = {
    rfc822Attachments?: boolean | undefined;
    forceRfc822Attachments?: boolean | undefined;
    attachmentEncoding?: AttachmentEncoding | undefined;
    maxNestingDepth?: number | undefined;
    maxHeadersSize?: number | undefined;
    maxPartCount?: number | undefined;
    maxRfc822NestingDepth?: number | undefined;
    maxForwardedAddresses?: number | undefined;
};
```

See [Parser Options](./options).

### Email

```typescript
type Email = {
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
};
```

See [Email Object](./email#properties).

### Header and HeaderLine

```typescript
type Header = {
    key: string;
    originalKey: string;
    value: string;
};

type HeaderLine = {
    key: string;
    line: string;
};
```

See [Header object](./email#header-object) and [HeaderLine object](./email#headerline-object).

### Address, Mailbox and AddressGroup

```typescript
type Mailbox = {
    name: string;
    address: string;
    group?: undefined;
};

type AddressGroup = {
    name: string;
    address?: undefined;
    group: Mailbox[];
};

type Address = Mailbox | AddressGroup;

type AddressParserOptions = {
    flatten?: boolean | undefined;
};
```

See [Addresses](./email#addresses) and [addressParser()](./address-parser).

### Attachment

```typescript
type AttachmentDisposition = 'attachment' | 'inline' | (string & {});

type Attachment = {
    filename: string | null;
    mimeType: string;
    disposition: AttachmentDisposition | null;
    related?: boolean | undefined;
    description?: string | undefined;
    contentId?: string | undefined;
    method?: string | undefined;
    rfc822DepthExceeded?: boolean | undefined;
    content: ArrayBuffer | Uint8Array | string;
    encoding?: 'base64' | 'utf8' | undefined;
};
```

`AttachmentDisposition` accepts any string, because the Content-Disposition token of a message is passed through as it is. The two common values are spelled out for editor completion. Before 4.0.0, `disposition` was typed as `'attachment' | 'inline' | null`.

See [Attachment object](./email#attachment-object).

### PostalMimeError and ErrorCode

```typescript
type ErrorCode =
    | 'EINVALIDOPTION'
    | 'EINVALIDINPUT'
    | 'EPARSERREUSED'
    | 'EMAXNESTINGDEPTH'
    | 'EMAXHEADERSIZE'
    | 'EMAXPARTCOUNT'
    | 'EMAXFORWARDEDADDRESSES';

interface PostalMimeError extends Error {
    code: ErrorCode;
}
```

See [Errors](./errors) for what each code means and how to narrow a caught value.

## Narrowing an Address

A mailbox has no `group` and a group has no `address`, so either property narrows the union:

```typescript
import PostalMime from 'postal-mime';
import type { Address, Mailbox } from 'postal-mime';

function isMailbox(addr: Address): addr is Mailbox {
    return addr.group === undefined;
}

const email = await PostalMime.parse('From: Team: a@example.com, b@example.com;\n\nBody');

if (email.from && isMailbox(email.from)) {
    console.log(email.from.address);
} else if (email.from) {
    console.log(email.from.group.map(member => member.address)); // [ 'a@example.com', 'b@example.com' ]
}
```

## Narrowing attachment content

`content` is a union. Check the `encoding` property, which is set exactly when `content` is a string:

```typescript
import type { Attachment } from 'postal-mime';

function contentBytes(att: Attachment): Uint8Array {
    if (typeof att.content === 'string') {
        // att.encoding is 'base64' or 'utf8'
        return att.encoding === 'base64'
            ? Uint8Array.from(atob(att.content), c => c.charCodeAt(0))
            : new TextEncoder().encode(att.content);
    }
    // ArrayBuffer by default, Uint8Array for calendar parts
    return att.content instanceof Uint8Array ? att.content : new Uint8Array(att.content);
}
```

## See Also

- [Email Object](./email) - What each property of `Email` and `Attachment` holds
- [Parser Options](./options) - What each option does
- [Errors](./errors) - Error codes and narrowing a caught error
- [Upgrading](../getting-started/upgrading) - Type changes in 4.0.0
