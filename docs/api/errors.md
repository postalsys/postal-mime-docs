---
sidebar_position: 5
---

# Errors

Every error postal-mime throws has a `code` property that identifies it. Match on `code` rather than on the message: the message text may change between releases, the code does not.

## Error Codes

| Code | Error type | Cause |
|------|------------|-------|
| `EINVALIDOPTION` | `TypeError` | An option has an invalid value: a limit option that is not a non-negative integer, or an unknown `attachmentEncoding` |
| `EINVALIDINPUT` | `TypeError` | The email is not of a supported type, such as a number or a plain object, or a `ReadableStream` produced a chunk that is not an `ArrayBufferView` |
| `EPARSERREUSED` | `Error` | `parse()` was called a second time on the same `PostalMime` instance |
| `EMAXNESTINGDEPTH` | `Error` | MIME parts are nested deeper than [`maxNestingDepth`](../getting-started/configuration#maxnestingdepth) |
| `EMAXHEADERSIZE` | `Error` | The headers of the message are larger than [`maxHeadersSize`](../getting-started/configuration#maxheaderssize) |
| `EMAXPARTCOUNT` | `Error` | The message has more MIME parts than [`maxPartCount`](../getting-started/configuration#maxpartcount) |
| `EMAXFORWARDEDADDRESSES` | `Error` | Inline `message/rfc822` sub-messages hold more addresses than [`maxForwardedAddresses`](../getting-started/configuration#maxforwardedaddresses) |

`EINVALIDOPTION`, `EINVALIDINPUT` and `EPARSERREUSED` point to a problem in the calling code. The `EMAX*` codes mean that the message exceeds a resource limit, which usually means it is malicious or broken, and are the ones to handle when parsing untrusted mail.

## When Errors Are Raised

- `PostalMime.parse()` reports every error by rejecting the returned promise.
- `new PostalMime(options)` validates the options and throws `EINVALIDOPTION` synchronously.
- `parser.parse()` rejects with all the other codes.

`maxRfc822NestingDepth` is not an error: a nested message deeper than the limit is returned as an attachment with `rfc822DepthExceeded: true`.

## What Is Not an Error

- **Malformed message content.** The parser recovers from broken headers, missing boundaries, invalid encodings and unknown charsets, and returns what it could read.
- **Empty input.** `null`, `undefined` and an empty string parse to an empty message.
- **Errors from the input source.** An error raised by the `ReadableStream` or `Blob` the email is read from is passed through unchanged and has no postal-mime `code`.

## Handling Errors

```javascript
import PostalMime from 'postal-mime';

try {
    const email = await PostalMime.parse(rawEmail, { maxNestingDepth: 50 });
    console.log(email.subject);
} catch (error) {
    switch (error.code) {
        case 'EMAXNESTINGDEPTH':
        case 'EMAXHEADERSIZE':
        case 'EMAXPARTCOUNT':
        case 'EMAXFORWARDEDADDRESSES':
            // the message exceeds a resource limit, reject it
            console.error('Rejected email:', error.message);
            break;
        default:
            // EINVALIDOPTION, EINVALIDINPUT and EPARSERREUSED point to a bug in the calling code
            throw error;
    }
}
```

## TypeScript

The `PostalMimeError` and `ErrorCode` types describe these errors:

```typescript
import PostalMime from 'postal-mime';
import type { ErrorCode, PostalMimeError } from 'postal-mime';

const LIMIT_ERRORS: ReadonlySet<ErrorCode> = new Set([
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
    await PostalMime.parse(rawEmail);
} catch (error) {
    if (!isLimitError(error)) {
        throw error;
    }
    console.error(`Rejected email (${error.code}): ${error.message}`);
}
```

## See Also

- [PostalMime](./postal-mime) - Main parsing class
- [Configuration](../getting-started/configuration) - The limit options
- [Security](../guides/security) - Parsing untrusted mail
- [Troubleshooting](../troubleshooting) - Common errors and their fixes
