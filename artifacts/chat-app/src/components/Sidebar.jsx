import React, { useState } from 'react';
import { MessageSquare, Users, Moon, Sun, Search, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useChat } from '../hooks/useChat';
import ChatListItem from './ChatListItem';
import UserSearchPanel from './UserSearchPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { rooms, activeRoomId, setActiveRoom } = useChat();
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  // Deduplicate: if there are multiple rooms with the same other participant,
  // keep only the most recent one (highest createdAt). This prevents the sidebar
  // showing "duplicate" entries when a user ends and restarts a chat.
  const dedupedRooms = React.useMemo(() => {
    const latestByParticipant = new Map();

    for (const room of rooms) {
      const other = room.participants.find(p => p._id !== user._id);
      if (!other) continue;

      const existing = latestByParticipant.get(other._id);
      if (!existing) {
        latestByParticipant.set(other._id, room);
      } else {
        // Prefer active room; if both same state, take the newer one
        const existingTime = new Date(existing.createdAt).getTime();
        const thisTime     = new Date(room.createdAt).getTime();
        if (room.active && !existing.active) {
          latestByParticipant.set(other._id, room);
        } else if (!room.active && existing.active) {
          // keep existing
        } else if (thisTime > existingTime) {
          latestByParticipant.set(other._id, room);
        }
      }
    }

    return Array.from(latestByParticipant.values())
      .sort((a, b) => {
        const ta = a.lastMessage?.createdAt || a.updatedAt || a.createdAt;
        const tb = b.lastMessage?.createdAt || b.updatedAt || b.createdAt;
        return new Date(tb) - new Date(ta);
      });
  }, [rooms, user._id]);

  const filteredRooms = dedupedRooms.filter(room => {
    const other = room.participants.find(p => p._id !== user._id);
    return other?.username.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="h-16 px-4 bg-sidebar-bg border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">
            {user?.username.substring(0, 2).toUpperCase()}
          </div>
          <span className="font-semibold">{user?.username}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-muted-foreground">
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </Button>
          <Button
            variant="ghost" size="icon"
            onClick={logout}
            className="text-muted-foreground hover:text-destructive"
          >
            <LogOut size={20} />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="chats" className="flex-1 flex flex-col min-h-0">
        <div className="px-4 py-2 border-b border-border bg-sidebar-bg shrink-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="chats">Chats</TabsTrigger>
            <TabsTrigger value="users">Search Users</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="chats" className="flex-1 flex flex-col min-h-0 m-0 border-none outline-none">
          <div className="p-3 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                className="pl-10 bg-secondary border-none"
                placeholder="Search chats"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredRooms.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No chats found
              </div>
            ) : (
              filteredRooms.map(room => (
                <ChatListItem
                  key={room.roomId}
                  room={room}
                  isActive={activeRoomId === room.roomId}
                  onClick={() => setActiveRoom(room.roomId)}
                />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="users" className="flex-1 overflow-hidden m-0 border-none outline-none">
          <UserSearchPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
