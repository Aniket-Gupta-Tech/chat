import React, { useState } from 'react';
import { X, Code, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LANGUAGES = [
  'javascript',
  'python',
  'java',
  'cpp',
  'csharp',
  'html',
  'css',
  'json',
  'typescript',
  'go',
  'rust',
  'sql',
  'bash',
  'xml',
  'ruby',
  'php',
  'swift',
  'kotlin',
  'dart',
  'markdown'
];

export default function CodeSnippetDialog({ isOpen, onClose, onSubmit }) {
  const [language, setLanguage] = useState('javascript');
  const [code, setCode] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    onSubmit({ language, code });
    setCode('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card text-card-foreground w-full max-w-2xl rounded-xl shadow-xl flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2 font-semibold">
            <Code size={20} className="text-primary" />
            Share Code Snippet
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-muted-foreground" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex flex-col flex-1 p-6 gap-4 min-h-0 overflow-y-auto">
            
            <div className="flex flex-col gap-1.5 shrink-0">
              <label htmlFor="language-select" className="text-sm font-medium">
                Language
              </label>
              <select
                id="language-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="flex h-10 w-full md:w-64 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang.charAt(0).toUpperCase() + lang.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 flex-1 min-h-[200px]">
              <label htmlFor="code-input" className="text-sm font-medium">
                Code
              </label>
              <textarea
                id="code-input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Paste your code here..."
                className="flex-1 w-full min-h-[150px] rounded-md border border-input bg-background p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-none"
                spellCheck="false"
              />
            </div>

          </div>

          {/* Footer */}
          <div className="flex items-center justify-end px-6 py-4 border-t border-border shrink-0 bg-muted/30">
            <Button type="button" variant="ghost" className="mr-2" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!code.trim()} className="gap-2">
              <Send size={16} />
              Send Snippet
            </Button>
          </div>
        </form>

      </div>
    </div>
  );
}
