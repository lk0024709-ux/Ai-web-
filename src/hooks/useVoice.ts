import { useEffect, useRef, useState, useCallback } from 'react';

// Barge-in + memory-leak safe hooks for Capacitor / mobile browsers

export function useSpeechRecognition(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [interim, setInterim] = useState('');
  const recRef = useRef<any>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = navigator.language || 'en-US';
    rec.maxAlternatives = 1;

    const onStart = () => setListening(true);
    const onEnd = () => setListening(false);
    const onError = () => setListening(false);
    const onResultHandler = (e: any) => {
      let interimTxt = '';
      let finalTxt = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalTxt += r[0].transcript;
        else interimTxt += r[0].transcript;
      }
      setInterim(interimTxt);
      if (finalTxt) { setInterim(''); onResultRef.current(finalTxt.trim()); }
    };

    rec.addEventListener('start', onStart);
    rec.addEventListener('end', onEnd);
    rec.addEventListener('error', onError);
    rec.addEventListener('result', onResultHandler);
    recRef.current = rec;

    return () => {
      rec.removeEventListener('start', onStart);
      rec.removeEventListener('end', onEnd);
      rec.removeEventListener('error', onError);
      rec.removeEventListener('result', onResultHandler);
      try { rec.abort(); } catch {}
      recRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    // === BARGE-IN: cut any ongoing TTS immediately ===
    try { window.speechSynthesis?.cancel(); } catch {}
    if (!recRef.current) return;
    try { recRef.current.start(); } catch (e: any) {
      // Chrome throws if already started; abort + retry
      try { recRef.current.abort(); recRef.current.start(); } catch {}
    }
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
    if (!('speechSynthesis' in window) || !text) return;
    try { window.speechSynthesis.cancel(); } catch {}
    const u = new SpeechSynthesisUtterance(text);
    const v = voices.find(x => x.voiceURI === selectedVoice);
    if (v) u.voice = v;
    u.rate = 1; u.pitch = 1; u.volume = 1;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }, [voices, selectedVoice]);

  const cancel = useCallback(() => {
    try { window.speechSynthesis?.cancel(); } catch {}
    setSpeaking(false);
  }, []);

  // cleanup on unmount to avoid leak on Capacitor
  useEffect(() => () => { try { window.speechSynthesis?.cancel(); } catch {} }, []);

  return { speaking, voices, selectedVoice, setSelectedVoice, speak, cancel, supported: 'speechSynthesis' in window };
}
