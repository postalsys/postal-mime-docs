---
title: Errors
sidebar_position: 7
description: The error codes postal-mime sets on every error it throws, when each one is raised and how to handle them.
---

# Errors

Every error postal-mime throws has a `code` property that identifies it (since 4.1.0). Match on `code` rather than on the message: the message text may change between releases, the code does not.

## Error codes

| Code | Error type | Cause |
|------|------------|-------|
| `EINVALIDOPTION` | `TypeError` | An option has an invalid value: a limit option that is not a non-negative integer (`maxPartCount`: not a positive one), or an unknown `attachmentEncoding`. See [Validation](./options#limit-validation) |
| `EINVALIDINPUT` | `TypeError` | The email is not of a supported [input type](./postal-mime#input-types), such as a number or a plain object, or a `ReadableStream` produced a chunk that is not an `ArrayBufferView` |
| `EPARSERREUSED` | `Error` | `parse()` was called a second time on the same `PostalMime` instance |
| `EMAXNESTINGDEPTH` | `Error` | MIME parts are nested deeper than [`maxNestingDepth`](./options#maxnestingdepth) |
| `EMAXHEADERSIZE` | `Error` | The headers of the message are larger than [`maxHeadersSize`](./options#maxheaderssize) |
| `EMAXPARTCOUNT` | `Error` | The message has more MIME parts than [`maxPartCount`](./options#maxpartcount) |
| `EMAXFORWARDEDADDRESSES` | `Error` | Inline `message/rfc822` sub-messages hold more addresses than [`maxForwardedAddresses`](./options#maxforwardedaddresses) |

`EINVALIDOPTION`, `EINVALIDINPUT` and `EPARSERREUSED` point to a problem in the calling code. The `EMAX*` codes mean that the message exceeds a resource limit, which usually means that it is malicious or broken, and they are the ones to handle when parsing untrusted mail.

## When errors are raised

- `PostalMime.parse()` reports every error by rejecting the returned promise.
- `new PostalMime(options)` validates the options and throws `EINVALIDOPTION` synchronously.
- `parser.parse()` rejects with all the other codes.

[`maxRfc822NestingDepth`](./options#maxrfc822nestingdepth) does not raise an error: a nested message deeper than the limit is returned as an attachment with `rfc822DepthExceeded: true`.

## What is not an error

- **Malformed message content.** The parser recovers from broken headers, missing boundaries, invalid encodings and unknown charsets, and returns what it could read.
- **Empty input.** `null`, `undefined` and an empty string parse to an empty message.
- **Errors from the input source.** An error raised by the `ReadableStream` or `Blob` the email is read from is passed through unchanged and has no postal-mime `code`.

## Handling errors

```javascript
import PostalMime from 'postal-mime';

async function parseUntrusted(raw) {
    try {
        return await PostalMime.parse(raw, { maxNestingDepth: 50 });
    } catch (err) {
        switch (err.code) {
            case 'EMAXNESTINGDEPTH':
            case 'EMAXHEADERSIZE':
            case 'EMAXPARTCOUNT':
            case 'EMAXFORWARDEDADDRESSES':
                // the message exceeds a resource limit, reject it
                console.error('Rejected email:', err.code);
                return null;
            default:
                // EINVALIDOPTION, EINVALIDINPUT and EPARSERREUSED point to a bug in the calling code
                throw err;
        }
    }
}

const email = await parseUntrusted('Subject: Hello\n\nBody');
console.log(email.subject); // "Hello"
```

## TypeScript

The `PostalMimeError` and `ErrorCode` types describe these errors. A caught value is `unknown`, so narrow it before reading the code:

```typescript
import PostalMime from 'postal-mime';
import type { ErrorCode, PostalMimeError } from 'postal-mime';

const LIMIT_ERRORS: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
    'EMAXNESTINGDEPTH',
    'EMAXHEADERSIZE',
    'EMAXPARTCOUNT',
    'EMAXFORWARDEDADDRESSES'
]);

function isLimitError(error: unknown): error is PostalMimeError {
    const code = (error as Partial<PostalMimeError> | null)?.code;
    return code !== undefined && LIMIT_ERRORS.has(code);
}

try {
    await PostalMime.parse('Subject: Hello\n\nBody');
} catch (error) {
    if (!isLimitError(error)) {
        throw error;
    }
    console.error(`Rejected email (${error.code}): ${error.message}`);
}
```

## See Also

- [PostalMime](./postal-mime) - The methods that raise these errors
- [Parser Options](./options) - The limits behind the `EMAX*` codes
- [Security](../guides/security) - Parsing untrusted mail
- [Troubleshooting](../troubleshooting) - Common errors and their fixes
