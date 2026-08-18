/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { ChatInterface } from './components/ChatInterface';
import { ChatSession, Message } from './types';

// Generate a simple unique ID
const generateId = () => Math.random().toString(36).substring(2, 9);

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('ai_chat_sessions');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    return sessions.length > 0 ? sessions[0].id : null;
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Save to localStorage whenever sessions change
  useEffect(() => {
    localStorage.setItem('ai_chat_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Ensure there's always an active session
  useEffect(() => {
    if (sessions.length > 0 && !activeSessionId) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const activeMessages = activeSession ? activeSession.messages : [];

  const handleNewSession = () => {
    const newSession: ChatSession = {
      id: generateId(),
      title: 'New Chat',
      messages: [],
      updatedAt: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const handleDeleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      setActiveSessionId(null);
    }
  };

  const handleClearChat = () => {
    if (!activeSessionId) return;
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return { ...s, messages: [], updatedAt: Date.now() };
      }
      return s;
    }));
  };

  const handleExportJSON = () => {
    if (!activeSession) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activeSession, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `chat_export_${activeSession.id}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleExportTXT = () => {
    if (!activeSession) return;
    const textContent = activeSession.messages.map(m => 
      `[${m.role === 'ai' ? 'AI Assistant' : 'You'}] - ${new Date(m.timestamp).toLocaleString()}\n${m.text}\n`
    ).join('\n----------------------------------------\n\n');
    const header = `Chat Session: ${activeSession.title}\nExported: ${new Date().toLocaleString()}\n\n========================================\n\n`;
    const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(header + textContent);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `chat_export_${activeSession.id}.txt`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleSendMessage = async (text: string) => {
    let currentSessionId = activeSessionId;
    
    // Create new session if none exists
    if (!currentSessionId) {
      const newSession: ChatSession = {
        id: generateId(),
        title: text.length > 30 ? text.substring(0, 30) + '...' : text,
        messages: [],
        updatedAt: Date.now()
      };
      setSessions(prev => [newSession, ...prev]);
      currentSessionId = newSession.id;
      setActiveSessionId(currentSessionId);
    }

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      text,
      timestamp: Date.now()
    };

    // Update title of session if it's the first message
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        return {
          ...s,
          title: s.messages.length === 0 ? (text.length > 30 ? text.substring(0, 30) + '...' : text) : s.title,
          messages: [...s.messages, userMessage],
          updatedAt: Date.now()
        };
      }
      return s;
    }));

    setIsLoading(true);

    try {
      // Get the history to send for context
      const currentHistory = activeSession?.messages || [];
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: text,
          history: currentHistory
        }),
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();
      
      const aiMessage: Message = {
        id: generateId(),
        role: 'ai',
        text: data.text,
        timestamp: Date.now()
      };

      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          return {
            ...s,
            messages: [...s.messages, aiMessage],
            updatedAt: Date.now()
          };
        }
        return s;
      }));
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Add error message
      const errorMessage: Message = {
        id: generateId(),
        role: 'ai',
        text: 'Sorry, I encountered an error while processing your request. Please try again later.',
        timestamp: Date.now()
      };
      
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          return {
            ...s,
            messages: [...s.messages, errorMessage],
            updatedAt: Date.now()
          };
        }
        return s;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      {/* Header */}
      <header className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 justify-between bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm z-40 sticky top-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="md:hidden p-1.5 -ml-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">AI</span>
            </div>
            <h1 className="font-semibold text-lg tracking-tight">AI Assistant</h1>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        <Sidebar 
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={setActiveSessionId}
          onNewSession={handleNewSession}
          onDeleteSession={handleDeleteSession}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        
        <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-white dark:bg-slate-950">
          <ChatInterface 
            messages={activeMessages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            onClearChat={handleClearChat}
            onExportJSON={handleExportJSON}
            onExportTXT={handleExportTXT}
          />
        </main>
      </div>
    </div>
  );
}
