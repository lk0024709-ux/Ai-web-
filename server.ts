/**
 * Multi-Agent Orchestrator - Production Server
 * Frontend: React 19 + Vite 6 + Capacitor (Android) | Backend: Express 4 + @google/genai
 * Lightweight & Termux-friendly: single tsx entry, no heavy native deps.
 */
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

// ---------- Env Validation ----------
const REQUIRED_ENV = ['GEMINI_API_KEY'] as const;
function validateEnv() {
  const missing = REQUIRED_ENV.filter(k => !process.env[k]);
  if (missing.length) {
    console.warn(`[env] Missing ${missing.join(', ')} - /api/chat will return 503 until set.`);
    console.warn(`[env] Create .env with GEMINI_API_KEY=... (see .env.example)`);
  }
}
validateEnv();

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

// ---------- Google GenAI Client (lazy) ----------
function getAI() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not configured');
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
  });
}

// ---------- Agent Definitions ----------
type AgentName = 'intent' | 'responder' | 'summarizer';
interface OrchestratorRequest {
  prompt: string;
  history?: { role: 'user' | 'ai'; text: string }[];
  mode?: 'chat' | 'voice';
  voice?: string; // BCP47
}

interface AgentTrace {
  agent: AgentName;
  status: 'ok' | 'error';
  latencyMs: number;
  output: string;
}

// Intent classifier - lightweight, no LLM call if regex matches
function classifyIntent(prompt: string): { intent: string; confidence: number } {
  const p = prompt.toLowerCase();
  if (/(weather|temperature|forecast)/.test(p)) return { intent: 'weather', confidence: 0.9 };
  if (/(code|program|function|debug|error)/.test(p)) return { intent: 'coding', confidence: 0.85 };
  if (/(summarize|tldr|explain)/.test(p)) return { intent: 'summarize', confidence: 0.8 };
  if (/(navigate|open|call|message)/.test(p)) return { intent: 'action', confidence: 0.75 };
  return { intent: 'general', confidence: 0.6 };
}

// ---------- Express App ----------
async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Middleware
  app.use(express.json({ limit: '1mb' }));
  // CORS for Capacitor + preview host
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // ---------- Health & Config ----------
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, model: GEMINI_MODEL, hasKey: !!process.env.GEMINI_API_KEY, uptime: process.uptime() });
  });

  app.get('/api/config', (_req, res) => {
    res.json({
      model: GEMINI_MODEL,
      features: { voice: true, orchestrator: true, stt: 'WebSpeechAPI (client)', tts: 'WebSpeechAPI + server fallback' }
    });
  });

  // ---------- Core Chat (RESTful) ----------
  app.post('/api/chat', async (req, res) => {
    try {
      const { prompt, history = [] } = req.body as OrchestratorRequest;
      if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'prompt:string is required' });
      if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'GEMINI_API_KEY not configured on server' });

      const ai = getAI();
      const formattedHistory = (history || []).map(m => ({
        role: m.role === 'ai' ? 'model' as const : 'user' as const,
        parts: [{ text: m.text }]
      }));

      const chat = ai.chats.create({
        model: GEMINI_MODEL,
        config: { systemInstruction: 'You are a helpful, smart, concise AI assistant for mobile. Keep answers under 200 words unless asked.' },
        history: formattedHistory
      });
      const response = await chat.sendMessage({ message: prompt });
      res.json({ text: response.text, model: GEMINI_MODEL });
    } catch (e: any) {
      console.error('[api/chat]', e?.message || e);
      res.status(500).json({ error: 'Failed to generate response', detail: e?.message?.slice(0, 300) });
    }
  });

  // ---------- Multi-Agent Orchestrator ----------
  // POST /api/orchestrator/run
  // Orchestrates: intent -> responder -> (optional) summarizer
  app.post('/api/orchestrator/run', async (req, res) => {
    const start = Date.now();
    const traces: AgentTrace[] = [];
    try {
      const { prompt, history = [], mode = 'chat' } = req.body as OrchestratorRequest;
      if (!prompt) return res.status(400).json({ error: 'prompt required' });
      if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'GEMINI_API_KEY not configured' });

      const ai = getAI();

      // Agent 1: Intent
      const t1 = Date.now();
      const intent = classifyIntent(prompt);
      traces.push({ agent: 'intent', status: 'ok', latencyMs: Date.now() - t1, output: JSON.stringify(intent) });

      // Agent 2: Responder (main LLM)
      const t2 = Date.now();
      const systemMap: Record<string, string> = {
        coding: 'You are a senior coding assistant. Provide complete, functional code blocks.',
        weather: 'You are a weather assistant. If no live data, explain you need an integration.',
        summarize: 'You are a summarizer. Be concise and bullet-driven.',
        action: 'You are a mobile assistant. Respond with actionable steps for Android/Capacitor.',
        general: 'You are a helpful mobile AI assistant. Be concise.'
      };
      const sys = systemMap[intent.intent] || systemMap.general;
      const fullSystem = `${sys} Mode:${mode}. User intent:${intent.intent}.`;

      const formattedHistory = history.map(m => ({
        role: m.role === 'ai' ? 'model' as const : 'user' as const,
        parts: [{ text: m.text }]
      }));
      const chat = ai.chats.create({ model: GEMINI_MODEL, config: { systemInstruction: fullSystem }, history: formattedHistory });
      const llmRes = await chat.sendMessage({ message: prompt });
      const mainText = llmRes.text || '';
      traces.push({ agent: 'responder', status: 'ok', latencyMs: Date.now() - t2, output: mainText.slice(0, 400) });

      // Agent 3: Summarizer (only for long responses or voice mode)
      let finalText = mainText;
      if (mode === 'voice' && mainText.length > 400) {
        const t3 = Date.now();
        try {
          const sum = await ai.chats.create({
            model: GEMINI_MODEL,
            config: { systemInstruction: 'Summarize for voice TTS: 1-2 sentences, natural speech, no markdown.' }
          }).sendMessage({ message: `Summarize for voice: ${mainText}` });
          finalText = sum.text || mainText;
          traces.push({ agent: 'summarizer', status: 'ok', latencyMs: Date.now() - t3, output: finalText.slice(0, 400) });
        } catch (e: any) {
          traces.push({ agent: 'summarizer', status: 'error', latencyMs: Date.now() - t3, output: e.message });
        }
      }

      res.json({
        text: finalText,
        intent: intent.intent,
        traces,
        latencyMs: Date.now() - start,
        ttsHint: mode === 'voice' ? 'Use Web Speech API on client to speak this text' : undefined
      });
    } catch (e: any) {
      console.error('[orchestrator]', e);
      res.status(500).json({ error: 'Orchestrator failed', detail: e?.message?.slice(0, 300), traces });
    }
  });

  // ---------- TTS Fallback (server just returns text; client does synthesis) ----------
  app.post('/api/voice/synthesize', async (req, res) => {
    const { text, voice } = req.body as { text: string; voice?: string };
    if (!text) return res.status(400).json({ error: 'text required' });
    // In production you would proxy to Google Cloud TTS / ElevenLabs here.
    // Lightweight fallback: client-side Web Speech API - server just validates & returns.
    res.json({ text, voice: voice || 'default', engine: 'client-web-speech', hint: 'Use speechSynthesis.speak() on client' });
  });

  // ---------- Vite (dev) / Static (prod) ----------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[orchestrator] Server on http://0.0.0.0:${PORT} model=${GEMINI_MODEL}`);
  });
}

startServer().catch(e => { console.error(e); process.exit(1); });
