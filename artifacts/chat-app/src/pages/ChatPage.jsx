import React, { useState, useEffect } from 'react';
import { useChat } from '../hooks/useChat';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import EmptyState from '../components/EmptyState';
import ConnectionRequestPopup from '../components/ConnectionRequestPopup';

export default function ChatPage() {
  const { activeRoomId, incomingRequest } = useChat();
  const { user } = useAuth();
  const { connected } = useSocket();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const showSidebar = !isMobile || (isMobile && !activeRoomId);
  const showChat = !isMobile || (isMobile && activeRoomId);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background">
      {!connected && (
        <div className="absolute top-0 left-0 w-full bg-destructive text-destructive-foreground text-xs text-center py-1 z-50">
          Connecting to server...
        </div>
      )}
      
      {showSidebar && (
        <div className={`${isMobile ? 'w-full' : 'w-[380px] min-w-[380px] border-r border-border'} h-full flex flex-col bg-sidebar-bg`}>
          <Sidebar />
        </div>
      )}
      
      {showChat && (
        <div className="flex-1 h-full bg-chat-bg relative">
          {activeRoomId ? (
            <ChatWindow />
          ) : (
            <EmptyState />
          )}
        </div>
      )}

      {incomingRequest && <ConnectionRequestPopup />}
    </div>
  );
}
