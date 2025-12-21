import type {ReactNode} from 'react';
import {useState, useRef, useCallback} from 'react';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './demo.module.css';

interface EmailAddress {
  name: string;
  address: string;
}

interface Attachment {
  filename: string | null;
  mimeType: string;
  disposition: string | null;
  related?: boolean;
  contentId?: string;
  content: ArrayBuffer;
}

interface ParsedEmail {
  subject?: string;
  from?: EmailAddress;
  to?: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  date?: string;
  messageId?: string;
  html?: string;
  text?: string;
  attachments: Attachment[];
}

function formatAddress(addr: EmailAddress): string {
  if (addr.name) {
    return `${addr.name} <${addr.address}>`;
  }
  return addr.address;
}

function formatAddressList(addresses: EmailAddress[] | undefined): string {
  if (!addresses || addresses.length === 0) return '';
  return addresses.map(formatAddress).join(', ');
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleString();
  } catch {
    return dateStr;
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function processHtmlWithAttachments(html: string, attachments: Attachment[]): string {
  let processedHtml = html;

  // Create a map of content IDs to data URIs
  const cidMap = new Map<string, string>();

  for (const att of attachments) {
    // Handle CID references (for multipart/related inline images)
    if (att.contentId) {
      const cid = att.contentId.replace(/^<|>$/g, '');
      const base64 = arrayBufferToBase64(att.content);
      const dataUri = `data:${att.mimeType};base64,${base64}`;
      cidMap.set(cid, dataUri);
    }
  }

  // Replace cid: references
  for (const [cid, dataUri] of cidMap) {
    const cidPattern = new RegExp(`cid:${cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
    processedHtml = processedHtml.replace(cidPattern, dataUri);
  }

  // Also handle inline images that might be referenced differently
  // Some emails embed images with src="" that need to be matched by filename
  for (const att of attachments) {
    if (att.disposition === 'inline' && att.mimeType.startsWith('image/') && att.filename) {
      const base64 = arrayBufferToBase64(att.content);
      const dataUri = `data:${att.mimeType};base64,${base64}`;
      // Replace any src references to this filename
      const filenamePattern = new RegExp(`src=["']${att.filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'gi');
      processedHtml = processedHtml.replace(filenamePattern, `src="${dataUri}"`);
    }
  }

  return processedHtml;
}

function downloadAttachment(attachment: Attachment): void {
  const blob = new Blob([attachment.content], {type: attachment.mimeType});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = attachment.filename || 'attachment';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getAttachmentIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return '🗜️';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.startsWith('text/')) return '📃';
  return '📎';
}

function buildIframeSrcdoc(html: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 16px;
      line-height: 1.5;
    }
    img { max-width: 100%; height: auto; }
    pre { white-space: pre-wrap; word-wrap: break-word; }
  </style>
</head>
<body>${html}</body>
</html>`;
}

export default function Demo(): ReactNode {
  const [email, setEmail] = useState<ParsedEmail | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setEmail(null);
    setHtmlContent(null);
    setFileName(file.name);

    try {
      // Dynamically import postal-mime
      const PostalMime = (await import('postal-mime')).default;

      const arrayBuffer = await file.arrayBuffer();
      const parsed = await PostalMime.parse(arrayBuffer);

      setEmail(parsed as ParsedEmail);

      // Process HTML content with inline images
      if (parsed.html) {
        const processedHtml = processHtmlWithAttachments(
          parsed.html,
          (parsed.attachments || []) as Attachment[]
        );
        setHtmlContent(buildIframeSrcdoc(processedHtml));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse email');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && fileInputRef.current) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInputRef.current.files = dataTransfer.files;
      fileInputRef.current.dispatchEvent(new Event('change', {bubbles: true}));
    }
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
  }, []);

  const nonInlineAttachments = email?.attachments.filter(
    att => att.disposition !== 'inline' || !att.mimeType.startsWith('image/')
  ) || [];

  const inlineImages = email?.attachments.filter(
    att => att.disposition === 'inline' && att.mimeType.startsWith('image/') && !att.contentId
  ) || [];

  return (
    <Layout
      title="Live Demo"
      description="Try postal-mime in your browser. Parse .eml files and see the results instantly.">
      <main className={styles.main}>
        <div className="container">
          <Heading as="h1" className={styles.title}>
            Live Demo
          </Heading>
          <p className={styles.subtitle}>
            Parse email files directly in your browser. Your data never leaves your computer.
          </p>

          <div
            className={styles.dropZone}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".eml,.msg,message/rfc822"
              onChange={handleFileSelect}
              className={styles.fileInput}
              id="file-input"
            />
            <label htmlFor="file-input" className={styles.dropLabel}>
              <span className={styles.dropIcon}>📧</span>
              <span className={styles.dropText}>
                {loading ? 'Parsing...' : 'Drop an .eml file here or click to select'}
              </span>
              {fileName && <span className={styles.fileName}>{fileName}</span>}
            </label>
          </div>

          {error && (
            <div className={styles.error}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {email && (
            <div className={styles.results}>
              <section className={styles.section}>
                <Heading as="h2" className={styles.sectionTitle}>
                  Message Headers
                </Heading>
                <div className={styles.headers}>
                  {email.subject && (
                    <div className={styles.headerRow}>
                      <span className={styles.headerLabel}>Subject:</span>
                      <span className={styles.headerValue}>{email.subject}</span>
                    </div>
                  )}
                  {email.from && (
                    <div className={styles.headerRow}>
                      <span className={styles.headerLabel}>From:</span>
                      <span className={styles.headerValue}>{formatAddress(email.from)}</span>
                    </div>
                  )}
                  {email.to && email.to.length > 0 && (
                    <div className={styles.headerRow}>
                      <span className={styles.headerLabel}>To:</span>
                      <span className={styles.headerValue}>{formatAddressList(email.to)}</span>
                    </div>
                  )}
                  {email.cc && email.cc.length > 0 && (
                    <div className={styles.headerRow}>
                      <span className={styles.headerLabel}>Cc:</span>
                      <span className={styles.headerValue}>{formatAddressList(email.cc)}</span>
                    </div>
                  )}
                  {email.bcc && email.bcc.length > 0 && (
                    <div className={styles.headerRow}>
                      <span className={styles.headerLabel}>Bcc:</span>
                      <span className={styles.headerValue}>{formatAddressList(email.bcc)}</span>
                    </div>
                  )}
                  {email.date && (
                    <div className={styles.headerRow}>
                      <span className={styles.headerLabel}>Date:</span>
                      <span className={styles.headerValue}>{formatDate(email.date)}</span>
                    </div>
                  )}
                  {email.messageId && (
                    <div className={styles.headerRow}>
                      <span className={styles.headerLabel}>Message-ID:</span>
                      <span className={styles.headerValueMono}>{email.messageId}</span>
                    </div>
                  )}
                </div>
              </section>

              {nonInlineAttachments.length > 0 && (
                <section className={styles.section}>
                  <Heading as="h2" className={styles.sectionTitle}>
                    Attachments ({nonInlineAttachments.length})
                  </Heading>
                  <div className={styles.attachments}>
                    {nonInlineAttachments.map((att, index) => (
                      <button
                        key={index}
                        className={styles.attachment}
                        onClick={() => downloadAttachment(att)}
                        title={`Download ${att.filename || 'attachment'}`}
                      >
                        <span className={styles.attachmentIcon}>
                          {getAttachmentIcon(att.mimeType)}
                        </span>
                        <div className={styles.attachmentInfo}>
                          <span className={styles.attachmentName}>
                            {att.filename || 'Unnamed attachment'}
                          </span>
                          <span className={styles.attachmentMeta}>
                            {att.mimeType} - {formatFileSize(att.content.byteLength)}
                          </span>
                        </div>
                        <span className={styles.downloadIcon}>⬇️</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {(email.html || email.text || inlineImages.length > 0) && (
                <section className={styles.section}>
                  <Heading as="h2" className={styles.sectionTitle}>
                    Message Content
                  </Heading>

                  {inlineImages.length > 0 && (
                    <div className={styles.inlineImages}>
                      {inlineImages.map((img, index) => {
                        const base64 = arrayBufferToBase64(img.content);
                        const dataUri = `data:${img.mimeType};base64,${base64}`;
                        return (
                          <div key={index} className={styles.inlineImage}>
                            <img
                              src={dataUri}
                              alt={img.filename || `Inline image ${index + 1}`}
                            />
                            {img.filename && (
                              <span className={styles.inlineImageName}>{img.filename}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {htmlContent ? (
                    <div className={styles.contentFrame}>
                      <iframe
                        className={styles.iframe}
                        title="Email content"
                        sandbox=""
                        srcDoc={htmlContent}
                      />
                    </div>
                  ) : email.text ? (
                    <div className={styles.textContent}>
                      <pre>{email.text}</pre>
                    </div>
                  ) : null}
                </section>
              )}
            </div>
          )}

          <div className={styles.privacy}>
            <span className={styles.privacyIcon}>🔒</span>
            <span>All parsing happens locally in your browser. Your emails are never uploaded to any server.</span>
          </div>
        </div>
      </main>
    </Layout>
  );
}
