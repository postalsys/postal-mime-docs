---
sidebar_position: 2
---

# addressParser()

Utility function for parsing email address headers into structured objects.

## Import

```javascript
import { addressParser } from 'postal-mime';
```

## Syntax

```javascript
addressParser(addressStr, options?) -> Address[]
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `addressStr` | `string` | Yes | Raw address header string |
| `options` | `AddressParserOptions` | No | Parser options |

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `flatten` | `boolean` | `false` | If `true`, ignores address groups and returns a flat array of addresses |

## Returns

`Address[]` - An array of address objects.

## Address Object

Each address in the returned array has one of two forms:

### Mailbox (Individual Address)

```javascript
{
    name: string,     // Display name (decoded)
    address: string   // Email address
}
```

### Address Group

```javascript
{
    name: string,         // Group name
    group: Mailbox[]      // Array of addresses in the group
}
```

## Examples

### Basic Usage

```javascript
import { addressParser } from 'postal-mime';

const addresses = addressParser('John Doe <john@example.com>');
console.log(addresses);
// [{ name: 'John Doe', address: 'john@example.com' }]
```

### Multiple Addresses

```javascript
const addresses = addressParser(
    'Alice <alice@example.com>, Bob <bob@example.com>'
);
console.log(addresses);
// [
//   { name: 'Alice', address: 'alice@example.com' },
//   { name: 'Bob', address: 'bob@example.com' }
// ]
```

### Address Without Display Name

```javascript
const addresses = addressParser('user@example.com');
console.log(addresses);
// [{ name: '', address: 'user@example.com' }]
```

### MIME Encoded Words

Encoded display names are automatically decoded:

```javascript
const addresses = addressParser(
    '=?utf-8?B?44Ko44Od44K544Kr44O844OJ?= <support@example.com>'
);
console.log(addresses);
// [{ name: 'エポスカード', address: 'support@example.com' }]
```

### Address Groups

RFC 2822 address groups are supported:

```javascript
const addresses = addressParser(
    'Team: alice@example.com, bob@example.com;'
);
console.log(addresses);
// [{
//   name: 'Team',
//   group: [
//     { name: '', address: 'alice@example.com' },
//     { name: '', address: 'bob@example.com' }
//   ]
// }]
```

### Flattening Groups

Use the `flatten` option to get a flat array:

```javascript
const addresses = addressParser(
    'Team: alice@example.com, bob@example.com;',
    { flatten: true }
);
console.log(addresses);
// [
//   { name: '', address: 'alice@example.com' },
//   { name: '', address: 'bob@example.com' }
// ]
```

### Mixed Individual and Group Addresses

```javascript
const addresses = addressParser(
    'admin@example.com, Support Team: help@example.com, support@example.com;'
);
console.log(addresses);
// [
//   { name: '', address: 'admin@example.com' },
//   {
//     name: 'Support Team',
//     group: [
//       { name: '', address: 'help@example.com' },
//       { name: '', address: 'support@example.com' }
//     ]
//   }
// ]
```

### Comments in Addresses

RFC 2822 comments are handled:

```javascript
const addresses = addressParser('user@example.com (John Doe)');
console.log(addresses);
// [{ name: 'John Doe', address: 'user@example.com' }]
```

## Type Narrowing

When working with TypeScript, use type guards to narrow between Mailbox and Group:

```javascript
import { addressParser } from 'postal-mime';
import type { Address, Mailbox } from 'postal-mime';

function isMailbox(addr: Address): addr is Mailbox {
    return !('group' in addr) || addr.group === undefined;
}

const addresses = addressParser(headerValue);

addresses.forEach(addr => {
    if (isMailbox(addr)) {
        console.log(`Individual: ${addr.address}`);
    } else {
        console.log(`Group "${addr.name}":`);
        addr.group.forEach(member => {
            console.log(`  - ${member.address}`);
        });
    }
});
```

## Edge Cases

### Empty Input

```javascript
const addresses = addressParser('');
console.log(addresses); // []
```

### Invalid Addresses

The parser is lenient and attempts to extract what it can:

```javascript
const addresses = addressParser('not a valid email');
console.log(addresses);
// [{ name: 'not a valid email', address: '' }]
```

### Quoted Strings

```javascript
const addresses = addressParser('"Doe, John" <john@example.com>');
console.log(addresses);
// [{ name: 'Doe, John', address: 'john@example.com' }]
```

## Common Use Cases

### Extract All Email Addresses

```javascript
function extractEmails(headerValue) {
    const addresses = addressParser(headerValue, { flatten: true });
    return addresses
        .filter(addr => addr.address)
        .map(addr => addr.address);
}

const emails = extractEmails('Team: alice@x.com, bob@x.com; admin@x.com');
// ['alice@x.com', 'bob@x.com', 'admin@x.com']
```

### Format for Display

```javascript
function formatAddress(addr) {
    if (addr.group) {
        const members = addr.group.map(formatAddress).join(', ');
        return `${addr.name}: ${members}`;
    }
    return addr.name ? `${addr.name} <${addr.address}>` : addr.address;
}

const addresses = addressParser(headerValue);
const formatted = addresses.map(formatAddress);
```

## TypeScript

```typescript
import { addressParser } from 'postal-mime';
import type { Address, Mailbox, AddressParserOptions } from 'postal-mime';

const options: AddressParserOptions = { flatten: true };
const addresses: Address[] = addressParser(headerValue, options);

// Type guard for mailbox
function isMailbox(addr: Address): addr is Mailbox {
    return !('group' in addr) || addr.group === undefined;
}
```

## See Also

- [PostalMime](./postal-mime) - Main parsing class
- [decodeWords()](./decode-words) - Decode MIME encoded words
- [Types](./types) - TypeScript type definitions
