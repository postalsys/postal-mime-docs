---
sidebar_position: 3
---

# decodeWords()

<img src="/img/mascot/funnel.png" alt="postal-mime mascot decoding" className="mascot-header" />

Utility function for decoding MIME encoded-words in email headers.

## Import

```javascript
import { decodeWords } from 'postal-mime';
```

## Syntax

```javascript
decodeWords(encodedStr) -> string
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `encodedStr` | `string` | Yes | String that may contain MIME encoded-words |

## Returns

`string` - A Unicode string with all encoded-words decoded.

## About Encoded-Words

MIME encoded-words are used in email headers to represent non-ASCII characters. They follow the format:

```
=?charset?encoding?encoded_text?=
```

Where:
- `charset` - Character set (e.g., `UTF-8`, `ISO-8859-1`)
- `encoding` - Either `B` (Base64) or `Q` (Quoted-Printable)
- `encoded_text` - The encoded content

## Examples

### Base64 Encoding (B)

```javascript
import { decodeWords } from 'postal-mime';

const encoded = '=?UTF-8?B?SGVsbG8gV29ybGQ=?=';
const decoded = decodeWords(encoded);
console.log(decoded); // "Hello World"
```

### Quoted-Printable Encoding (Q)

```javascript
const encoded = '=?UTF-8?Q?Hello_World?=';
const decoded = decodeWords(encoded);
console.log(decoded); // "Hello World"
```

### Japanese Text

```javascript
const encoded = '=?utf-8?B?44GT44KT44Gr44Gh44Gv?=';
const decoded = decodeWords(encoded);
console.log(decoded); // "こんにちは"
```

### Mixed Content

Encoded-words can appear within regular text:

```javascript
const encoded = 'Hello, =?utf-8?B?44Ko44Od44K544Kr44O844OJ?=';
const decoded = decodeWords(encoded);
console.log(decoded); // "Hello, エポスカード"
```

### Multiple Encoded-Words

Adjacent encoded-words are properly joined:

```javascript
const encoded = '=?UTF-8?B?SGVsbG8=?= =?UTF-8?B?V29ybGQ=?=';
const decoded = decodeWords(encoded);
console.log(decoded); // "HelloWorld"
```

### ISO-8859-1 Charset

```javascript
const encoded = '=?ISO-8859-1?Q?caf=E9?=';
const decoded = decodeWords(encoded);
console.log(decoded); // "cafe" with accented e
```

## Common Use Cases

### Decoding Subject Lines

```javascript
import { decodeWords } from 'postal-mime';

function getDecodedSubject(rawSubject) {
    return decodeWords(rawSubject);
}

const subject = getDecodedSubject('=?UTF-8?B?UmU6IOmHjeimgQ==?=');
console.log(subject); // Decoded subject
```

### Processing Custom Headers

```javascript
// When you need to decode a header not automatically processed
const customHeader = email.headers.find(h => h.key === 'x-custom');
if (customHeader) {
    const decodedValue = decodeWords(customHeader.value);
    console.log(decodedValue);
}
```

### Manual Address Decoding

Note: `addressParser()` already calls `decodeWords()` internally, but you can use it directly:

```javascript
const rawName = '=?UTF-8?B?Sm9obiBEb2U=?=';
const decodedName = decodeWords(rawName);
console.log(decodedName); // "John Doe"
```

## Supported Charsets

postal-mime supports common character sets through the TextDecoder API:

- UTF-8
- UTF-16, UTF-16LE, UTF-16BE
- ISO-8859-1 through ISO-8859-15
- Windows-1250 through Windows-1258
- KOI8-R, KOI8-U
- GB2312, GBK, GB18030
- Big5
- Shift_JIS, EUC-JP, ISO-2022-JP
- EUC-KR

## Behavior Notes

### RFC 2231 Language Tags

RFC 2231 allows language tags in encoded-words (e.g., `=?UTF-8*en?B?...?=`). postal-mime silently strips these language tags during decoding:

```javascript
// Language tag is ignored, only charset is used
const encoded = '=?UTF-8*en-US?B?SGVsbG8=?=';
const decoded = decodeWords(encoded);
console.log(decoded); // "Hello"
```

### Unknown Charsets

If an encoded-word uses an unsupported charset, the decoder falls back to `windows-1252`:

```javascript
const encoded = '=?UNKNOWN-CHARSET?B?SGVsbG8=?=';
const decoded = decodeWords(encoded);
// Falls back to windows-1252 decoding if charset not supported by TextDecoder
```

### Malformed Encoded-Words

Invalid encoded-words are returned as-is:

```javascript
const malformed = '=?UTF-8?X?invalid?='; // Invalid encoding 'X'
const result = decodeWords(malformed);
// Returns original string unchanged
```

### Empty Input

```javascript
const decoded = decodeWords('');
console.log(decoded); // ""
```

### Plain Text (No Encoding)

Strings without encoded-words pass through unchanged:

```javascript
const plain = 'Regular text without encoding';
const decoded = decodeWords(plain);
console.log(decoded); // "Regular text without encoding"
```

## TypeScript

```typescript
import { decodeWords } from 'postal-mime';

const encoded: string = '=?UTF-8?B?SGVsbG8=?=';
const decoded: string = decodeWords(encoded);
```

## When to Use

In most cases, you don't need to call `decodeWords()` directly because:

- `PostalMime.parse()` automatically decodes subjects and other headers
- `addressParser()` automatically decodes display names

Use `decodeWords()` when:

1. Processing custom headers not handled by PostalMime
2. Working with raw header values from the `headers` array
3. Decoding encoded content from other sources

## See Also

- [PostalMime](./postal-mime) - Main parsing class (automatically decodes headers)
- [addressParser()](./address-parser) - Parse addresses (automatically decodes names)
- [Types](./types) - TypeScript type definitions
