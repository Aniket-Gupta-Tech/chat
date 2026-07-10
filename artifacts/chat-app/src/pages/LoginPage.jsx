import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const { login, register } = useAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (action) => {
    if (!username.trim()) {
      toast({ title: 'Error', description: 'Username is required', variant: 'destructive' });
      return;
    }
    
    setLoading(true);
    const authAction = action === 'login' ? login : register;
    const res = await authAction(username.trim());
    setLoading(false);
    
    if (!res.success) {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-secondary flex flex-col items-center justify-center p-4">
      <div className="mb-8 flex flex-col items-center space-y-4">
        <div className="bg-primary text-primary-foreground p-4 rounded-full">
          <MessageSquare size={48} />
        </div>
        <h1 className="text-3xl font-semibold text-foreground">WhatsApp Web Clone</h1>
        <p className="text-muted-foreground">Fast, simple, secure messaging.</p>
      </div>

      <Card className="w-full max-w-md shadow-lg border-none">
        <Tabs defaultValue="login" className="w-full">
          <CardHeader>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Enter your username to connect.</CardDescription>
          </CardHeader>
          <CardContent>
            <TabsContent value="login">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Input 
                    type="text" 
                    placeholder="Username" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAuth('login')}
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={() => handleAuth('login')}
                  disabled={loading}
                >
                  {loading ? 'Logging in...' : 'Login'}
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="register">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Input 
                    type="text" 
                    placeholder="Choose a username" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAuth('register')}
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={() => handleAuth('register')}
                  disabled={loading}
                >
                  {loading ? 'Registering...' : 'Register'}
                </Button>
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
