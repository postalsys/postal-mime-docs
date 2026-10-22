---
title: addressParser()
sidebar_position: 4
description: Reference for addressParser(), which parses an email address header into mailboxes and RFC 5322 groups.
---

# addressParser()

<img src="/img/mascot/magnifier.png" alt="postal-mime mascot searching" className="mascot-header" />

`addressParser()` parses the value of an address header, such as `From`, `To` or `Cc`, into structured addresses. `PostalMime.parse()` uses it for the [address properties](./email#addresses) of the parsed message. It is exported since 2.2.4.

```javascript
import { addressParser } from 'postal-mime';
```

## Syntax

```javascript
addressParser(addressStr, options?) -> Address[]
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `addressStr` | `string` | Yes | The raw header value, without the header name |
| `options` | `AddressParserOptions` | No | Parser options |

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `flatten` | `boolean` | `false` | When `true`, groups are replaced by their members, so the result is a flat array of mailboxes |

### Return value

An array of addresses, in header order. Each address is either:

- a **mailbox**, `{ address, name }`, where `name` is the decoded display name or `""`, or
- a **group**, `{ name, group }`, where `group` is an array of mailboxes.

The TypeScript types are `Mailbox`, `AddressGroup` and their union `Address`, see [Types](./types#address-mailbox-and-addressgroup). The function does not throw; text that holds no address gives a mailbox with an empty `address`, and an empty string gives `[]`.

## Examples

### Mailboxes

```javascript
import { addressParser } from 'postal-mime';

console.log(addressParser('John Doe <john@example.com>'));
// [ { address: 'john@example.com', name: 'John Doe' } ]

console.log(addressParser('Alice <alice@example.com>, bob@example.com'));
// [
//   { address: 'alice@example.com', name: 'Alice' },
//   { address: 'bob@example.com', name: '' }
// ]

console.log(addressParser('"Doe, John" <john@example.com>'));
// [ { address: 'john@example.com', name: 'Doe, John' } ]

console.log(addressParser('user@example.com (John Doe)'));
// [ { address: 'user@example.com', name: 'John Doe' } ]
```

A comment is used as the display name when there is no other name.

### Encoded display names

RFC 2047 encoded words in a display name are decoded:

```javascript
import { addressParser } from 'postal-mime';

console.log(addressParser('=?utf-8?B?44Ko44Od44K544Kr44O844OJ?= <support@example.com>'));
// [ { address: 'support@example.com', name: 'エポスカード' } ]
```

An address is only ever read from the raw header. An encoded word that decodes to something that looks like a mailbox becomes a display name with an empty address (since 4.1.1), because the raw header holds no mailbox that a DMARC verifier could have authenticated:

```javascript
import { addressParser } from 'postal-mime';

// =?utf-8?B?...?= encodes "Name <name@example.com>"
console.log(addressParser('=?utf-8?B?TmFtZSA8bmFtZUBleGFtcGxlLmNvbT4=?='));
// [ { address: '', name: 'Name <name@example.com>' } ]
```

### Groups

```javascript
import { addressParser } from 'postal-mime';

const header = 'admin@example.com, Support Team: help@example.com, support@example.com;';

console.log(addressParser(header));
// [
//   { address: 'admin@example.com', name: '' },
//   {
//     name: 'Support Team',
//     group: [
//       { address: 'help@example.com', name: '' },
//       { address: 'support@example.com', name: '' }
//     ]
//   }
// ]

console.log(addressParser(header, { flatten: true }));
// [
//   { address: 'admin@example.com', name: '' },
//   { address: 'help@example.com', name: '' },
//   { address: 'support@example.com', name: '' }
// ]
```

Groups are never nested in the result. RFC 5322 does not allow a group inside a group; when a header has one anyway, the inner group's name is dropped, its members belong to the outer group, and the first `;` closes the group.

## Edge cases

| Input | Result | Notes |
|-------|--------|-------|
| `''` | `[]` | |
| `'not a valid email'` | `[{ address: '', name: 'not a valid email' }]` | Text without an address becomes a name |
| `'Joe Foo, PhD <joe@example.com>'` | `[{ address: 'joe@example.com', name: 'Joe Foo, PhD' }]` | An entry with only a name, followed by an entry with a name and an address, is merged back into one |
| `'"user@evil.com"@good.com'` | `[{ address: '"user@evil.com"@good.com', name: '' }]` | A quoted local part keeps its quotes, so the address has one `@` outside quotes to split the domain at |
| `'user@[IPv6:2001:db8::1]'` | `[{ address: 'user@[IPv6:2001:db8::1]', name: '' }]` | Domain literals are kept intact |
| `'Name <user@example.com(x)evil.com>'` | `[{ address: 'user@example.com', name: 'Name evil.com' }]` | A comment ends the domain; the text after it is not joined to the address |
| `'<user@example.com foo>'` | `[{ address: 'user@example.com', name: 'foo' }]` | Text inside the angle brackets that is not the mailbox becomes display text |

The [Security guide](../guides/security#address-extraction-safeguards) explains why these cases are resolved the way they are.

## Common tasks

### Collect every address of a header

```javascript
import { addressParser } from 'postal-mime';

function extractEmails(headerValue) {
    return addressParser(headerValue, { flatten: true })
        .map(addr => addr.address)
        .filter(Boolean);
}

console.log(extractEmails('Team: alice@example.com, bob@example.com;, admin@example.com'));
// [ 'alice@example.com', 'bob@example.com', 'admin@example.com' ]
```

### Format an address for display

```javascript
import { addressParser } from 'postal-mime';

function formatAddress(addr) {
    if (addr.group) {
        return `${addr.name}: ${addr.group.map(formatAddress).join(', ')};`;
    }
    return addr.name ? `${addr.name} <${addr.address}>` : addr.address;
}

console.log(addressParser('Alice <alice@example.com>, Team: bob@example.com;').map(formatAddress).join(', '));
// Alice <alice@example.com>, Team: bob@example.com;
```

## TypeScript

```typescript
import { addressParser } from 'postal-mime';
import type { Address, AddressParserOptions, Mailbox } from 'postal-mime';

function isMailbox(addr: Address): addr is Mailbox {
    return addr.group === undefined;
}

const options: AddressParserOptions = { flatten: true };
const mailboxes: Mailbox[] = addressParser('Team: a@example.com, b@example.com;', options).filter(isMailbox);
console.log(mailboxes.map(m => m.address)); // [ 'a@example.com', 'b@example.com' ]
```

## See Also

- [Email Object](./email#addresses) - The address properties of a parsed message
- [decodeWords()](./decode-words) - Decode encoded words in other headers
- [Security](../guides/security#address-extraction-safeguards) - How the parser resists address spoofing
- [Types](./types) - The `Address`, `Mailbox` and `AddressGroup` types
