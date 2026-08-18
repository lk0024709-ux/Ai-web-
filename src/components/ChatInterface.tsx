import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Trash2, Download } from 'lucide-react';
import { Message } from '../types';
import { ChatMessage } from './ChatMessage';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  onClearChat: () => void;
  onExportJSON: () => void;
  onExportTXT: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  messages, 
  onSendMessage, 
  isLoading,
  onClearChat,
  onExportJSON,
  onExportTXT
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    onSendMessage(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full relative">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto pb-32">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
              <span className="text-3xl">👋</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">How can I help you today?</h2>
            <p className="text-slate-500 max-w-md">Type a prompt below to start a conversation with the AI assistant.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {messages.map(message => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isLoading && (
              <div className="py-6 px-4 sm:px-6 md:px-8 bg-slate-50 dark:bg-slate-800/50">
                <div className="max-w-4xl mx-auto flex gap-4 md:gap-6">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300 flex items-center justify-center mt-1">
                    <Loader2 size={18} className="animate-spin" />
                  </div>
                  <div className="flex items-center text-slate-500 text-sm font-medium">
                    Generating response...
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-white via-white to-transparent dark:from-slate-950 dark:via-slate-950 pt-6 pb-4 px-4 sm:px-6 md:px-8">
        <div className="max-w-4xl mx-auto relative">
          {messages.length > 0 && (
            <div className="absolute -top-10 right-0 flex items-center gap-2">
              <button 
                onClick={onExportJSON}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-full shadow-sm border border-slate-200 dark:border-slate-800 transition-colors"
                title="Export as JSON"
              >
                <Download size={12} />
                JSON
              </button>
              <button 
                onClick={onExportTXT}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-full shadow-sm border border-slate-200 dark:border-slate-800 transition-colors"
                title="Export as Text"
              >
                <Download size={12} />
                TXT
              </button>
              <button 
                onClick={onClearChat}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-red-500 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-full shadow-sm border border-slate-200 dark:border-slate-800 transition-colors"
              >
                <Trash2 size={12} />
                Clear
              </button>
            </div>
          )}
          
          <form 
            onSubmit={handleSubmit}
            className="relative flex items-end gap-2 bg-white dark:bg-slate-900 rounded-2xl shadow-[0_0_15px_rgba(0,0,0,0.05)] dark:shadow-[0_0_15px_rgba(0,0,0,0.2)] border border-slate-200 dark:border-slate-800 p-2 overflow-hidden transition-shadow focus-within:shadow-[0_0_20px_rgba(0,0,0,0.08)] dark:focus-within:shadow-[0_0_20px_rgba(0,0,0,0.4)]"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message AI Assistant..."
              className="flex-1 max-h-[200px] min-h-[44px] w-full resize-none bg-transparent py-3 px-3 md:px-4 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none text-base"
              rows={1}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="mb-1 mr-1 shrink-0 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600 text-white rounded-xl w-10 h-10 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </form>
          <div className="text-center mt-2 text-xs text-slate-400 dark:text-slate-500">
            AI can make mistakes. Consider verifying important information.
          </div>
        </div>
      </div>
    </div>
  );
};
