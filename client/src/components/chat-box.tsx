import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import socketManager from '@/lib/socketManager';
import { cn } from '@/lib/utils';

export interface ChatMessage {
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}

interface ChatBoxProps {
  gameId: string;
  currentPlayerId: string;
  onSendMessage: (message: string) => void;
  className?: string;
}

export const ChatBox: React.FC<ChatBoxProps> = ({
  gameId,
  currentPlayerId,
  onSendMessage,
  className
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Listen for incoming chat messages
  useEffect(() => {
    const handleChatMessage = (data: ChatMessage) => {
      console.log('[ChatBox] Received chat message:', data);
      setMessages(prev => [...prev, data]);
    };

    const unsubscribe = socketManager.on('chatMessage', handleChatMessage);

    return () => {
      unsubscribe();
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && !isMinimized) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isMinimized]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim()) {
      return;
    }

    onSendMessage(inputValue.trim());
    setInputValue('');
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <Card className={cn(
      "fixed bottom-4 right-4 w-80 shadow-lg transition-all duration-200",
      isMinimized ? "h-14" : "h-96",
      className
    )}>
      <CardHeader
        className="p-3 border-b cursor-pointer bg-primary text-white hover:bg-primary/90 transition-colors"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex justify-between items-center">
          <CardTitle className="text-sm font-medium">Chat</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-white hover:bg-white/20"
          >
            {isMinimized ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </Button>
        </div>
      </CardHeader>

      {!isMinimized && (
        <>
          <CardContent className="p-0 h-[calc(100%-8rem)]">
            <ScrollArea className="h-full p-3" ref={scrollAreaRef}>
              <div className="space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center text-sm text-gray-500 mt-8">
                    No messages yet. Say hello!
                  </div>
                ) : (
                  messages.map((msg, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex flex-col",
                        msg.playerId === currentPlayerId ? "items-end" : "items-start"
                      )}
                    >
                      <div className="text-xs text-gray-500 mb-1">
                        {msg.playerId === currentPlayerId ? 'You' : msg.playerName}
                        <span className="ml-1">{formatTime(msg.timestamp)}</span>
                      </div>
                      <div
                        className={cn(
                          "max-w-[80%] rounded-lg px-3 py-2 text-sm break-words",
                          msg.playerId === currentPlayerId
                            ? "bg-primary text-white"
                            : "bg-gray-100 text-gray-900"
                        )}
                      >
                        {msg.message}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          </CardContent>

          <div className="border-t p-3">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input
                type="text"
                placeholder="Type a message..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                maxLength={200}
                className="flex-1"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!inputValue.trim()}
              >
                Send
              </Button>
            </form>
          </div>
        </>
      )}
    </Card>
  );
};
