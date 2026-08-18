import React from 'react';
import { Brain, Zap, Mic, Timer } from 'lucide-react';

interface Trace { agent: string; status: string; latencyMs: number; output: string; }
export const AgentOrchestrator: React.FC<{ intent?: string; traces?: Trace[]; latencyMs?: number }> = ({ intent, traces, latencyMs }) => {
  if (!traces || traces.length===0) return null;
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 md:px-8 py-3">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 flex flex-wrap gap-2 items-center text-xs">
        <span className="inline-flex items-center gap-1 font-semibold"><Brain size={14}/> Orchestrator</span>
        {intent && <span className="px-2 py-1 rounded-full bg-blue-600 text-white">{intent}</span>}
        {typeof latencyMs==='number' && <span className="inline-flex items-center gap-1 text-slate-500"><Timer size={12}/>{latencyMs}ms</span>}
        <span className="ml-auto hidden sm:inline-flex items-center gap-1 text-slate-500"><Zap size={12}/> intent → responder → summarizer</span>
        <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
          {traces.map(t=>(
            <div key={t.agent} className={`p-2 rounded-lg border text-xs ${t.status==='ok'?'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700':'bg-red-50 border-red-200'}`}>
              <div className="font-medium capitalize flex items-center gap-1">{t.agent} <span className="text-slate-400">· {t.latencyMs}ms</span></div>
              <div className="truncate text-slate-600 dark:text-slate-300 mt-1">{t.output.slice(0,80)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
