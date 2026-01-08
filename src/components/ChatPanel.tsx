import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Message {
  id: string;
  senderName: string;
  content: string;
  createdAt: Date;
}

interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  currentUserName: string;
}

const ChatPanel = ({ messages, onSendMessage, currentUserName }: ChatPanelProps) => {
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      onSendMessage(newMessage.trim());
      setNewMessage('');
    }
  };

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-card-foreground">ROOM CHAT</h3>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <p className="text-muted-foreground text-center text-sm">
            Say hi to everyone in the room 👋
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex flex-col ${
                  message.senderName === currentUserName ? 'items-end' : 'items-start'
                }`}
              >
                <span className="text-xs text-muted-foreground mb-1">
                  {message.senderName}
                </span>
                <div
                  className={`px-3 py-2 rounded-xl max-w-[85%] ${
                    message.senderName === currentUserName
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-muted border-0"
          />
          <Button type="submit" size="icon" className="bg-primary hover:bg-primary/90">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ChatPanel;
