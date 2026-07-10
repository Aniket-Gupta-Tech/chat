import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { useChat } from '../hooks/useChat';
import { useToast } from '@/hooks/use-toast';

export default function ConnectionRequestPopup() {
  const { incomingRequest, setIncomingRequest, setActiveRoom, fetchRooms } = useChat();
  const { socket } = useSocket();
  const { toast } = useToast();
  
  const [code, setCode] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!incomingRequest) return;
    
    // Calculate initial time based on expiresAt
    const expires = new Date(incomingRequest.expiresAt).getTime();
    const now = Date.now();
    const initialTime = Math.max(0, Math.floor((expires - now) / 1000));
    
    setTimeLeft(initialTime);

    if (initialTime > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            handleReject(); // auto reject on timeout
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [incomingRequest]);

  const handleVerify = async () => {
    if (code.length !== 2) return;
    setLoading(true);
    
    try {
      const res = await api.post('/connections/verify', { 
        requestId: incomingRequest.requestId, 
        code 
      });
      
      socket.emit('connection_accepted', { 
        senderId: incomingRequest.sender._id, 
        roomId: res.data.roomId 
      });
      
      await fetchRooms();
      setIncomingRequest(null);
      setActiveRoom(res.data.roomId);
      toast({ title: 'Connected!', description: 'You can now chat.' });
      
    } catch (err) {
      toast({ 
        title: 'Verification failed', 
        description: err.response?.data?.error || 'Incorrect code', 
        variant: 'destructive' 
      });
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    try {
      await api.post('/connections/reject', { requestId: incomingRequest.requestId });
      socket.emit('connection_rejected', { 
        senderId: incomingRequest.sender._id, 
        requestId: incomingRequest.requestId 
      });
    } catch (e) {
      console.error(e);
    }
    setIncomingRequest(null);
  };

  if (!incomingRequest) return null;

  return (
    <Dialog open={true} onOpenChange={(open) => !open && handleReject()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Incoming Connection</DialogTitle>
          <DialogDescription>
            <strong>{incomingRequest.sender.username}</strong> wants to connect.
            Enter the 2-digit code they provided.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4 items-center">
          <Input
            type="text"
            maxLength={2}
            placeholder="00"
            className="text-center text-4xl tracking-[1em] h-20 w-32"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
          />
          <div className="text-sm font-mono text-muted-foreground flex items-center gap-2">
            Time remaining: <span className={timeLeft < 15 ? 'text-destructive font-bold' : ''}>{timeLeft}s</span>
          </div>
        </div>

        <DialogFooter className="flex justify-between w-full sm:justify-between">
          <Button variant="outline" onClick={handleReject} disabled={loading}>
            Decline
          </Button>
          <Button onClick={handleVerify} disabled={code.length !== 2 || loading}>
            {loading ? 'Verifying...' : 'Accept'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
