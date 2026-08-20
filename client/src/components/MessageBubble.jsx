import React, { useState } from 'react';
import { Check, CheckCheck, FileText, Download, FileArchive, Video, X, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useToast } from '@/hooks/use-toast';

const token = () => localStorage.getItem('token') || '';

// Build an authenticated URL for inline media (image/video)
const authUrl = (fileId, mode = 'view') =>
  `/api/files/${fileId}/${mode}?token=${encodeURIComponent(token())}`;

// Icon for file type
function FileIcon({ mimeType, size = 24 }) {
  if (mimeType?.startsWith('video/')) return <Video size={size} />;
  if (mimeType?.includes('zip') || mimeType?.includes('rar') || mimeType?.includes('7z'))
    return <FileArchive size={size} />;
  return <FileText size={size} />;
}

// Lightbox for full-size image preview
function ImageLightbox({ src, alt, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/80"
        onClick={onClose}
      >
        <X size={20} />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-[90vh] rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export default function MessageBubble({ message, isMine }) {
  const [lightbox, setLightbox] = useState(false);
  const { toast } = useToast();
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const renderContent = () => {
    if (message.type === 'text') {
      return <p className="text-[15px] whitespace-pre-wrap break-words">{message.content}</p>;
    }

    let fileData;
    try {
      fileData = JSON.parse(message.content);
    } catch {
      return <p className="text-sm italic text-destructive">Error loading attachment</p>;
    }

    if (!fileData?.fileId && message.type !== 'code') {
      return <p className="text-sm italic text-destructive">Attachment unavailable</p>;
    }

    // ── Code Snippet ───────────────────────────────────────────────────
    if (message.type === 'code') {
      const handleCopy = () => {
        navigator.clipboard.writeText(fileData.code);
        toast({ title: 'Code copied to clipboard!' });
      };
      return (
        <div className="relative group max-w-full overflow-hidden rounded-md bg-[#1E1E1E] border border-border">
          <div className="flex items-center justify-between px-3 py-1 bg-black/40 border-b border-white/10 text-xs text-muted-foreground">
            <span>{fileData.language}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-white"
              onClick={handleCopy}
              title="Copy code"
            >
              <Copy size={14} />
            </Button>
          </div>
          <div className="overflow-x-auto text-sm max-h-[400px]">
            <SyntaxHighlighter
              language={fileData.language}
              style={vscDarkPlus}
              customStyle={{ margin: 0, padding: '1rem', background: 'transparent' }}
            >
              {fileData.code}
            </SyntaxHighlighter>
          </div>
        </div>
      );
    }

    // ── Image ──────────────────────────────────────────────────────────
    if (message.type === 'image') {
      const viewSrc = authUrl(fileData.fileId, 'view');
      const dlHref = authUrl(fileData.fileId, 'download');
      return (
        <>
          {lightbox && (
            <ImageLightbox
              src={viewSrc}
              alt={fileData.filename}
              onClose={() => setLightbox(false)}
            />
          )}
          <div className="max-w-[280px] sm:max-w-[320px] rounded overflow-hidden group relative">
            <img
              src={viewSrc}
              alt={fileData.filename}
              className="w-full h-auto object-cover max-h-[300px] cursor-pointer"
              onClick={() => setLightbox(true)}
              onError={(e) => {
                e.target.onerror = null;
                e.target.style.display = 'none';
                e.target.nextSibling?.style && (e.target.nextSibling.style.display = 'flex');
              }}
            />
            {/* fallback */}
            <div className="hidden w-full h-32 bg-muted items-center justify-center text-muted-foreground text-xs rounded">
              Image unavailable
            </div>
            {/* Download button overlay */}
            <a
              href={dlHref}
              download={fileData.filename}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white rounded-full p-1.5 hover:bg-black/80"
              onClick={(e) => e.stopPropagation()}
              title="Download"
            >
              <Download size={14} />
            </a>
          </div>
          <p className="text-xs text-muted-foreground mt-1 truncate max-w-[280px]">{fileData.filename}</p>
        </>
      );
    }

    // ── Video ──────────────────────────────────────────────────────────
    if (message.type === 'video') {
      const viewSrc = authUrl(fileData.fileId, 'view');
      const dlHref = authUrl(fileData.fileId, 'download');
      const sizeMB = fileData.fileSize ? (fileData.fileSize / 1024 / 1024).toFixed(1) : '?';
      return (
        <div className="max-w-[280px] sm:max-w-[320px]">
          <video
            controls
            preload="metadata"
            className="w-full rounded max-h-[280px] bg-black"
          >
            <source src={viewSrc} type={fileData.mimeType} />
            Your browser does not support video playback.
          </video>
          <div className="flex items-center justify-between mt-1 gap-2">
            <span className="text-xs text-muted-foreground truncate">{fileData.filename} · {sizeMB} MB</span>
            <a href={dlHref} download={fileData.filename} title="Download">
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                <Download size={14} />
              </Button>
            </a>
          </div>
        </div>
      );
    }

    // ── Generic file (PDF, ZIP, DOC, etc.) ────────────────────────────
    const dlHref = authUrl(fileData.fileId, 'download');
    const sizeMB = fileData.fileSize ? (fileData.fileSize / 1024 / 1024).toFixed(2) : '?';
    return (
      <div className="flex items-center gap-3 p-2 bg-black/5 dark:bg-white/5 rounded-md min-w-[200px] max-w-[280px]">
        <div className="w-10 h-10 bg-primary/20 text-primary rounded flex items-center justify-center shrink-0">
          <FileIcon mimeType={fileData.mimeType} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="truncate text-sm font-medium">{fileData.filename}</div>
          <div className="text-xs text-muted-foreground opacity-70">{sizeMB} MB</div>
        </div>
        <a href={dlHref} download={fileData.filename} target="_blank" rel="noreferrer" title="Download">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <Download size={16} />
          </Button>
        </a>
      </div>
    );
  };

  const renderStatus = () => {
    if (!isMine) return null;
    if (message.read) return <CheckCheck size={14} className="text-blue-500 ml-1 inline" />;
    if (message.delivered) return <CheckCheck size={14} className="text-muted-foreground ml-1 inline" />;
    return <Check size={14} className="text-muted-foreground ml-1 inline" />;
  };

  const isMedia = message.type === 'image' || message.type === 'video';

  return (
    <div className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] sm:max-w-[75%] px-3 py-2 rounded-lg shadow-sm relative ${
          isMine
            ? 'bg-bubble-out rounded-tr-none text-foreground'
            : 'bg-bubble-in rounded-tl-none text-foreground'
        }`}
      >
        {renderContent()}
        <div
          className={`text-[10px] text-muted-foreground opacity-80 mt-1 flex items-center justify-end ${
            isMedia ? 'absolute bottom-2 right-2 bg-black/40 text-white px-1.5 py-0.5 rounded-full' : ''
          }`}
        >
          <span>{time}</span>
          {renderStatus()}
        </div>
      </div>
    </div>
  );
}
