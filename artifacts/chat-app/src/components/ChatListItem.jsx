import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';

// Format the lastMessage preview shown in the sidebar.
// lastMessage is now { content, type, createdAt } — never a raw object or string.
function formatLastMessage(lastMessage) {
  if (!lastMessage) return 'No messages yet';
  // Backwards-compat: if somehow a plain string arrives, render it directly
  if (typeof lastMessage === 'string') return lastMessage;

  switch (lastMessage.type) {
    case 'image': return '📷 Photo';
    case 'video': return '📹 Video';
    case 'file':  return '📎 File';
    default:      return lastMessage.content || 'No messages yet';
  }
}

export default function ChatListItem({ room, isActive, onClick }) {
  const { user } = useAuth();

  const otherParticipant = room.participants.find(p => p._id !== user._id);
  if (!otherParticipant) return null;

  const msgTime = room.lastMessage?.createdAt || room.updatedAt;

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-secondary transition-colors border-b border-border ${isActive ? 'bg-secondary' : ''}`}
    >
      <div className="relative shrink-0">
        <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-semibold text-lg">
          {otherParticipant.username.substring(0, 2).toUpperCase()}
        </div>
        {otherParticipant.onlineStatus && (
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-1">
          <h3 className="font-semibold text-foreground truncate">{otherParticipant.username}</h3>
          {msgTime && (
            <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
              {new Date(msgTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground truncate mr-2">
            {!room.active && (
              <span className="text-destructive text-xs mr-1">Ended</span>
            )}
            {formatLastMessage(room.lastMessage)}
          </p>
          {room.unreadCount > 0 && (
            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
              {room.unreadCount}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
