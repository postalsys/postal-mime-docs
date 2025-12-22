---
sidebar_position: 3
---

# Cloudflare Workers

postal-mime is ideal for parsing emails in Cloudflare Email Workers. This guide covers integration patterns and best practices.

## Email Workers Setup

Cloudflare Email Workers allow you to programmatically process incoming emails for your domain.

### Basic Email Worker

```javascript
import PostalMime from 'postal-mime';

export default {
    async email(message, env, ctx) {
        // Parse the incoming email
        const email = await PostalMime.parse(message.raw);

        console.log('From:', email.from?.address);
        console.log('Subject:', email.subject);
        console.log('Attachments:', email.attachments.length);
    }
};
```

### TypeScript Version

```typescript
import PostalMime from 'postal-mime';
import type { Email } from 'postal-mime';

interface Env {
    // Your environment bindings
}

export default {
    async email(
        message: ForwardableEmailMessage,
        env: Env,
        ctx: ExecutionContext
    ): Promise<void> {
        const email: Email = await PostalMime.parse(message.raw);

        console.log('Subject:', email.subject);
    }
};
```

## Local Development

Wrangler provides local testing capabilities for Email Workers without deploying to Cloudflare.

### Running the Development Server

Start the local development server:

```bash
npx wrangler dev
```

### Testing Email Reception

Wrangler exposes a local endpoint at `/cdn-cgi/handler/email`. Send test emails using curl:

```bash
curl --request POST 'http://localhost:8787/cdn-cgi/handler/email' \
  --url-query 'from=sender@example.com' \
  --url-query 'to=recipient@example.com' \
  --header 'Content-Type: application/json' \
  --data-raw 'From: sender@example.com
To: recipient@example.com
Subject: Test Email

This is a test email body.'
```

### Testing with .eml Files

You can also send a complete .eml file:

```bash
curl --request POST 'http://localhost:8787/cdn-cgi/handler/email' \
  --url-query 'from=sender@example.com' \
  --url-query 'to=recipient@example.com' \
  --header 'Content-Type: application/json' \
  --data-binary @test-email.eml
```

### Sending Emails Locally

To test sending emails, add the `send_email` binding to your wrangler configuration:

```toml
[[send_email]]
name = "EMAIL"
```

Or in `wrangler.jsonc`:

```jsonc
{
  "send_email": [
    {
      "name": "EMAIL"
    }
  ]
}
```

When running locally, Wrangler simulates sending by writing emails to `.eml` files and displays the file paths in the terminal.

### Local Simulation of reply() and forward()

The `message.reply()` and `message.forward()` methods also work locally. Wrangler simulates their execution and outputs the resulting email file paths to the terminal for inspection.

## Common Patterns

### Forward Based on Content

```javascript
import PostalMime from 'postal-mime';

export default {
    async email(message, env, ctx) {
        const email = await PostalMime.parse(message.raw);

        // Forward to different addresses based on subject
        if (email.subject?.toLowerCase().includes('urgent')) {
            await message.forward('urgent@example.com');
        } else if (email.subject?.toLowerCase().includes('support')) {
            await message.forward('support@example.com');
        } else {
            await message.forward('general@example.com');
        }
    }
};
```

### Store Attachments in R2

```javascript
import PostalMime from 'postal-mime';

export default {
    async email(message, env, ctx) {
        const email = await PostalMime.parse(message.raw);

        // Store each attachment in R2
        for (const attachment of email.attachments) {
            if (attachment.filename) {
                const key = `attachments/${Date.now()}-${attachment.filename}`;
                await env.MY_BUCKET.put(key, attachment.content, {
                    httpMetadata: {
                        contentType: attachment.mimeType
                    }
                });
                console.log(`Stored: ${key}`);
            }
        }
    }
};
```

### Log to D1 Database

```javascript
import PostalMime from 'postal-mime';

export default {
    async email(message, env, ctx) {
        const email = await PostalMime.parse(message.raw);

        // Insert email metadata into D1
        await env.DB.prepare(`
            INSERT INTO emails (from_address, to_address, subject, date, has_attachments)
            VALUES (?, ?, ?, ?, ?)
        `).bind(
            email.from?.address || '',
            message.to,
            email.subject || '',
            email.date || new Date().toISOString(),
            email.attachments.length > 0 ? 1 : 0
        ).run();
    }
};
```

### Send Notification via Webhook

```javascript
import PostalMime from 'postal-mime';

export default {
    async email(message, env, ctx) {
        const email = await PostalMime.parse(message.raw);

        // Send notification to webhook
        await fetch(env.WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: email.from?.address,
                subject: email.subject,
                preview: email.text?.substring(0, 200),
                attachmentCount: email.attachments.length,
                timestamp: new Date().toISOString()
            })
        });
    }
};
```

## Handling Large Emails

### Attachment Size Limits

```javascript
import PostalMime from 'postal-mime';

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB

export default {
    async email(message, env, ctx) {
        const email = await PostalMime.parse(message.raw);

        const oversizedAttachments = email.attachments.filter(
            att => att.content.byteLength > MAX_ATTACHMENT_SIZE
        );

        if (oversizedAttachments.length > 0) {
            console.warn('Email contains oversized attachments');
            // Handle accordingly
        }
    }
};
```

### Security Limits

```javascript
import PostalMime from 'postal-mime';

export default {
    async email(message, env, ctx) {
        try {
            const email = await PostalMime.parse(message.raw, {
                maxNestingDepth: 50,    // Stricter limit
                maxHeadersSize: 524288  // 512KB
            });

            // Process email...
        } catch (error) {
            if (error.message.includes('nesting depth') ||
                error.message.includes('header size')) {
                console.error('Potentially malicious email rejected');
                return; // Drop the email
            }
            throw error;
        }
    }
};
```

## Email Filtering

### Spam Detection

```javascript
import PostalMime from 'postal-mime';

function isLikelySpam(email) {
    const spamIndicators = [
        // No sender
        !email.from?.address,
        // Suspicious subject patterns
        /urgent|winner|lottery|claim/i.test(email.subject || ''),
        // Mismatched from/reply-to
        email.replyTo?.[0]?.address !== email.from?.address,
        // Only HTML content (no text alternative)
        email.html && !email.text
    ];

    return spamIndicators.filter(Boolean).length >= 2;
}

export default {
    async email(message, env, ctx) {
        const email = await PostalMime.parse(message.raw);

        if (isLikelySpam(email)) {
            console.log('Potential spam detected, dropping email');
            return;
        }

        await message.forward('inbox@example.com');
    }
};
```

### Content-Based Routing

```javascript
import PostalMime from 'postal-mime';

export default {
    async email(message, env, ctx) {
        const email = await PostalMime.parse(message.raw);

        // Check for specific attachment types
        const hasInvoice = email.attachments.some(
            att => att.mimeType === 'application/pdf' &&
                   att.filename?.toLowerCase().includes('invoice')
        );

        if (hasInvoice) {
            await message.forward('accounting@example.com');
            return;
        }

        // Check for calendar invites
        const hasCalendarInvite = email.attachments.some(
            att => att.mimeType === 'text/calendar'
        );

        if (hasCalendarInvite) {
            await message.forward('calendar@example.com');
            return;
        }

        await message.forward('general@example.com');
    }
};
```

## Wrangler Configuration

```toml
name = "email-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[triggers]
email = ["*@yourdomain.com"]

[[r2_buckets]]
binding = "MY_BUCKET"
bucket_name = "email-attachments"

[[d1_databases]]
binding = "DB"
database_name = "emails"
database_id = "your-database-id"

[vars]
WEBHOOK_URL = "https://hooks.example.com/email"
```

## Error Handling

```javascript
import PostalMime from 'postal-mime';

export default {
    async email(message, env, ctx) {
        try {
            const email = await PostalMime.parse(message.raw);
            // Process email...
        } catch (error) {
            console.error('Failed to parse email:', error);

            // Store raw email for later investigation
            const key = `failed/${Date.now()}-${message.from}`;
            await env.MY_BUCKET.put(key, message.raw);

            // Optionally forward to admin
            await message.forward('admin@example.com');
        }
    }
};
```

## Best Practices

1. **Always handle parsing errors** - Malformed emails are common
2. **Set security limits** - Use stricter limits for untrusted input
3. **Use waitUntil for async operations** - Don't block the response

```javascript
export default {
    async email(message, env, ctx) {
        const email = await PostalMime.parse(message.raw);

        // Use waitUntil for non-critical async operations
        ctx.waitUntil(
            saveToDatabase(email, env.DB)
        );

        // Forward immediately
        await message.forward('inbox@example.com');
    }
};
```

4. **Consider message size** - Cloudflare has a 25MB limit for email messages
5. **Log strategically** - Use console.log for debugging, it appears in Workers logs
