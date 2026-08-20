import React, { createContext, useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export const ChatContext = createContext();

export function ChatProvider({ children }) {
  const { socket, connected } = useSocket();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [messagesByRoom, setMessagesByRoom] = useState({});
  const [typingStates, setTypingStates] = useState({});
  const [incomingRequest, setIncomingRequest] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState({});

  const roomsRef = useRef([]);
  roomsRef.current = rooms;

  const fetchRooms = async () => {
    try {
      const res = await api.get('/rooms');
      setRooms(res.data.rooms || []);
    } catch (err) {
      console.error('Failed to fetch rooms', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchRooms();
    }
  }, [user]);

  useEffect(() => {
    if (!socket || !connected) return;

    socket.on('new_message', (message) => {
      setMessagesByRoom(prev => {
        const roomMessages = prev[message.roomId] || [];
        // Avoid duplicate messages
        if (roomMessages.some(m => m._id === message._id)) return prev;

        // Replace the matching optimistic message if found
        let replaced = false;
        const newMessages = roomMessages.map(m => {
          if (!replaced && typeof m._id === 'string' && m._id.startsWith('temp-') && m.content === message.content && m.type === message.type) {
            replaced = true;
            return message;
          }
          return m;
        });

        if (!replaced) {
          newMessages.push(message);
        }

        return {
          ...prev,
          [message.roomId]: newMessages
        };
      });

      // Update room lastMessage and unreadCount if not active room
      setRooms(prev => {
        return prev.map(room => {
          if (room.roomId === message.roomId) {
            const isRead = activeRoomId === message.roomId;
            return {
              ...room,
              lastMessage: { content: message.content, type: message.type, createdAt: message.createdAt },
              unreadCount: isRead ? 0 : (room.unreadCount || 0) + 1
            };
          }
          return room;
        });
      });

      if (activeRoomId === message.roomId) {
        socket.emit('mark_read', { roomId: message.roomId });
      }
    });

    socket.on('message_notification', ({ roomId, message }) => {
      // In case we only get the notification
      if (activeRoomId !== roomId) {
        setRooms(prev => prev.map(room => 
          room.roomId === roomId 
            ? { ...room, unreadCount: (room.unreadCount || 0) + 1, lastMessage: { content: message.content, type: message.type, createdAt: message.createdAt } }
            : room
        ));
      }
    });

    socket.on('user_typing', ({ userId, roomId }) => {
      setTypingStates(prev => ({
        ...prev,
        [roomId]: { ...prev[roomId], [userId]: true }
      }));
    });

    socket.on('user_stop_typing', ({ userId, roomId }) => {
      setTypingStates(prev => {
        const roomTyping = { ...prev[roomId] };
        delete roomTyping[userId];
        return { ...prev, [roomId]: roomTyping };
      });
    });

    socket.on('messages_read', ({ roomId }) => {
      setMessagesByRoom(prev => {
        const roomMessages = prev[roomId] || [];
        const updated = roomMessages.map(m => ({ ...m, read: true }));
        return { ...prev, [roomId]: updated };
      });
    });

    socket.on('user_online', ({ userId }) => {
      setOnlineUsers(prev => ({ ...prev, [userId]: true }));
      setRooms(prev => prev.map(room => {
        const newParticipants = room.participants.map(p => 
          p._id === userId ? { ...p, onlineStatus: true } : p
        );
        return { ...room, participants: newParticipants };
      }));
    });

    socket.on('user_offline', ({ userId, lastSeen }) => {
      setOnlineUsers(prev => ({ ...prev, [userId]: false }));
      setRooms(prev => prev.map(room => {
        const newParticipants = room.participants.map(p => 
          p._id === userId ? { ...p, onlineStatus: false, lastSeen } : p
        );
        return { ...room, participants: newParticipants };
      }));
    });

    socket.on('incoming_connection_request', (data) => {
      setIncomingRequest(data);
    });

    socket.on('connection_established', ({ roomId }) => {
      // Re-fetch so the new room (with participant details) enters the list
      fetchRooms();
      toast({ title: 'Connection accepted!', description: 'You can now chat with them.' });
    });

    socket.on('connection_rejected', () => {
      toast({ title: 'Connection rejected', description: 'Your request was declined.', variant: 'destructive' });
    });

    socket.on('chat_ended', ({ roomId, endedBy }) => {
      setRooms(prev => prev.map(room =>
        room.roomId === roomId ? { ...room, active: false } : room
      ));
      // Only toast if someone ELSE ended the chat (we handle our own end immediately in ChatWindow)
      if (activeRoomId === roomId && endedBy && endedBy._id !== user?._id) {
        toast({ title: 'Chat Ended', description: `${endedBy.username} ended the chat.` });
      }
    });

    socket.on('error', ({ message }) => {
      toast({ title: 'Error', description: message, variant: 'destructive' });
    });

    return () => {
      socket.off('new_message');
      socket.off('message_notification');
      socket.off('user_typing');
      socket.off('user_stop_typing');
      socket.off('messages_read');
      socket.off('user_online');
      socket.off('user_offline');
      socket.off('incoming_connection_request');
      socket.off('connection_established');
      socket.off('connection_rejected');
      socket.off('chat_ended');
      socket.off('error');
    };
  }, [socket, connected, activeRoomId, toast]);

  // Mark a room as ended locally — used by ChatWindow immediately on endChat
  const markRoomEnded = useCallback((roomId) => {
    setRooms(prev => prev.map(r => r.roomId === roomId ? { ...r, active: false } : r));
  }, []);

  const loadMessages = useCallback(async (roomId, page = 1) => {
    try {
      const res = await api.get(`/messages/${roomId}?page=${page}&limit=50`);
      setMessagesByRoom(prev => {
        const existing = page === 1 ? [] : (prev[roomId] || []);
        // Unshift older messages
        const newMessages = res.data.messages.filter(nm => !existing.some(em => em._id === nm._id));
        const combined = [...newMessages, ...existing];
        return { ...prev, [roomId]: combined.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)) };
      });
      return res.data;
    } catch (err) {
      console.error('Failed to load messages', err);
    }
  }, []);

  const setActiveRoom = useCallback((roomId) => {
    if (activeRoomId && activeRoomId !== roomId && socket) {
      socket.emit('leave_room', { roomId: activeRoomId });
    }
    setActiveRoomId(roomId);
    if (roomId && socket) {
      socket.emit('join_room', { roomId });
      socket.emit('mark_read', { roomId });
      
      setRooms(prev => prev.map(r => r.roomId === roomId ? { ...r, unreadCount: 0 } : r));
      
      if (!messagesByRoom[roomId]) {
        loadMessages(roomId, 1);
      }
    }
  }, [activeRoomId, socket, messagesByRoom, loadMessages]);

  const sendMessage = useCallback((roomId, content, receiverId, type = 'text') => {
    if (socket && connected) {
      const optimisticMessage = {
        _id: 'temp-' + Date.now(),
        roomId,
        senderId: { _id: user._id, username: user.username },
        receiverId: { _id: receiverId },
        type,
        content,
        delivered: false,
        read: false,
        createdAt: new Date().toISOString()
      };
      
      setMessagesByRoom(prev => ({
        ...prev,
        [roomId]: [...(prev[roomId] || []), optimisticMessage]
      }));
      
      socket.emit('send_message', { roomId, content, receiverId, type });
    }
  }, [socket, connected, user]);

  // Add a server-confirmed message directly (e.g. from file upload response)
  const addMessage = useCallback((roomId, message) => {
    setMessagesByRoom(prev => {
      const existing = prev[roomId] || [];
      if (existing.some(m => m._id === message._id)) return prev;
      return { ...prev, [roomId]: [...existing, message] };
    });
    setRooms(prev => prev.map(room =>
      room.roomId === roomId
        ? { ...room, lastMessage: { content: message.content, type: message.type, createdAt: message.createdAt } }
        : room
    ));
  }, []);

  return (
    <ChatContext.Provider value={{
      rooms,
      activeRoomId,
      setActiveRoom,
      messagesByRoom,
      loadMessages,
      typingStates,
      incomingRequest,
      setIncomingRequest,
      sendMessage,
      addMessage,
      fetchRooms,
      onlineUsers,
      markRoomEnded,
    }}>
      {children}
    </ChatContext.Provider>
  );
}
