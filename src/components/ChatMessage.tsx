import React from 'react';
import Markdown from 'react-markdown';
import { User, Bot } from 'lucide-react';
import { Message } from '../types';

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isAi = message.role === 'ai';

  return (
    <div className={`py-6 px-4 sm:px-6 md:px-8 ${isAi ? 'bg-slate-50 dark:bg-slate-800/50' : ''}`}>
      <div className="max-w-4xl mx-auto flex gap-4 md:gap-6">
        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 ${isAi ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300' : 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'}`}>
          {isAi ? <Bot size={20} /> : <User size={20} />}
        </div>
        
        <div className="flex-1 min-w-0 prose prose-slate dark:prose-invert max-w-none">
          <div className="font-semibold text-sm mb-1 text-slate-800 dark:text-slate-200">
            {isAi ? 'AI Assistant' : 'You'}
          </div>
          <div className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base break-words">
            {isAi ? (
              <Markdown 
                components={{
                  pre: ({node, ...props}) => (
                    <div className="overflow-auto w-full my-4 bg-slate-900 rounded-lg p-4">
                      <pre {...props} className="bg-transparent p-0 m-0 text-sm" />
                    </div>
                  ),
                  code: ({node, className, children, ...props}) => {
                    const match = /language-(\w+)/.exec(className || '');
                    return !className ? (
                      <code {...props} className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-sm font-mono text-pink-600 dark:text-pink-400">
                        {children}
                      </code>
                    ) : (
                      <code {...props} className={className}>
                        {children}
                      </code>
                    )
                  }
                }}
              >
                {message.text}
              </Markdown>
            ) : (
              <p className="whitespace-pre-wrap m-0">{message.text}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
