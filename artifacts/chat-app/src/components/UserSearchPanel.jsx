import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import ConnectUserDialog from './ConnectUserDialog';

export default function UserSearchPanel() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    const searchUsers = async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const res = await api.get(`/users/search?q=${query}`);
        // Filter out self
        setResults(res.data.users.filter(u => u._id !== user._id));
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(searchUsers, 500);
    return () => clearTimeout(debounce);
  }, [query, user._id]);

  return (
    <div className="flex flex-col h-full bg-sidebar-bg">
      <div className="p-3 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            className="pl-10 bg-secondary border-none"
            placeholder="Search by username"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="text-center py-4 text-sm text-muted-foreground">Searching...</div>
        ) : results.length > 0 ? (
          <div className="space-y-1">
            {results.map(u => (
              <div key={u._id} className="flex items-center justify-between p-3 hover:bg-secondary rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-semibold">
                    {u.username.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold">{u.username}</div>
                    <div className="text-xs text-muted-foreground">
                      {u.onlineStatus ? 'Online' : 'Offline'}
                    </div>
                  </div>
                </div>
                <Button size="sm" onClick={() => setSelectedUser(u)}>
                  Connect
                </Button>
              </div>
            ))}
          </div>
        ) : query ? (
          <div className="text-center py-8 text-sm text-muted-foreground">No users found</div>
        ) : (
          <div className="text-center py-8 text-sm text-muted-foreground">Type to search for users</div>
        )}
      </div>

      {selectedUser && (
        <ConnectUserDialog 
          receiverUsername={selectedUser.username} 
          onClose={() => setSelectedUser(null)} 
        />
      )}
    </div>
  );
}
