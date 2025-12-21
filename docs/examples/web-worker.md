---
sidebar_position: 2
---

# Web Worker

Use postal-mime in Web Workers for background email processing without blocking the main thread.

## Why Use Web Workers?

- **Non-blocking UI**: Parse large emails without freezing the interface
- **Parallel processing**: Parse multiple emails simultaneously
- **Better performance**: Utilize multiple CPU cores

## Basic Web Worker Setup

### Worker File (email-worker.js)

```javascript
import PostalMime from './node_modules/postal-mime/src/postal-mime.js';

self.onmessage = async function(event) {
    const { id, rawEmail, options } = event.data;

    try {
        const email = await PostalMime.parse(rawEmail, options);

        self.postMessage({
            id,
            success: true,
            email: {
                from: email.from,
                to: email.to,
                subject: email.subject,
                date: email.date,
                text: email.text,
                html: email.html,
                attachments: email.attachments.map(att => ({
                    filename: att.filename,
                    mimeType: att.mimeType,
                    size: att.content.byteLength
                }))
            }
        });
    } catch (error) {
        self.postMessage({
            id,
            success: false,
            error: error.message
        });
    }
};
```

### Main Thread Usage

```javascript
const worker = new Worker('./email-worker.js', { type: 'module' });

let requestId = 0;
const pending = new Map();

worker.onmessage = function(event) {
    const { id, success, email, error } = event.data;
    const resolver = pending.get(id);

    if (resolver) {
        pending.delete(id);
        if (success) {
            resolver.resolve(email);
        } else {
            resolver.reject(new Error(error));
        }
    }
};

function parseEmailInWorker(rawEmail, options = {}) {
    return new Promise((resolve, reject) => {
        const id = ++requestId;
        pending.set(id, { resolve, reject });

        worker.postMessage({
            id,
            rawEmail,
            options
        });
    });
}

// Usage
const email = await parseEmailInWorker(rawEmailData);
console.log('Parsed in worker:', email.subject);
```

## Worker Pool for Parallel Processing

### WorkerPool Class

```javascript
class EmailParserPool {
    constructor(workerCount = navigator.hardwareConcurrency || 4) {
        this.workers = [];
        this.queue = [];
        this.requestId = 0;
        this.pending = new Map();

        for (let i = 0; i < workerCount; i++) {
            this.createWorker();
        }
    }

    createWorker() {
        const worker = new Worker('./email-worker.js', { type: 'module' });

        worker.onmessage = (event) => {
            const { id, success, email, error } = event.data;
            const resolver = this.pending.get(id);

            if (resolver) {
                this.pending.delete(id);
                if (success) {
                    resolver.resolve(email);
                } else {
                    resolver.reject(new Error(error));
                }
            }

            // Process next item in queue
            this.processQueue(worker);
        };

        worker.busy = false;
        this.workers.push(worker);
    }

    processQueue(worker) {
        const task = this.queue.shift();
        if (task) {
            worker.busy = true;
            worker.postMessage(task);
        } else {
            worker.busy = false;
        }
    }

    parse(rawEmail, options = {}) {
        return new Promise((resolve, reject) => {
            const id = ++this.requestId;
            this.pending.set(id, { resolve, reject });

            const task = { id, rawEmail, options };

            // Find available worker
            const availableWorker = this.workers.find(w => !w.busy);
            if (availableWorker) {
                availableWorker.busy = true;
                availableWorker.postMessage(task);
            } else {
                this.queue.push(task);
            }
        });
    }

    async parseMany(emails, options = {}) {
        return Promise.all(
            emails.map(email => this.parse(email, options))
        );
    }

    terminate() {
        this.workers.forEach(worker => worker.terminate());
        this.workers = [];
    }
}

// Usage
const pool = new EmailParserPool(4);

// Parse single email
const email = await pool.parse(rawEmail);

// Parse multiple emails in parallel
const emails = await pool.parseMany([email1, email2, email3, email4]);

// Cleanup when done
pool.terminate();
```

## Handling Attachments

Attachments require special handling when transferring between worker and main thread.

### Transferable Objects

```javascript
// Worker: Transfer attachment ArrayBuffers efficiently
self.onmessage = async function(event) {
    const { id, rawEmail } = event.data;

    const email = await PostalMime.parse(rawEmail);

    // Collect transferable buffers
    const transfers = [];
    const attachments = email.attachments.map(att => {
        if (att.content instanceof ArrayBuffer) {
            transfers.push(att.content);
        }
        return {
            filename: att.filename,
            mimeType: att.mimeType,
            disposition: att.disposition,
            contentId: att.contentId,
            content: att.content
        };
    });

    // Use transferable objects for better performance
    self.postMessage({
        id,
        success: true,
        email: {
            ...email,
            attachments
        }
    }, transfers);
};
```

### Base64 Encoding Alternative

For simpler transfer at slight performance cost:

```javascript
// Worker: Use base64 encoding
self.onmessage = async function(event) {
    const { id, rawEmail } = event.data;

    const email = await PostalMime.parse(rawEmail, {
        attachmentEncoding: 'base64'
    });

    // Attachments are now base64 strings, easily transferable
    self.postMessage({
        id,
        success: true,
        email
    });
};
```

## Progress Reporting

For large emails, report parsing progress:

### Worker with Progress

```javascript
// email-worker.js
import PostalMime from './node_modules/postal-mime/src/postal-mime.js';

self.onmessage = async function(event) {
    const { id, rawEmail, options } = event.data;

    // Report start
    self.postMessage({ id, type: 'progress', stage: 'parsing', percent: 0 });

    try {
        const email = await PostalMime.parse(rawEmail, options);

        self.postMessage({ id, type: 'progress', stage: 'parsing', percent: 50 });

        // Process attachments
        const attachments = [];
        for (let i = 0; i < email.attachments.length; i++) {
            const att = email.attachments[i];
            attachments.push({
                filename: att.filename,
                mimeType: att.mimeType,
                size: att.content.byteLength
            });

            const percent = 50 + (i / email.attachments.length) * 50;
            self.postMessage({
                id,
                type: 'progress',
                stage: 'attachments',
                percent
            });
        }

        self.postMessage({
            id,
            type: 'complete',
            success: true,
            email: {
                from: email.from,
                subject: email.subject,
                attachments
            }
        });
    } catch (error) {
        self.postMessage({
            id,
            type: 'complete',
            success: false,
            error: error.message
        });
    }
};
```

### Main Thread Handler

```javascript
function parseWithProgress(rawEmail, onProgress) {
    return new Promise((resolve, reject) => {
        const worker = new Worker('./email-worker.js', { type: 'module' });
        const id = Date.now();

        worker.onmessage = (event) => {
            const data = event.data;

            if (data.type === 'progress') {
                onProgress?.(data.stage, data.percent);
            } else if (data.type === 'complete') {
                worker.terminate();

                if (data.success) {
                    resolve(data.email);
                } else {
                    reject(new Error(data.error));
                }
            }
        };

        worker.postMessage({ id, rawEmail });
    });
}

// Usage
const email = await parseWithProgress(rawEmail, (stage, percent) => {
    console.log(`${stage}: ${percent.toFixed(0)}%`);
    progressBar.value = percent;
});
```

## TypeScript Worker

### email-worker.ts

```typescript
import PostalMime from './node_modules/postal-mime/src/postal-mime.js';
import type { Email, PostalMimeOptions } from 'postal-mime';

interface WorkerRequest {
    id: number;
    rawEmail: string | ArrayBuffer;
    options?: PostalMimeOptions;
}

interface WorkerResponse {
    id: number;
    success: boolean;
    email?: Email;
    error?: string;
}

self.onmessage = async function(event: MessageEvent<WorkerRequest>) {
    const { id, rawEmail, options } = event.data;

    try {
        const email: Email = await PostalMime.parse(rawEmail, options);

        const response: WorkerResponse = {
            id,
            success: true,
            email
        };

        self.postMessage(response);
    } catch (error) {
        const response: WorkerResponse = {
            id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };

        self.postMessage(response);
    }
};
```

## Using with Bundlers

### Webpack

```javascript
// webpack.config.js
module.exports = {
    module: {
        rules: [
            {
                test: /\.worker\.js$/,
                use: { loader: 'worker-loader' }
            }
        ]
    }
};

// In your code
import EmailWorker from './email.worker.js';
const worker = new EmailWorker();
```

### Vite

```javascript
// Works out of the box with Vite
const worker = new Worker(
    new URL('./email-worker.js', import.meta.url),
    { type: 'module' }
);
```

## Considerations

1. **Structured Clone**: Worker communication uses structured cloning, which handles most data types but not functions or circular references.

2. **Memory**: Each worker has its own memory. For large emails, consider using Transferable objects.

3. **Worker Lifecycle**: Create workers once and reuse them. Creating workers is expensive.

4. **Error Handling**: Always handle worker errors:

```javascript
worker.onerror = (error) => {
    console.error('Worker error:', error);
};
```
