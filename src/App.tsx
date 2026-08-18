import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Menu, X, MessageSquare, Mic } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { ChatInterface } from './components/ChatInterface';
import { VoiceAssistant } from './components/VoiceAssistant';
import { AgentOrchestrator } from './components/AgentOrchestrator';
import { ChatSession, Message } from './types';

const generateId = () => Math.random().toString(36).substring(2, 9);

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try { const s = localStorage.getItem('ai_chat_sessions'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => sessions.length>0? sessions[0].id : null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [mode, setMode] = useState<'chat'|'voice'>('chat');
  const [lastTrace, setLastTrace] = useState<{ intent?: string; traces?: any[]; latencyMs?: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(()=>{ localStorage.setItem('ai_chat_sessions', JSON.stringify(sessions)); },[sessions]);
  useEffect(()=>{ if(sessions.length>0 && !activeSessionId) setActiveSessionId(sessions[0].id); },[sessions, activeSessionId]);

  const activeSession = sessions.find(s=>s.id===activeSessionId);
  const activeMessages = activeSession ? activeSession.messages : [];

  const handleNewSession = () => {
    const n: ChatSession = { id: generateId(), title:'New Chat', messages:[], updatedAt: Date.now() };
    setSessions(p=>[n,...p]); setActiveSessionId(n.id);
  };
  const handleDeleteSession = (id:string)=>{ setSessions(p=>p.filter(s=>s.id!==id)); if(activeSessionId===id) setActiveSessionId(null); };
  const handleClearChat = ()=>{ if(!activeSessionId) return; setSessions(p=>p.map(s=>s.id===activeSessionId? {...s,messages:[],updatedAt:Date.now()}:s)); };

  const handleExportJSON = ()=>{
    if(!activeSession) return;
    const dataStr="data:text/json;charset=utf-8,"+encodeURIComponent(JSON.stringify(activeSession,null,2));
    const a=document.createElement('a'); a.href=dataStr; a.download=`chat_export_${activeSession.id}.json`; document.body.appendChild(a); a.click(); a.remove();
  };
  const handleExportTXT = ()=>{
    if(!activeSession) return;
    const txt=activeSession.messages.map(m=>`[${m.role==='ai'?'AI':'You'}] ${new Date(m.timestamp).toLocaleString()}\n${m.text}\n`).join('\n---\n\n');
    const header=`Chat: ${activeSession.title}\nExported: ${new Date().toLocaleString()}\n\n===\n\n`;
    const dataStr="data:text/plain;charset=utf-8,"+encodeURIComponent(header+txt);
    const a=document.createElement('a'); a.href=dataStr; a.download=`chat_export_${activeSession.id}.txt`; document.body.appendChild(a); a.click(); a.remove();
  };

  // 2. Implement API Call — wired to POST http://localhost:3000/api/orchestrator/run
  const sendViaOrchestrator = useCallback(async (text: string, m: 'chat'|'voice' = mode) => {
    let currentSessionId = activeSessionId;
    if(!currentSessionId){
      const ns: ChatSession={ id: generateId(), title: text.slice(0,30), messages:[], updatedAt: Date.now()};
      setSessions(p=>[ns,...p]); currentSessionId=ns.id; setActiveSessionId(ns.id);
    }
    const userMsg: Message={ id: generateId(), role:'user', text, timestamp: Date.now()};
    setSessions(p=>p.map(s=>s.id===currentSessionId? {...s, title: s.messages.length===0? text.slice(0,30):s.title, messages:[...s.messages,userMsg], updatedAt:Date.now()}:s));
    setIsLoading(true);
    setLastTrace(null);

    // barge-in: abort previous fetch + cancel TTS
    try { abortRef.current?.abort(); } catch {}
    try { window.speechSynthesis?.cancel(); } catch {}
    const controller = new AbortController();
    abortRef.current = controller;

    try{
      const history = activeSession?.messages || [];
      const res = await fetch('/api/orchestrator/run',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ prompt:text, history, mode:m }),
        signal: controller.signal
      });
      if(!res.ok){
        const errBody = await res.text().catch(()=> '');
        throw new Error(`Backend ${res.status}: ${errBody.slice(0,200) || res.statusText}`);
      }
      const data: { text:string; intent:string; traces:any[]; latencyMs:number } = await res.json();

      const aiMsg: Message={ id: generateId(), role:'ai', text:data.text, timestamp: Date.now()};
      setSessions(p=>p.map(s=>s.id===currentSessionId? {...s,messages:[...s.messages,aiMsg],updatedAt:Date.now()}:s));

      // 3. UI State Wiring — traces/latency mapped without re-render loops (set once, stable object)
      setLastTrace({ intent: data.intent, traces: data.traces, latencyMs: data.latencyMs });

      // 4. Audio Playback — dispatch to VoiceAssistant's hook
      if(m==='voice' && data.text){
        window.dispatchEvent(new CustomEvent('app:speak',{detail: data.text}));
      }
      return data.text as string;
    }catch(e:any){
      if(e?.name === 'AbortError') return; // barge-in aborted, ignore
      // try/catch ensures no crash if backend unreachable — show error bubble
      const msg = e?.message?.includes('Failed to fetch') ? 'Backend unreachable (is http://localhost:3000 running?)' : e.message || 'Request failed';
      const err:Message={ id: generateId(), role:'ai', text:`⚠️ ${msg}`, timestamp:Date.now()};
      setSessions(p=>p.map(s=>s.id===currentSessionId? {...s,messages:[...s.messages,err]}:s));
      throw e;
    }finally{
      if(abortRef.current === controller) abortRef.current = null;
      setIsLoading(false);
    }
  }, [activeSession, activeSessionId, mode]);

  // cleanup abort on unmount
  useEffect(()=>()=>{ try{ abortRef.current?.abort(); }catch{}; try{ window.speechSynthesis?.cancel(); }catch{} },[]);

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      <header className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 justify-between bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm z-40 sticky top-0">
        <div className="flex items-center gap-3">
          <button onClick={()=>setIsSidebarOpen(!isSidebarOpen)} className="md:hidden p-1.5 -ml-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md">
            {isSidebarOpen? <X size={20}/>:<Menu size={20}/>}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center"><span className="text-white text-xs font-bold">AI</span></div>
            <h1 className="font-semibold text-lg tracking-tight">AI Assistant</h1>
            <span className="hidden sm:inline text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">Orchestrator</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 dark:bg-slate-900 rounded-full p-1 border border-slate-200 dark:border-slate-800">
            <button onClick={()=>setMode('chat')} className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-1.5 ${mode==='chat'?'bg-white dark:bg-slate-800 shadow border border-slate-200 dark:border-slate-700 text-blue-600':'text-slate-500'}`}><MessageSquare size={14}/> Chat</button>
            <button onClick={()=>setMode('voice')} className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-1.5 ${mode==='voice'?'bg-white dark:bg-slate-800 shadow border border-slate-200 dark:border-slate-700 text-blue-600':'text-slate-500'}`}><Mic size={14}/> Voice</button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <Sidebar sessions={sessions} activeSessionId={activeSessionId} onSelectSession={setActiveSessionId} onNewSession={handleNewSession} onDeleteSession={handleDeleteSession} isOpen={isSidebarOpen} onClose={()=>setIsSidebarOpen(false)} />
        <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-white dark:bg-slate-950">
          {mode==='voice' && <VoiceAssistant onSend={sendViaOrchestrator} isLoading={isLoading} />}
          <AgentOrchestrator intent={lastTrace?.intent} traces={lastTrace?.traces} latencyMs={lastTrace?.latencyMs} />
          <ChatInterface messages={activeMessages} onSendMessage={(t)=>sendViaOrchestrator(t,'chat')} isLoading={isLoading} onClearChat={handleClearChat} onExportJSON={handleExportJSON} onExportTXT={handleExportTXT} />
        </main>
      </div>
    </div>
  );
}
