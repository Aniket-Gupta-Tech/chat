import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export default function ConnectUserDialog({ receiverUsername, onClose }) {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('input'); // input, waiting
  const { socket } = useSocket();
  const { user } = useAuth();
  const { toast } = useToast();

  const handleConnect = async () => {
    if (code.length !== 2 || isNaN(Number(code))) {
      toast({ title: 'Invalid code', description: 'Code must be exactly 2 digits', variant: 'destructive' });
      return;
    }

    try {
      setStatus('waiting');
      const res = await api.post('/connections/request', { receiverUsername, code });
      
      // Notify via socket
      socket.emit('notify_connection_request', { 
        requestId: res.data.requestId, 
        receiverId: res.data.receiverId 
      });
      
    } catch (err) {
      toast({ 
        title: 'Failed to connect', 
        description: err.response?.data?.error || 'An error occurred', 
        variant: 'destructive' 
      });
      setStatus('input');
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect with {receiverUsername}</DialogTitle>
          <DialogDescription>
            {status === 'input' 
              ? 'Enter a 2-digit code. Share this code with them so they can accept.' 
              : 'Waiting for them to respond...'}
          </DialogDescription>
        </DialogHeader>

        {status === 'input' ? (
          <div className="flex flex-col gap-4 py-4">
            <Input
              type="text"
              maxLength={2}
              placeholder="00"
              className="text-center text-4xl tracking-[1em] h-20"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </div>
        ) : (
          <div className="py-8 flex justify-center items-center">
            <div className="animate-pulse flex gap-2">
              <div className="w-3 h-3 bg-primary rounded-full"></div>
              <div className="w-3 h-3 bg-primary rounded-full delay-75"></div>
              <div className="w-3 h-3 bg-primary rounded-full delay-150"></div>
            </div>
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {status === 'input' && (
            <Button onClick={handleConnect} disabled={code.length !== 2}>
              Send Request
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
