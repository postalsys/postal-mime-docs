---
title: Web Worker
sidebar_position: 2
description: Parse emails with postal-mime in a Web Worker so large messages do not block the page, with a worker pool and zero-copy transfer of attachments.
---

# Web Worker

<img src="/img/mascot/routing.png" alt="postal-mime mascot routing" className="mascot-header" />

Parsing runs on the thread that calls it. A large message, or many messages, can keep the main thread busy long enough to freeze a page, so a browser application can move parsing into a Web Worker. postal-mime needs nothing but `TextDecoder`, `Blob` and `ReadableStream`, which workers have.

## A parsing worker

`email-worker.js` parses each message it receives and sends the result back. The result of `PostalMime.parse()` is plain data, so it survives the structured clone that `postMessage()` performs.

```javascript
// email-worker.js
import PostalMime from './node_modules/postal-mime/dist/esm/postal-mime.js';

self.onmessage = async event => {
    const { id, rawEmail, options } = event.data;

    try {
        const email = await PostalMime.parse(rawEmail, options);

        // Move the attachment buffers to the main thread instead of copying them
        const transfer = email.attachments
            .map(att => (att.content instanceof Uint8Array ? att.content.buffer : att.content))
            .filter(content => content instanceof ArrayBuffer);

        self.postMessage({ id, email }, transfer);
    } catch (error) {
        // An Error is cloned without its code property, so send the code along
        self.postMessage({ id, error: { message: error.message, code: error.code } });
    }
};
```

The import loads the ES module build straight from `node_modules`, which works without a build step when the page serves that directory. When the worker is bundled, import from `'postal-mime'` instead, see [Bundlers](#bundlers).

Each attachment has its own buffer, so every buffer can be listed in the transfer list once. After the transfer, the buffers belong to the main thread.

## Calling the worker

```javascript
// main.js
const worker = new Worker('./email-worker.js', { type: 'module' });

let nextId = 0;
const pending = new Map();

worker.onmessage = event => {
    const { id, email, error } = event.data;
    const request = pending.get(id);
    if (!request) {
        return;
    }
    pending.delete(id);

    if (error) {
        request.reject(Object.assign(new Error(error.message), { code: error.code }));
    } else {
        request.resolve(email);
    }
};

worker.onerror = event => {
    console.error('Worker failed:', event.message);
};

export function parseInWorker(rawEmail, options = {}) {
    return new Promise((resolve, reject) => {
        const id = ++nextId;
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, rawEmail, options });
    });
}
```

```javascript
// Usage, for example with a File from an <input type="file">
import { parseInWorker } from './main.js';

document.querySelector('input[type="file"]').addEventListener('change', async event => {
    const email = await parseInWorker(event.target.files[0]);
    console.log(email.subject);
});
```

A `File` or `Blob` can be posted to a worker as it is, without reading it on the main thread first. A string, an `ArrayBuffer` or a `Uint8Array` work too; pass an `ArrayBuffer` in the transfer list of `postMessage()` to move it instead of copying it.

## A worker pool

To parse many messages at once, spread them over several workers. This pool sends each job to an idle worker, or queues it until one is free:

```javascript
// email-parser-pool.js
export class EmailParserPool {
    constructor(size = navigator.hardwareConcurrency || 4) {
        this.queue = [];
        this.pending = new Map();
        this.nextId = 0;
        this.idle = [];
        this.workers = Array.from({ length: size }, () => this.createWorker());
    }

    createWorker() {
        const worker = new Worker('./email-worker.js', { type: 'module' });

        worker.onmessage = event => {
            const { id, email, error } = event.data;
            const request = this.pending.get(id);
            this.pending.delete(id);

            if (error) {
                request.reject(Object.assign(new Error(error.message), { code: error.code }));
            } else {
                request.resolve(email);
            }
            this.release(worker);
        };

        this.idle.push(worker);
        return worker;
    }

    release(worker) {
        const job = this.queue.shift();
        if (job) {
            worker.postMessage(job);
        } else {
            this.idle.push(worker);
        }
    }

    parse(rawEmail, options = {}) {
        return new Promise((resolve, reject) => {
            const job = { id: ++this.nextId, rawEmail, options };
            this.pending.set(job.id, { resolve, reject });

            const worker = this.idle.pop();
            if (worker) {
                worker.postMessage(job);
            } else {
                this.queue.push(job);
            }
        });
    }

    terminate() {
        for (const worker of this.workers) {
            worker.terminate();
        }
        this.workers = [];
        this.idle = [];
    }
}
```

```javascript
import { EmailParserPool } from './email-parser-pool.js';

const pool = new EmailParserPool(4);

document.querySelector('input[type="file"][multiple]').addEventListener('change', async event => {
    const emails = await Promise.all([...event.target.files].map(file => pool.parse(file)));
    console.log(emails.map(email => email.subject));
});
```

Creating a worker costs time and memory, so create the pool once and reuse it.

## TypeScript

```typescript
// email-worker.ts
import PostalMime from 'postal-mime';
import type { Email, PostalMimeOptions, RawEmail } from 'postal-mime';

export type WorkerRequest = { id: number; rawEmail: RawEmail; options?: PostalMimeOptions };
export type WorkerResponse =
    | { id: number; email: Email; error?: undefined }
    | { id: number; email?: undefined; error: { message: string; code?: string } };

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
    const { id, rawEmail, options } = event.data;

    try {
        const email = await PostalMime.parse(rawEmail, options);
        const transfer = email.attachments
            .map(att => (att.content instanceof Uint8Array ? att.content.buffer : att.content))
            .filter((content): content is ArrayBuffer => content instanceof ArrayBuffer);

        self.postMessage({ id, email } satisfies WorkerResponse, { transfer });
    } catch (err) {
        const { message, code } = err as Error & { code?: string };
        self.postMessage({ id, error: { message, code } } satisfies WorkerResponse);
    }
};
```

Compile the worker with the `webworker` library in `lib`, so that `self` has the worker type.

## Bundlers

Webpack 5 and Vite both bundle a module worker that is created from a `new URL()` relative to the current module, with no plugin or loader. In a bundled worker, import `postal-mime` by name:

```javascript
const worker = new Worker(new URL('./email-worker.js', import.meta.url), { type: 'module' });
```

## Considerations

- **Memory.** Each worker holds the messages it parses. Transfer attachment buffers instead of copying them, and drop references to parsed messages you no longer need.
- **Untrusted HTML.** Moving the parse into a worker does not make `html` safe. Render it in a sandboxed iframe or sanitize it, see the [Security guide](../guides/security#5-sanitize-html-content).
- **Errors.** The structured clone keeps an error's `message` but drops custom properties such as `code`, which is why the worker above sends the code explicitly.

## See Also

- [Email Viewer example](./email-viewer) - Showing a parsed message in a page
- [Parsing Emails](../guides/parsing-emails) - Input types the parser accepts
- [Errors](../api/errors) - The codes to send back from a worker
- [Installation](../getting-started/installation#browsers-without-a-bundler) - Loading postal-mime without a bundler
