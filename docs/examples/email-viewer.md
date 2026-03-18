---
sidebar_position: 3
---

# Email Viewer

<img src="/img/mascot/thinking.png" alt="postal-mime mascot thinking" className="mascot-header" />

Build a complete email viewer application using postal-mime.

## Simple Email Viewer

A basic email viewer that displays parsed email content.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Viewer</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; }
        .email-header { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .email-field { margin-bottom: 8px; }
        .email-field label { font-weight: 600; display: inline-block; width: 80px; }
        .email-subject { font-size: 1.5em; font-weight: 600; margin-bottom: 15px; }
        .email-body { padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        .attachments { margin-top: 20px; }
        .attachment { display: inline-flex; align-items: center; background: #e8e8e8; padding: 8px 12px; border-radius: 4px; margin: 4px; cursor: pointer; }
        .attachment:hover { background: #d8d8d8; }
        .drop-zone { border: 2px dashed #ccc; border-radius: 8px; padding: 40px; text-align: center; margin-bottom: 20px; }
        .drop-zone.dragover { border-color: #007bff; background: #f0f7ff; }
    </style>
</head>
<body>
    <div class="drop-zone" id="dropZone">
        <p>Drop an .eml file here or <input type="file" id="fileInput" accept=".eml"></p>
    </div>

    <div id="emailContent" style="display: none;">
        <div class="email-header">
            <div class="email-subject" id="subject"></div>
            <div class="email-field"><label>From:</label> <span id="from"></span></div>
            <div class="email-field"><label>To:</label> <span id="to"></span></div>
            <div class="email-field"><label>Date:</label> <span id="date"></span></div>
        </div>

        <div class="email-body" id="body"></div>

        <div class="attachments" id="attachments"></div>
    </div>

    <script type="module">
        import PostalMime from './node_modules/postal-mime/src/postal-mime.js';

        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');
        const emailContent = document.getElementById('emailContent');

        async function displayEmail(rawEmail) {
            const email = await PostalMime.parse(rawEmail);

            document.getElementById('subject').textContent = email.subject || '(no subject)';
            document.getElementById('from').textContent = formatAddress(email.from);
            document.getElementById('to').textContent = email.to?.map(formatAddress).join(', ') || '';
            document.getElementById('date').textContent = email.date
                ? new Date(email.date).toLocaleString()
                : '';

            // Display body
            const bodyEl = document.getElementById('body');
            if (email.html) {
                // Create iframe for safe HTML rendering
                const iframe = document.createElement('iframe');
                iframe.style.width = '100%';
                iframe.style.border = 'none';
                iframe.style.minHeight = '400px';
                bodyEl.innerHTML = '';
                bodyEl.appendChild(iframe);

                // Replace CID references with data URLs
                let html = email.html;
                email.attachments.filter(a => a.related).forEach(att => {
                    if (att.contentId) {
                        const cid = att.contentId.replace(/^<|>$/g, '');
                        const dataUrl = arrayBufferToDataUrl(att.content, att.mimeType);
                        html = html.replace(new RegExp(`cid:${cid}`, 'gi'), dataUrl);
                    }
                });

                iframe.srcdoc = html;
            } else {
                bodyEl.innerHTML = `<pre style="white-space: pre-wrap;">${escapeHtml(email.text || '')}</pre>`;
            }

            // Display attachments
            const attachmentsEl = document.getElementById('attachments');
            const regularAttachments = email.attachments.filter(a => !a.related);

            if (regularAttachments.length) {
                attachmentsEl.innerHTML = '<h3>Attachments</h3>';
                regularAttachments.forEach(att => {
                    const el = document.createElement('div');
                    el.className = 'attachment';
                    el.textContent = `${att.filename || 'unnamed'} (${formatSize(att.content.byteLength)})`;
                    el.onclick = () => downloadAttachment(att);
                    attachmentsEl.appendChild(el);
                });
            } else {
                attachmentsEl.innerHTML = '';
            }

            emailContent.style.display = 'block';
        }

        function formatAddress(addr) {
            if (!addr) return '';
            if (addr.name) return `${addr.name} <${addr.address}>`;
            return addr.address;
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function arrayBufferToDataUrl(buffer, mimeType) {
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return `data:${mimeType};base64,${btoa(binary)}`;
        }

        function formatSize(bytes) {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / 1024 / 1024).toFixed(1) + ' MB';
        }

        function downloadAttachment(att) {
            const blob = new Blob([att.content], { type: att.mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = att.filename || 'attachment';
            a.click();
            URL.revokeObjectURL(url);
        }

        // File input handler
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                const text = await file.text();
                await displayEmail(text);
            }
        });

        // Drag and drop handlers
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');

            const file = e.dataTransfer.files[0];
            if (file) {
                const text = await file.text();
                await displayEmail(text);
            }
        });
    </script>
</body>
</html>
```

## React Email Viewer Component

```jsx
import React, { useState, useCallback } from 'react';
import PostalMime from 'postal-mime';

function EmailViewer() {
    const [email, setEmail] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const parseEmail = useCallback(async (rawEmail) => {
        setLoading(true);
        setError(null);

        try {
            const parsed = await PostalMime.parse(rawEmail, {
                attachmentEncoding: 'base64'
            });
            setEmail(parsed);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (file) {
            const text = await file.text();
            await parseEmail(text);
        }
    };

    const handleDrop = async (event) => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file) {
            const text = await file.text();
            await parseEmail(text);
        }
    };

    const formatAddress = (addr) => {
        if (!addr) return null;
        return addr.name ? `${addr.name} <${addr.address}>` : addr.address;
    };

    const downloadAttachment = (attachment) => {
        const binary = atob(attachment.content);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: attachment.mimeType });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = attachment.filename || 'attachment';
        a.click();

        URL.revokeObjectURL(url);
    };

    if (loading) {
        return <div className="loading">Parsing email...</div>;
    }

    if (error) {
        return <div className="error">Error: {error}</div>;
    }

    if (!email) {
        return (
            <div
                className="drop-zone"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
            >
                <p>Drop an .eml file here or select one:</p>
                <input type="file" accept=".eml" onChange={handleFileChange} />
            </div>
        );
    }

    return (
        <div className="email-viewer">
            <div className="email-header">
                <h1 className="subject">{email.subject || '(no subject)'}</h1>

                <div className="meta">
                    <div><strong>From:</strong> {formatAddress(email.from)}</div>
                    <div>
                        <strong>To:</strong>{' '}
                        {email.to?.map(formatAddress).join(', ')}
                    </div>
                    {email.cc?.length > 0 && (
                        <div>
                            <strong>CC:</strong>{' '}
                            {email.cc.map(formatAddress).join(', ')}
                        </div>
                    )}
                    <div>
                        <strong>Date:</strong>{' '}
                        {email.date ? new Date(email.date).toLocaleString() : 'Unknown'}
                    </div>
                </div>
            </div>

            <div className="email-body">
                {email.html ? (
                    <iframe
                        srcDoc={replaceInlineImages(email.html, email.attachments)}
                        title="Email content"
                        style={{ width: '100%', minHeight: '400px', border: 'none' }}
                    />
                ) : (
                    <pre>{email.text}</pre>
                )}
            </div>

            {email.attachments.filter(a => !a.related).length > 0 && (
                <div className="attachments">
                    <h3>Attachments</h3>
                    {email.attachments
                        .filter(a => !a.related)
                        .map((att, index) => (
                            <button
                                key={index}
                                onClick={() => downloadAttachment(att)}
                                className="attachment-button"
                            >
                                {att.filename || 'Unnamed'} ({att.mimeType})
                            </button>
                        ))}
                </div>
            )}

            <button onClick={() => setEmail(null)}>Load Another Email</button>
        </div>
    );
}

function replaceInlineImages(html, attachments) {
    let result = html;

    attachments.filter(a => a.related && a.contentId).forEach(att => {
        const cid = att.contentId.replace(/^<|>$/g, '');
        const dataUrl = `data:${att.mimeType};base64,${att.content}`;
        result = result.replace(new RegExp(`cid:${cid}`, 'gi'), dataUrl);
    });

    return result;
}

export default EmailViewer;
```

## Vue Email Viewer Component

```vue
<template>
    <div class="email-viewer">
        <div v-if="loading" class="loading">Parsing email...</div>

        <div v-else-if="error" class="error">Error: {{ error }}</div>

        <div
            v-else-if="!email"
            class="drop-zone"
            @drop.prevent="handleDrop"
            @dragover.prevent
        >
            <p>Drop an .eml file here or select one:</p>
            <input type="file" accept=".eml" @change="handleFileChange" />
        </div>

        <div v-else class="email-content">
            <div class="email-header">
                <h1>{{ email.subject || '(no subject)' }}</h1>
                <div><strong>From:</strong> {{ formatAddress(email.from) }}</div>
                <div>
                    <strong>To:</strong>
                    {{ email.to?.map(formatAddress).join(', ') }}
                </div>
                <div v-if="email.date">
                    <strong>Date:</strong> {{ formatDate(email.date) }}
                </div>
            </div>

            <div class="email-body">
                <iframe
                    v-if="email.html"
                    :srcdoc="processedHtml"
                    style="width: 100%; min-height: 400px; border: none;"
                />
                <pre v-else>{{ email.text }}</pre>
            </div>

            <div v-if="regularAttachments.length" class="attachments">
                <h3>Attachments</h3>
                <button
                    v-for="(att, index) in regularAttachments"
                    :key="index"
                    @click="downloadAttachment(att)"
                >
                    {{ att.filename || 'Unnamed' }} ({{ att.mimeType }})
                </button>
            </div>

            <button @click="email = null">Load Another Email</button>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import PostalMime from 'postal-mime';

const email = ref(null);
const loading = ref(false);
const error = ref(null);

const regularAttachments = computed(() =>
    email.value?.attachments.filter(a => !a.related) || []
);

const processedHtml = computed(() => {
    if (!email.value?.html) return '';

    let html = email.value.html;
    email.value.attachments.filter(a => a.related && a.contentId).forEach(att => {
        const cid = att.contentId.replace(/^<|>$/g, '');
        const dataUrl = `data:${att.mimeType};base64,${att.content}`;
        html = html.replace(new RegExp(`cid:${cid}`, 'gi'), dataUrl);
    });

    return html;
});

async function parseEmail(rawEmail) {
    loading.value = true;
    error.value = null;

    try {
        email.value = await PostalMime.parse(rawEmail, {
            attachmentEncoding: 'base64'
        });
    } catch (err) {
        error.value = err.message;
    } finally {
        loading.value = false;
    }
}

async function handleFileChange(event) {
    const file = event.target.files[0];
    if (file) {
        const text = await file.text();
        await parseEmail(text);
    }
}

async function handleDrop(event) {
    const file = event.dataTransfer.files[0];
    if (file) {
        const text = await file.text();
        await parseEmail(text);
    }
}

function formatAddress(addr) {
    if (!addr) return '';
    return addr.name ? `${addr.name} <${addr.address}>` : addr.address;
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleString();
}

function downloadAttachment(att) {
    const binary = atob(att.content);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: att.mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = att.filename || 'attachment';
    a.click();

    URL.revokeObjectURL(url);
}
</script>
```

## Node.js CLI Email Viewer

```javascript
#!/usr/bin/env node

import PostalMime from 'postal-mime';
import { readFile } from 'fs/promises';
import { createWriteStream } from 'fs';
import { join } from 'path';

async function viewEmail(filepath, outputDir) {
    const buffer = await readFile(filepath);
    const email = await PostalMime.parse(buffer);

    console.log('='.repeat(60));
    console.log('Subject:', email.subject || '(no subject)');
    console.log('From:', formatAddress(email.from));
    console.log('To:', email.to?.map(formatAddress).join(', ') || '');
    console.log('Date:', email.date || 'Unknown');
    console.log('='.repeat(60));

    if (email.text) {
        console.log('\n--- Plain Text ---\n');
        console.log(email.text);
    }

    if (email.html) {
        console.log('\n--- HTML available (use --html to save) ---');
    }

    if (email.attachments.length > 0) {
        console.log('\n--- Attachments ---');

        for (const att of email.attachments) {
            const filename = att.filename || 'unnamed';
            console.log(`  - ${filename} (${att.mimeType}, ${att.content.byteLength} bytes)`);

            if (outputDir) {
                const filepath = join(outputDir, filename);
                const stream = createWriteStream(filepath);
                stream.write(Buffer.from(att.content));
                stream.end();
                console.log(`    Saved to: ${filepath}`);
            }
        }
    }
}

function formatAddress(addr) {
    if (!addr) return '';
    return addr.name ? `${addr.name} <${addr.address}>` : addr.address;
}

// Run from command line
const [,, filepath, outputDir] = process.argv;

if (!filepath) {
    console.log('Usage: email-viewer <file.eml> [output-dir]');
    process.exit(1);
}

viewEmail(filepath, outputDir).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
```

Usage:
```bash
node email-viewer.js message.eml ./attachments
```
