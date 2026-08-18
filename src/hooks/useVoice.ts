import { useEffect, useRef, useState, useCallback } from 'react';

// Lightweight Termux-friendly voice hooks using Web Speech API
// No extra npm deps. Falls back gracefully where API is unavailable.

export function useSpeechRecognition(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [interim, setInterim] = useState('');
  const recRef = useRef<any>(null);

  useEffect(() => {
    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = navigator.language || 'en-US';
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.onresult = (e: any) => {
      let interimTxt = '';
      let finalTxt = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalTxt += r[0].transcript;
        else interimTxt += r[0].transcript;
      }
      setInterim(interimTxt);
      if (finalTxt) { setInterim(''); onResult(finalTxt.trim()); }
    };
    recRef.current = rec;
  }, [onResult]);

  const start = useCallback(() => {
    if (!recRef.current) return;
    try { recRef.current.start(); } catch {}
  }, []);
  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch {}
  }, []);

  return { listening, supported, interim, start, stop };
}

export function useSpeechSynthesis() {
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');

  useEffect(() => {
    const load = () => {
      const v = window.speechSynthesis?.getVoices() || [];
      setVoices(v);
      if (!selectedVoice && v.length) setSelectedVoice(v[0].voiceURI);
    };
    load();
    window.speechSynthesis?.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', load);
  }, [selectedVoice]);

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = voices.find(x => x.voiceURI === selectedVoice);
    if (v) u.voice = v;
    u.rate = 1; u.pitch = 1;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }, [voices, selectedVoice]);

  const cancel = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  return { speaking, voices, selectedVoice, setSelectedVoice, speak, cancel, supported: 'speechSynthesis' in window };
}
