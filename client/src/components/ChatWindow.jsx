import React, { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, Smile, X, ArrowLeft, RefreshCw } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { useChat } from '../hooks/useChat';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import api from '../services/api';
import MessageBubble from './MessageBubble';
import ConnectUserDialog from './ConnectUserDialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

export default function ChatWindow() {
  const {
    activeRoomId, setActiveRoom, rooms, messagesByRoom,
    sendMessage, addMessage, typingStates, markRoomEnded,
  } = useChat();
  const { user } = useAuth();
  const { socket } = useSocket();
  const { toast } = useToast();

  const [content, setContent] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [showReconnect, setShowReconnect] = useState(false);

  const messagesEndRef   = useRef(null);
  const fileInputRef     = useRef(null);
  const typingTimeoutRef = useRef(null);

  const room             = rooms.find((r) => r.roomId === activeRoomId);
  const messages         = messagesByRoom[activeRoomId] || [];
  const otherParticipant = room?.participants.find((p) => p._id !== user._id);
  const isOtherTyping    = typingStates[activeRoomId]?.[otherParticipant?._id];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOtherTyping]);

  useEffect(() => {
    setShowEmoji(false);
  }, [activeRoomId]);

  if (!room || !otherParticipant) return null;

  // ── Typing ────────────────────────────────────────────────────────────────
  const handleTextChange = (e) => {
    setContent(e.target.value);
    if (!isTyping && room.active) {
      setIsTyping(true);
      socket.emit('typing_start', { roomId: activeRoomId });
    }
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit('typing_stop', { roomId: activeRoomId });
    }, 2000);
  };

  // ── Send text ─────────────────────────────────────────────────────────────
  const handleSend = (e) => {
    e?.preventDefault();
    if (!content.trim() || !room.active) return;   // guard: room must be active
    sendMessage(activeRoomId, content.trim(), otherParticipant._id, 'text');
    setContent('');
    setShowEmoji(false);
    clearTimeout(typingTimeoutRef.current);
    setIsTyping(false);
    socket.emit('typing_stop', { roomId: activeRoomId });
  };

  // ── File upload ───────────────────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    if (!room.active) return;                        // guard: room must be active
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast({ title: 'File too large', description: 'Maximum file size is 100 MB', variant: 'destructive' });
      e.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('receiverId', otherParticipant._id);

    setUploading(true);
    setUploadProgress(0);

    try {
      const res = await api.post(`/files/upload/${activeRoomId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          setUploadProgress(Math.round((evt.loaded * 100) / evt.total));
        },
      });
      if (res.data.message) addMessage(activeRoomId, res.data.message);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Upload failed';
      toast({ title: 'Upload failed', description: msg, variant: 'destructive' });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      e.target.value = '';
    }
  };

  // ── End chat ──────────────────────────────────────────────────────────────
  const endChat = async () => {
    if (!window.confirm('Are you sure you want to end this chat?')) return;
    try {
      await api.post(`/rooms/${activeRoomId}/end`);
      // Immediately mark inactive in local state so UI flips before socket round-trip
      markRoomEnded(activeRoomId);
      socket.emit('end_chat', { roomId: activeRoomId, otherUserId: otherParticipant._id });
    } catch {
      toast({ title: 'Failed to end chat', variant: 'destructive' });
    }
  };

  const theme = localStorage.getItem('theme') || 'light';

  return (
    <div className="flex flex-col h-full w-full bg-chat-bg relative">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="h-16 px-4 bg-sidebar-bg border-b border-border flex items-center justify-between shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost" size="icon"
            className="md:hidden -ml-2"
            onClick={() => setActiveRoom(null)}
          >
            <ArrowLeft size={20} />
          </Button>
          <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-semibold">
            {otherParticipant.username.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="font-semibold">{otherParticipant.username}</h2>
            <p className="text-xs text-muted-foreground">
              {room.active
                ? otherParticipant.onlineStatus
                  ? 'Online'
                  : otherParticipant.lastSeen
                    ? `Last seen ${formatDistanceToNow(new Date(otherParticipant.lastSeen), { addSuffix: true })}`
                    : 'Offline'
                : 'Chat ended'}
            </p>
          </div>
        </div>

        {room.active && (
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={endChat}
          >
            End Chat
          </Button>
        )}
      </div>

      {/* ── Messages ─────────────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto p-4 md:p-8 space-y-2 z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.08'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C%2Fg%3E%3C/svg%3E")`,
        }}
      >
        <div className="text-center my-4">
          <span className="bg-secondary text-secondary-foreground text-xs px-3 py-1 rounded-md shadow-sm">
            Chat started
          </span>
        </div>

        {messages.map((msg, idx) => {
          const isMine  = msg.senderId?._id === user._id || msg.senderId === user._id;
          const showDate =
            idx === 0 ||
            new Date(msg.createdAt).toDateString() !== new Date(messages[idx - 1].createdAt).toDateString();

          return (
            <React.Fragment key={msg._id}>
              {showDate && (
                <div className="text-center my-4">
                  <span className="bg-secondary text-secondary-foreground text-xs px-3 py-1 rounded-md shadow-sm">
                    {new Date(msg.createdAt).toLocaleDateString()}
                  </span>
                </div>
              )}
              <MessageBubble message={msg} isMine={isMine} />
            </React.Fragment>
          );
        })}

        {isOtherTyping && (
          <div className="flex w-full mb-2 justify-start">
            <div className="bg-bubble-in rounded-lg rounded-tl-none p-3 shadow-sm inline-block">
              <div className="flex gap-1 items-center h-4">
                {[0, 150, 300].map((delay) => (
                  <div
                    key={delay}
                    className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area / Ended banner ─────────────────────────────────────── */}
      {room.active ? (
        <div className="px-4 py-3 bg-sidebar-bg flex items-end gap-2 shrink-0 z-10 border-t border-border">
          {showEmoji && (
            <div className="absolute bottom-16 left-4 z-50 shadow-xl rounded-lg">
              <EmojiPicker onEmojiClick={(e) => setContent((p) => p + e.emoji)} theme={theme} />
            </div>
          )}

          <Button
            variant="ghost" size="icon"
            className="shrink-0 text-muted-foreground"
            onClick={() => setShowEmoji(!showEmoji)}
          >
            {showEmoji ? <X size={24} /> : <Smile size={24} />}
          </Button>

          <input
            type="file"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar,.7z"
          />

          <Button
            variant="ghost" size="icon"
            className="shrink-0 text-muted-foreground"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Attach file, image, or video"
          >
            <Paperclip size={20} className={uploading ? 'animate-pulse' : ''} />
          </Button>

          <form onSubmit={handleSend} className="flex-1 flex bg-secondary rounded-lg overflow-hidden">
            <input
              type="text"
              value={content}
              onChange={handleTextChange}
              placeholder={uploading ? `Uploading ${uploadProgress}%…` : 'Type a message'}
              className="flex-1 bg-transparent border-none focus:ring-0 px-4 py-3 outline-none"
              disabled={uploading}
            />
          </form>

          <Button
            onClick={handleSend}
            size="icon"
            className="shrink-0 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 w-12"
            disabled={!content.trim() || uploading}
          >
            <Send size={20} className="ml-1" />
          </Button>
        </div>
      ) : (
        /* ── Chat ended footer ─────────────────────────────────────────── */
        <div className="px-4 py-4 bg-sidebar-bg border-t border-border z-10 flex flex-col items-center gap-3">
          <p className="text-sm text-muted-foreground">
            This chat has ended. Messages can no longer be sent.
          </p>
          <Button
            variant="outline"
            className="gap-2 text-primary border-primary hover:bg-primary/10"
            onClick={() => setShowReconnect(true)}
          >
            <RefreshCw size={15} />
            Reconnect with {otherParticipant.username}
          </Button>
        </div>
      )}

      {/* ── Reconnect dialog (same flow as new chat) ─────────────────────── */}
      {showReconnect && (
        <ConnectUserDialog
          receiverUsername={otherParticipant.username}
          onClose={() => setShowReconnect(false)}
        />
      )}
    </div>
  );
}
