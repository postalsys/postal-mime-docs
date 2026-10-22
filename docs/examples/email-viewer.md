---
title: Email Viewer
sidebar_position: 3
description: Build an email viewer with postal-mime in plain HTML, React, Vue and as a Node.js command line tool, rendering untrusted HTML in a sandboxed iframe.
---

# Email Viewer

<img src="/img/mascot/thinking.png" alt="postal-mime mascot thinking" className="mascot-header" />

These examples open an `.eml` file, show its headers and body, and offer its attachments for download. Every one of them renders the message HTML in an iframe with an empty `sandbox` attribute, which keeps the sender's scripts from running, and replaces `cid:` references to inline images with data URLs. The [live demo](/demo) works the same way.

## Shared helpers

The browser examples use these helpers. Save them as `email-helpers.js`:

```javascript
// email-helpers.js

// A mailbox or a group, as display text
export function formatAddress(addr) {
    if (!addr) {
        return '';
    }
    if (addr.group) {
        return `${addr.name}: ${addr.group.map(formatAddress).join(', ')};`;
    }
    return addr.name ? `${addr.name} <${addr.address}>` : addr.address;
}

// Replace cid: references with data URLs. Needs attachmentEncoding: 'base64'
export function inlineImages(html, attachments) {
    const urls = new Map();
    for (const att of attachments) {
        if (att.related && att.contentId && att.encoding === 'base64') {
            const cid = att.contentId.replace(/^<|>$/g, '').toLowerCase();
            urls.set(cid, `data:${att.mimeType};base64,${att.content}`);
        }
    }
    // Look each reference up rather than building a RegExp from the sender's Content-ID
    return html.replace(/cid:([^"'\s)>]+)/gi, (match, cid) => urls.get(cid.toLowerCase()) || match);
}

// Decode base64 attachment content back into bytes
export function base64ToBytes(base64) {
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

export function downloadAttachment(att) {
    const bytes = att.encoding === 'base64' ? base64ToBytes(att.content) : att.content;
    const url = URL.createObjectURL(new Blob([bytes], { type: att.mimeType }));

    const link = document.createElement('a');
    link.href = url;
    link.download = (att.filename || 'attachment').split(/[/\\]/).pop();
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
```

With `attachmentEncoding: 'base64'`, the decoded size of an attachment is not `content.length`. `base64ToBytes(att.content).length` gives it, or parse with the default encoding where `content.byteLength` does.

## Plain HTML page

Serve this page and `email-helpers.js` from a directory that also contains `node_modules/postal-mime`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Viewer</title>
    <style>
        body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; }
        .drop-zone { border: 2px dashed #ccc; border-radius: 8px; padding: 40px; text-align: center; margin-bottom: 20px; }
        .drop-zone.dragover { border-color: #1976d2; background: #f0f7ff; }
        .header { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .header div { margin-bottom: 6px; }
        .subject { font-size: 1.4em; font-weight: 600; }
        iframe { width: 100%; min-height: 400px; border: 1px solid #ddd; border-radius: 8px; }
        pre { white-space: pre-wrap; border: 1px solid #ddd; border-radius: 8px; padding: 15px; }
        .attachments button { margin: 4px; }
    </style>
</head>
<body>
    <div class="drop-zone" id="dropZone">
        Drop an .eml file here or <input type="file" id="fileInput" accept=".eml,message/rfc822">
    </div>

    <div id="emailContent" hidden>
        <div class="header">
            <div class="subject" id="subject"></div>
            <div>From: <span id="from"></span></div>
            <div>To: <span id="to"></span></div>
            <div>Date: <span id="date"></span></div>
        </div>
        <div id="body"></div>
        <div class="attachments" id="attachments"></div>
    </div>

    <script type="module">
        import PostalMime from './node_modules/postal-mime/dist/esm/postal-mime.js';
        import { formatAddress, inlineImages, downloadAttachment, base64ToBytes, formatSize } from './email-helpers.js';

        async function displayEmail(file) {
            // A File is passed as it is, so the message is read as bytes
            const email = await PostalMime.parse(file, { attachmentEncoding: 'base64' });

            // textContent never interprets markup, so header values need no escaping
            document.getElementById('subject').textContent = email.subject || '(no subject)';
            document.getElementById('from').textContent = formatAddress(email.from);
            document.getElementById('to').textContent = (email.to || []).map(formatAddress).join(', ');
            document.getElementById('date').textContent = email.date ? new Date(email.date).toLocaleString() : '';

            const body = document.getElementById('body');
            body.replaceChildren();
            if (email.html) {
                const iframe = document.createElement('iframe');
                // An empty sandbox blocks scripts, forms and navigation in the message HTML
                iframe.setAttribute('sandbox', '');
                iframe.srcdoc = inlineImages(email.html, email.attachments);
                body.append(iframe);
            } else {
                const pre = document.createElement('pre');
                pre.textContent = email.text || '';
                body.append(pre);
            }

            const list = document.getElementById('attachments');
            list.replaceChildren();
            for (const att of email.attachments.filter(a => !a.related)) {
                const button = document.createElement('button');
                const size = base64ToBytes(att.content).length;
                button.textContent = `${att.filename || 'unnamed'} (${formatSize(size)})`;
                button.addEventListener('click', () => downloadAttachment(att));
                list.append(button);
            }

            document.getElementById('emailContent').hidden = false;
        }

        document.getElementById('fileInput').addEventListener('change', event => {
            const file = event.target.files[0];
            if (file) displayEmail(file);
        });

        const dropZone = document.getElementById('dropZone');
        dropZone.addEventListener('dragover', event => {
            event.preventDefault();
            dropZone.classList.add('dragover');
        });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', event => {
            event.preventDefault();
            dropZone.classList.remove('dragover');
            const file = event.dataTransfer.files[0];
            if (file) displayEmail(file);
        });
    </script>
</body>
</html>
```

## React component

```jsx
import { useState } from 'react';
import PostalMime from 'postal-mime';
import { formatAddress, inlineImages, downloadAttachment } from './email-helpers.js';

export default function EmailViewer() {
    const [email, setEmail] = useState(null);
    const [error, setError] = useState(null);

    async function open(file) {
        setError(null);
        try {
            setEmail(await PostalMime.parse(file, { attachmentEncoding: 'base64' }));
        } catch (err) {
            setError(err.code ? `${err.code}: ${err.message}` : err.message);
        }
    }

    if (error) {
        return <div className="error">Could not parse the message: {error}</div>;
    }

    if (!email) {
        return (
            <div
                className="drop-zone"
                onDragOver={event => event.preventDefault()}
                onDrop={event => {
                    event.preventDefault();
                    if (event.dataTransfer.files[0]) open(event.dataTransfer.files[0]);
                }}
            >
                <p>Drop an .eml file here or select one:</p>
                <input type="file" accept=".eml,message/rfc822" onChange={event => event.target.files[0] && open(event.target.files[0])} />
            </div>
        );
    }

    const files = email.attachments.filter(att => !att.related);

    return (
        <div className="email-viewer">
            <h1>{email.subject || '(no subject)'}</h1>
            <div><strong>From:</strong> {formatAddress(email.from)}</div>
            <div><strong>To:</strong> {(email.to || []).map(formatAddress).join(', ')}</div>
            {email.cc && <div><strong>Cc:</strong> {email.cc.map(formatAddress).join(', ')}</div>}
            <div><strong>Date:</strong> {email.date ? new Date(email.date).toLocaleString() : 'Unknown'}</div>

            {email.html ? (
                <iframe
                    srcDoc={inlineImages(email.html, email.attachments)}
                    sandbox=""
                    title="Message content"
                    style={{ width: '100%', minHeight: '400px', border: 'none' }}
                />
            ) : (
                <pre style={{ whiteSpace: 'pre-wrap' }}>{email.text}</pre>
            )}

            {files.length > 0 && (
                <div className="attachments">
                    <h3>Attachments</h3>
                    {files.map((att, index) => (
                        <button key={index} onClick={() => downloadAttachment(att)}>
                            {att.filename || 'Unnamed'} ({att.mimeType})
                        </button>
                    ))}
                </div>
            )}

            <button onClick={() => setEmail(null)}>Open another message</button>
        </div>
    );
}
```

React escapes the text it renders, so the headers and the plain text body are safe to show as they are.

## Vue component

```vue
<template>
    <div class="email-viewer">
        <div v-if="error" class="error">Could not parse the message: {{ error }}</div>

        <div v-else-if="!email" class="drop-zone" @drop.prevent="handleDrop" @dragover.prevent>
            <p>Drop an .eml file here or select one:</p>
            <input type="file" accept=".eml,message/rfc822" @change="handleFileChange" />
        </div>

        <div v-else>
            <h1>{{ email.subject || '(no subject)' }}</h1>
            <div><strong>From:</strong> {{ formatAddress(email.from) }}</div>
            <div><strong>To:</strong> {{ (email.to || []).map(formatAddress).join(', ') }}</div>
            <div v-if="email.date"><strong>Date:</strong> {{ new Date(email.date).toLocaleString() }}</div>

            <iframe
                v-if="email.html"
                :srcdoc="processedHtml"
                sandbox=""
                title="Message content"
                style="width: 100%; min-height: 400px; border: none"
            />
            <pre v-else style="white-space: pre-wrap">{{ email.text }}</pre>

            <div v-if="files.length" class="attachments">
                <h3>Attachments</h3>
                <button v-for="(att, index) in files" :key="index" @click="downloadAttachment(att)">
                    {{ att.filename || 'Unnamed' }} ({{ att.mimeType }})
                </button>
            </div>

            <button @click="email = null">Open another message</button>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import PostalMime from 'postal-mime';
import { formatAddress, inlineImages, downloadAttachment } from './email-helpers.js';

const email = ref(null);
const error = ref(null);

const files = computed(() => email.value?.attachments.filter(att => !att.related) || []);
const processedHtml = computed(() => (email.value?.html ? inlineImages(email.value.html, email.value.attachments) : ''));

async function open(file) {
    error.value = null;
    try {
        email.value = await PostalMime.parse(file, { attachmentEncoding: 'base64' });
    } catch (err) {
        error.value = err.code ? `${err.code}: ${err.message}` : err.message;
    }
}

function handleFileChange(event) {
    if (event.target.files[0]) open(event.target.files[0]);
}

function handleDrop(event) {
    if (event.dataTransfer.files[0]) open(event.dataTransfer.files[0]);
}
</script>
```

## Node.js command line viewer

Prints a message and, optionally, saves its attachments. The attachment names come from the sender, so they are reduced to safe base names before they are joined with the output directory:

```javascript
#!/usr/bin/env node
// email-viewer.mjs
import PostalMime from 'postal-mime';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

function formatAddress(addr) {
    if (!addr) return '';
    if (addr.group) return `${addr.name}: ${addr.group.map(formatAddress).join(', ')};`;
    return addr.name ? `${addr.name} <${addr.address}>` : addr.address;
}

function safeFilename(filename, index) {
    const name = basename(String(filename || '').replace(/\\/g, '/'))
        .replace(/[^\w.-]/g, '_')
        .replace(/^\.+/, '');
    return `${index}-${name || 'attachment'}`;
}

async function viewEmail(filepath, outputDir) {
    const email = await PostalMime.parse(await readFile(filepath));

    console.log('='.repeat(60));
    console.log('Subject:', email.subject || '(no subject)');
    console.log('From:   ', formatAddress(email.from));
    console.log('To:     ', (email.to || []).map(formatAddress).join(', '));
    console.log('Date:   ', email.date || 'unknown');
    console.log('='.repeat(60));

    console.log(email.text ?? '(no plain text body)');

    if (email.attachments.length) {
        console.log('\nAttachments:');
        if (outputDir) {
            await mkdir(outputDir, { recursive: true });
        }
        for (const [index, att] of email.attachments.entries()) {
            console.log(`  - ${JSON.stringify(att.filename)} (${att.mimeType}, ${att.content.byteLength} bytes)`);
            if (outputDir) {
                const target = join(outputDir, safeFilename(att.filename, index));
                await writeFile(target, new Uint8Array(att.content));
                console.log(`    saved to ${target}`);
            }
        }
    }
}

const [, , filepath, outputDir] = process.argv;

if (!filepath) {
    console.log('Usage: node email-viewer.mjs <file.eml> [output-dir]');
    process.exit(1);
}

viewEmail(filepath, outputDir).catch(err => {
    console.error('Error:', err.code || '', err.message);
    process.exit(1);
});
```

```bash
node email-viewer.mjs message.eml ./attachments
```

The file name is printed with `JSON.stringify()`, which shows control characters as escapes instead of sending them to the terminal.

## See Also

- [Security](../guides/security#5-sanitize-html-content) - Why the HTML goes into a sandboxed iframe
- [Working with Attachments](../guides/working-with-attachments) - Inline images, downloads and saving files
- [Web Worker example](./web-worker) - Parsing off the main thread
- [Live Demo](/demo) - A working viewer in the browser
