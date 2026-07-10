import React from 'react';
import { MessageSquare } from 'lucide-react';

export default function EmptyState() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-chat-bg border-l border-border/10 p-8 text-center">
      <div className="mb-8 relative flex items-center justify-center w-32 h-32 bg-secondary rounded-full overflow-hidden shadow-sm">
        <MessageSquare size={64} className="text-muted-foreground" />
      </div>
      <h2 className="text-3xl font-light text-foreground mb-4">WhatsApp Web Clone</h2>
      <p className="text-muted-foreground max-w-md">
        Send and receive messages without keeping your phone online.
        Search for users to connect and start chatting.
      </p>
      <div className="mt-16 text-xs text-muted-foreground/60 flex items-center gap-1">
        🔒 End-to-end encrypted clone
      </div>
    </div>
  );
}
