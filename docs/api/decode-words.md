---
title: decodeWords()
sidebar_position: 5
description: Reference for decodeWords(), which decodes RFC 2047 encoded words in header values, and the list of charsets postal-mime supports.
---

# decodeWords()

<img src="/img/mascot/funnel.png" alt="postal-mime mascot decoding" className="mascot-header" />

`decodeWords()` decodes RFC 2047 encoded words, the `=?charset?encoding?text?=` sequences that carry non-ASCII text in email headers. It is exported since 2.2.4.

```javascript
import { decodeWords } from 'postal-mime';
```

You rarely need to call it yourself: `PostalMime.parse()` decodes `subject`, `messageId`, `inReplyTo` and `references`, and [`addressParser()`](./address-parser) decodes display names. Use it for a value from [`headers`](./email#header-object), which is not decoded, or for header text from another source.

## Syntax

```javascript
decodeWords(encodedStr) -> string
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `encodedStr` | `string` | Yes | Text that may contain encoded words |

### Return value

The text with every encoded word decoded. Text outside encoded words, and anything that is not a valid encoded word, is returned unchanged. The function does not throw.

## Encoded word format

```text
=?charset?encoding?encoded-text?=
```

- `charset` is a charset label, such as `UTF-8` or `ISO-8859-1`. An RFC 2231 language suffix (`UTF-8*en`) is accepted and ignored
- `encoding` is `B` (base64) or `Q` (a quoted-printable variant where `_` stands for a space), in either case
- `encoded-text` is the encoded bytes

## Examples

```javascript
import { decodeWords } from 'postal-mime';

console.log(decodeWords('=?UTF-8?B?SGVsbG8gV29ybGQ=?='));                    // "Hello World"
console.log(decodeWords('=?UTF-8?Q?Hello_World?='));                         // "Hello World"
console.log(decodeWords('=?ISO-8859-1?Q?caf=E9?='));                         // "café"
console.log(decodeWords('Hello, =?utf-8?B?44Ko44Od44K544Kr44O844OJ?='));      // "Hello, エポスカード"
console.log(decodeWords('=?UTF-8?B?UmU6IOmHjeimgQ==?='));                    // "Re: 重要"
console.log(decodeWords('=?UTF-8*en-US?B?SGVsbG8=?='));                       // "Hello"
console.log(decodeWords('Regular text without encoding'));                   // "Regular text without encoding"
console.log(decodeWords(''));                                                // ""
```

### Adjacent encoded words

Whitespace between two encoded words is not part of the text (RFC 2047 section 6.2), so adjacent words are joined without it:

```javascript
import { decodeWords } from 'postal-mime';

console.log(decodeWords('=?UTF-8?B?SGVsbG8=?= =?UTF-8?B?V29ybGQ=?=')); // "HelloWorld"
```

### Invalid encoded words

An encoded word with an unknown encoding is left as it is:

```javascript
import { decodeWords } from 'postal-mime';

console.log(decodeWords('=?UTF-8?X?invalid?=')); // "=?UTF-8?X?invalid?="
```

## Supported charsets

The same charset handling applies to encoded words, to text and HTML bodies, and to RFC 2231 encoded parameters such as file names.

Decoding is done with the runtime's `TextDecoder`, so every label of the [WHATWG Encoding Standard](https://encoding.spec.whatwg.org/#names-and-labels) is supported: UTF-8, UTF-16LE and UTF-16BE, the ISO-8859 family, windows-1250 through windows-1258, KOI8-R and KOI8-U, macintosh, GBK and GB18030, Big5, Shift_JIS, EUC-JP, ISO-2022-JP and EUC-KR, among others. A runtime built without some of these encodings, such as Node.js with small ICU, treats their labels as unknown.

On top of those, labels that mail clients use but the standard does not list are mapped to the matching decoder (since 3.0.0):

- `x-` and `cs` prefixes and stray separators, so `x-big5` or `iso_8859_2` resolve
- Windows and IBM code page numbers: `cp932`, `windows-932`, `ms932` and `ibm932` for Shift_JIS, and the same forms of 936 (GBK), 949 (EUC-KR), 950 (Big5), 874 (windows-874), 51932 (EUC-JP) and 50220 to 50222 (ISO-2022-JP)
- `iso-8859-8-i` and `iso-8859-8-e` as ISO-8859-8
- `shiftjis`, `windows-31j` and `ms_kanji` as Shift_JIS; `eucjp` as EUC-JP; `euckr` and `uhc` as EUC-KR
- `iso-2022-jp-1`, `iso-2022-jp-2` and `junet` as ISO-2022-JP
- `tis-620` as windows-874

### Special cases

- **Unknown labels.** Text in a charset label that cannot be resolved is decoded as UTF-8 when its bytes are valid UTF-8, and as windows-1252 otherwise (since 4.0.5). A part without a charset is read the same way.
- **The replacement encoding.** ISO-2022-KR, ISO-2022-CN and HZ-GB-2312 decode to a single U+FFFD replacement character, as they do in a browser (since 4.1.1). Their shift sequences let the same bytes read as text to one decoder and as markup to another.
- **UTF-16 byte order marks.** A byte order mark decides the byte order only under a label that leaves it open: `utf-16`, `ucs-2`, `unicode`, `csunicode` and `iso-10646-ucs-2` (since 4.1.3). `utf-16le` and `utf-16be` are read in the order they name, whatever mark the bytes carry.
- **Wrong labels.** A declared charset is followed even when the bytes are not valid in it, so a message that declares the wrong charset decodes to the wrong text or to replacement characters.

```javascript
import { decodeWords } from 'postal-mime';

console.log(decodeWords('=?x-unknown?B?Y2Fmw6k=?=')); // "café", the bytes are valid UTF-8
console.log(decodeWords('=?x-unknown?B?Y2Fm6Q==?='));  // "café", read as windows-1252
```

## TypeScript

```typescript
import { decodeWords } from 'postal-mime';

const decoded: string = decodeWords('=?UTF-8?B?SGVsbG8=?=');
```

## See Also

- [Email Object](./email#header-object) - Which header values are decoded and which are not
- [addressParser()](./address-parser) - Parses address headers, decoding display names
- [Parsing Emails](../guides/parsing-emails#character-encoding) - Charset handling in message bodies
- [Troubleshooting](../troubleshooting#text-content-has-strange-characters) - Garbled text
