import React, { useCallback, useState } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Loader2, Radio } from 'lucide-react';
import { useSpeechRecognition, useSpeechSynthesis } from '../hooks/useVoice';

interface Props {
  onSend: (text: string, mode: 'voice' | 'chat') => Promise<string | void>;
  isLoading: boolean;
}

export const VoiceAssistant: React.FC<Props> = ({ onSend, isLoading }) => {
  const [lastTranscript, setLastTranscript] = useState('');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { speak, cancel, speaking, supported: ttsSupported, voices, selectedVoice, setSelectedVoice } = useSpeechSynthesis();

  const handleResult = useCallback(async (text: string) => {
    setLastTranscript(text);
    setError(null);
    try {
      const reply: any = await onSend(text, 'voice');
      // onSend returns void in App; we also handle orchestrator direct: if reply is string, speak it
      if (typeof reply === 'string' && reply && autoSpeak && ttsSupported) speak(reply);
    } catch (e: any) {
      setError(e?.message || 'Voice request failed');
    }
  }, [onSend, autoSpeak, speak, ttsSupported]);

  const { listening, supported, interim, start, stop } = useSpeechRecognition(handleResult);

  // Expose speak for external triggers (parent can call via custom event)
  React.useEffect(() => {
    const h = (e: any) => { if (e.detail && autoSpeak) speak(e.detail); };
    window.addEventListener('app:speak' as any, h as any);
    return () => window.removeEventListener('app:speak' as any, h as any);
  }, [speak, autoSpeak]);

  if (!supported) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-200">
        Speech recognition not supported in this browser. Use Chrome/Edge on Android or desktop Chrome. You can still type.
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4 space-y-4">
      <div className="flex flex-col items-center gap-4 py-6">
        <button
          onClick={listening ? stop : start}
          disabled={isLoading}
          className={`w-28 h-28 rounded-full flex items-center justify-center shadow-xl transition-all border-4
            ${listening ? 'bg-red-500 border-red-300 animate-pulse text-white' : 'bg-blue-600 border-blue-200 hover:bg-blue-700 text-white'}
            disabled:opacity-50`}
          aria-label={listening ? 'Stop listening' : 'Start listening'}
        >
          {isLoading ? <Loader2 className="animate-spin" size={36} /> : listening ? <MicOff size={36} /> : <Mic size={36} />}
        </button>
        <div className="text-center">
          <p className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2 justify-center">
            {listening && <Radio size={16} className="text-red-500 animate-pulse" />}
            {isLoading ? 'Thinking...' : listening ? 'Listening...' : 'Tap to speak'}
          </p>
          <p className="text-xs text-slate-500 mt-1">{interim || lastTranscript || 'Say: "Summarize this" or "Write a function..."'}</p>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/40 px-3 py-2 rounded-lg">{error}</p>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={autoSpeak} onChange={e => setAutoSpeak(e.target.checked)} className="accent-blue-600" />
          Auto-speak replies
        </label>
        <div className="flex items-center gap-2">
          <button onClick={() => speaking ? cancel() : null} className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            {speaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <select value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)} className="text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 max-w-[180px]">
            {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
          </select>
        </div>
      </div>

      <div className="text-[11px] text-slate-400 text-center">Uses Web Speech API (no extra native deps). For Termux: run in Chrome. TTS via speechSynthesis.</div>
    </div>
  );
};
