---
title: Cloudflare Workers
sidebar_position: 3
description: Parse incoming mail in Cloudflare Email Workers with postal-mime, test it locally with Wrangler, and store, route or forward messages based on their content.
---

# Cloudflare Workers

<img src="/img/mascot/server.png" alt="postal-mime mascot at server" className="mascot-header" />

postal-mime runs in Cloudflare Workers without configuration (since 2.1.0). In an [Email Worker](https://developers.cloudflare.com/email-routing/email-workers/), the `email()` handler receives a `ForwardableEmailMessage` whose `raw` property is the message as a `ReadableStream`, which `PostalMime.parse()` accepts directly.

## A basic Email Worker

```javascript
import PostalMime from 'postal-mime';

export default {
    async email(message, env, ctx) {
        const email = await PostalMime.parse(message.raw);

        console.log('Envelope from:', message.from);
        console.log('From header:', email.from?.address);
        console.log('Subject:', email.subject);
        console.log('Attachments:', email.attachments.length);
    }
};
```

`message.from` and `message.to` are the SMTP envelope addresses. `email.from` is the `From` header of the message, which the sender writes and which can differ from the envelope.

### TypeScript

```typescript
import PostalMime from 'postal-mime';
import type { Email } from 'postal-mime';

export default {
    async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
        const email: Email = await PostalMime.parse(message.raw);
        console.log('Subject:', email.subject);
    }
} satisfies ExportedHandler<Env>;
```

`ForwardableEmailMessage`, `ExportedHandler` and `ExecutionContext` come from the Workers runtime types, and `Env` is the interface `wrangler types` generates for your bindings.

## Reading the message once

`message.raw` is a stream, and a stream can be consumed only once. If the worker needs the raw bytes as well as the parsed message, for example to store the original, read the stream into an `ArrayBuffer` first and use that for both:

```javascript
import PostalMime from 'postal-mime';

export default {
    async email(message, env, ctx) {
        const raw = await new Response(message.raw).arrayBuffer();
        const email = await PostalMime.parse(raw);

        await env.MAIL_BUCKET.put(`raw/${crypto.randomUUID()}.eml`, raw);
        console.log('Stored message with subject', email.subject);
    }
};
```

## Testing locally

Run the worker with `npx wrangler dev` and post a raw message to the local email endpoint. The endpoint and its parameters are defined by Wrangler; see Cloudflare's [local development guide](https://developers.cloudflare.com/email-routing/email-workers/local-development/) for the version you use. In current Wrangler releases it is `/cdn-cgi/local/email`, with the envelope addresses as query parameters, and the message must include a `Message-ID` header:

```bash
curl --request POST 'http://localhost:8787/cdn-cgi/local/email' \
  --url-query 'from=sender@example.com' \
  --url-query 'to=recipient@example.com' \
  --data-raw 'From: Sender <sender@example.com>
To: recipient@example.com
Subject: Test Email
Message-ID: <test-1@example.com>

This is a test email body.'
```

To send a saved message instead, use `--data-binary @message.eml`, which keeps its line endings.

## Common patterns

### Route by content

```javascript
import PostalMime from 'postal-mime';

export default {
    async email(message, env, ctx) {
        const email = await PostalMime.parse(message.raw);
        const subject = (email.subject || '').toLowerCase();

        const hasInvoice = email.attachments.some(
            att => att.mimeType === 'application/pdf' && /invoice/i.test(att.filename || '')
        );
        const hasInvite = email.attachments.some(att => att.mimeType === 'text/calendar');

        if (hasInvoice) {
            await message.forward('accounting@example.com');
        } else if (hasInvite) {
            await message.forward('calendar@example.com');
        } else if (subject.includes('support')) {
            await message.forward('support@example.com');
        } else {
            await message.forward('inbox@example.com');
        }
    }
};
```

Cloudflare forwards only to destination addresses that are verified in the account. Matching on a sender-controlled subject or file name is routing, not security: anyone can put "invoice" in a file name.

### Store attachments in R2

An attachment's `filename` is chosen by the sender, so do not use it as an object key as it is. Generate the key, and keep the original name as metadata:

```javascript
import PostalMime from 'postal-mime';

export default {
    async email(message, env, ctx) {
        const email = await PostalMime.parse(message.raw);
        const messageKey = crypto.randomUUID();

        for (const [index, att] of email.attachments.entries()) {
            await env.MAIL_BUCKET.put(`attachments/${messageKey}/${index}`, att.content, {
                httpMetadata: { contentType: att.mimeType },
                customMetadata: { filename: att.filename || '' }
            });
        }
    }
};
```

### Record messages in D1

```javascript
import PostalMime from 'postal-mime';

export default {
    async email(message, env, ctx) {
        const email = await PostalMime.parse(message.raw);

        await env.DB.prepare(
            'INSERT INTO emails (envelope_from, envelope_to, subject, sent_at, attachment_count) VALUES (?, ?, ?, ?, ?)'
        )
            .bind(message.from, message.to, email.subject || '', email.date || null, email.attachments.length)
            .run();
    }
};
```

`email.date` is an ISO 8601 string when the `Date` header parses, and the header as written otherwise, see [Date](../api/email#date).

### Notify a webhook

Use `ctx.waitUntil()` for work that does not have to finish before the handler returns:

```javascript
import PostalMime from 'postal-mime';

export default {
    async email(message, env, ctx) {
        const email = await PostalMime.parse(message.raw);

        ctx.waitUntil(
            fetch(env.WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from: email.from?.address,
                    subject: email.subject,
                    preview: email.text?.slice(0, 200),
                    attachmentCount: email.attachments.length
                })
            })
        );

        await message.forward('inbox@example.com');
    }
};
```

## Limits and errors

Cloudflare rejects inbound messages larger than 25 MiB ([limits](https://developers.cloudflare.com/email-routing/limits/)), and `message.rawSize` holds the size of the message in bytes. postal-mime holds the whole message in memory while parsing, so that bound also bounds the parser's input.

Malformed messages do not throw: the parser returns what it could read. A parse rejects only when the message exceeds one of the [security limits](../api/options#security-limits), which is the case to handle in a worker:

```javascript
import PostalMime from 'postal-mime';

const LIMIT_ERRORS = new Set(['EMAXNESTINGDEPTH', 'EMAXHEADERSIZE', 'EMAXPARTCOUNT', 'EMAXFORWARDEDADDRESSES']);

export default {
    async email(message, env, ctx) {
        let email;
        try {
            email = await PostalMime.parse(message.raw, {
                maxNestingDepth: 50,
                maxPartCount: 1000,
                maxRfc822NestingDepth: 3
            });
        } catch (err) {
            if (LIMIT_ERRORS.has(err.code)) {
                // Rejects the message during the SMTP transaction
                message.setReject('Message structure not accepted');
                return;
            }
            throw err;
        }

        await message.forward('inbox@example.com');
    }
};
```

## Configuration

An Email Worker is attached to addresses through Email Routing rules, set in the Cloudflare dashboard or, in newer Wrangler versions, with the `addresses` field of the Wrangler configuration. See [Email Routing addresses](https://developers.cloudflare.com/email-routing/email-workers/) in the Cloudflare documentation. The bindings used in the examples above look like this in `wrangler.jsonc`:

```jsonc
{
    "name": "email-worker",
    "main": "src/index.js",
    "compatibility_date": "2026-10-01",
    "r2_buckets": [{ "binding": "MAIL_BUCKET", "bucket_name": "email-storage" }],
    "d1_databases": [{ "binding": "DB", "database_name": "emails", "database_id": "<your-database-id>" }],
    "vars": { "WEBHOOK_URL": "https://hooks.example.com/email" }
}
```

## See Also

- [Basic Parsing examples](../examples/basic-parsing) - Parsing patterns that work the same in a worker
- [Security](./security) - Limits and handling for untrusted mail
- [Working with Attachments](./working-with-attachments) - Attachment content types and encodings
- [Cloudflare Email Workers documentation](https://developers.cloudflare.com/email-routing/email-workers/) - The runtime API, routing and local development
