# Multi-Agent Voice-Activated Mobile Assistant — Orchestrator Guide

> Stack: **Frontend** React 19 + Vite 6 + Capacitor 8 (Android) | **Backend** Node.js + Express 4 + @google/genai | **Build** `tsx` (lightweight, Termux-friendly)

## 1 — Requirement Analysis & System Architecture

**Goal:** Voice-activated mobile assistant that works in a phone/Termux terminal with minimal deps.

```
[ User ] ⇄ [ React UI + VoiceAssistant ]
              │  Web Speech API (STT/TTS, no native deps)
              │  fetch /api/orchestrator/run  (REST)
              ▼
[ Express Orchestrator ] ── traces ──► [ Agent 1: Intent Classifier (regex, no LLM) ]
                          ├──────────► [ Agent 2: Responder (Gemini 2.0 Flash) ]
                          └──────────► [ Agent 3: Summarizer (voice mode, short TTS) ]
              │  validates env, handles CORS, serves Vite / dist
              ▼
[ Gemini API ] + [ Static dist + Capacitor Android shell ]
```

**Data Flow**
1. User taps mic → `webkitSpeechRecognition` → transcript → `POST /api/orchestrator/run {prompt, history, mode:'voice'}`
2. Orchestrator: `intent → responder (systemInstruction per intent) → summarizer if voice+long` → `{text, intent, traces, latencyMs}`
3. Client appends `ai` message, fires `app:speak` event → `speechSynthesis.speak(text)` with selected voice.
4. Chat mode uses same endpoint with `mode:'chat'` (no summarizer).

**Why multi-agent?** Keeps latency low (intent is local), specializes prompts per domain (coding/weather/action), and isolates TTS formatting.

---

## 2 — Dependency Setup (Linux / Android Termux)

All commands are POSIX-sh compatible.

```bash
# 0) Clone & enter
git clone <repo> && cd Ai-web-

# 1) Node (Termux: pkg install nodejs-lts)
node -v && npm -v   # need Node >=18

# 2) Install deps (lightweight, no Python needed)
npm install

# 3) Env
cp .env.example .env
# edit .env and set GEMINI_API_KEY (get at https://aistudio.google.com/apikey)
nano .env  # or: echo "GEMINI_API_KEY=..." > .env

# 4) Run dev (Vite via Express, HMR on 0.0.0.0:3000)
npm run dev
# open http://localhost:3000  (preview host is auto-allowed via CORS + 0.0.0.0)

# 5) Typecheck & build
npm run lint        # tsc --noEmit
npm run build       # vite build + esbuild server.cjs -> dist/

# 6) Android (optional, requires Android SDK)
npm run build:android
npx cap open android   # or: npx cap run android
```

**Exact install commands from package.json:**
```bash
npm install express dotenv @google/genai @capacitor/core @capacitor/android @capacitor/cli
npm install -D typescript @types/express @types/node vite @vitejs/plugin-react @tailwindcss/vite tailwindcss tsx esbuild
```
Already in `package.json` — `npm install` is enough. No `flutter pub add`, no native TTS SDK needed (Web Speech API).

---

## 3 — Backend Implementation

**File: `server.ts`** — single entry, RESTful, env-managed.

Key endpoints:

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/health | liveness, model, hasKey |
| GET | /api/config | client feature flags |
| POST | /api/chat | legacy chat (direct LLM) |
| POST | /api/orchestrator/run | **multi-agent**: `{prompt, history, mode}` → `{text,intent,traces}` |
| POST | /api/voice/synthesize | validation stub (client TTS) |

Env handling: `dotenv/config` at top, `validateEnv()` warns if `GEMINI_API_KEY` missing, lazy `getAI()` throws 503 until set. Model via `GEMINI_MODEL` env (default `gemini-2.0-flash`). CORS `*` for Capacitor preview, `express.json({limit:'1mb'})`, Vite middleware in dev else static `dist`.

Production code is in `server.ts` — no placeholders, fully runnable with `tsx server.ts`.

---

## 4 — Frontend Implementation

**Files:**
- `src/hooks/useVoice.ts` — `useSpeechRecognition` + `useSpeechSynthesis` (Web Speech API, no deps)
- `src/components/VoiceAssistant.tsx` — mic button (pulse when listening), interim transcript, auto-speak toggle, voice selector, error UI
- `src/components/AgentOrchestrator.tsx` — shows intent + agent traces + latency
- `src/App.tsx` — session store (localStorage), `mode` toggle (Chat/Voice), `sendViaOrchestrator()` unified fetch, `app:speak` event bridge

**State & Error Handling:**
- `isLoading` disables input/mic; `try/catch` around fetch → error message as `ai` bubble
- `supported` flag → fallback banner if `SpeechRecognition` missing
- `speechSynthesis.cancel()` before new utterance; `voiceschanged` listener for Android voice list
- Empty transcript ignored; `history` sent for context; new session auto-created on first message

---

## 5 — Troubleshooting Guide (Mobile / Termux)

### Error 1: `GEMINI_API_KEY not configured` or 503
**Symptom:** `Failed to generate response` toast, `/api/health` shows `hasKey:false`.
**Cause:** `.env` not loaded or file missing (Termux `nano` path wrong).
**Fix:**
```bash
cat .env  # verify file exists in project root, not android/
grep GEMINI_API_KEY .env
# if empty:
echo "GEMINI_API_KEY=AIza..." > .env
echo "GEMINI_MODEL=gemini-2.0-flash" >> .env
# restart server (Ctrl+C then):
npm run dev
curl http://localhost:3000/api/health
```

### Error 2: Mic button says "not supported" / no voices / build fails on Android
**Symptom (a):** "Speech recognition not supported" banner on Firefox/WebView. **Symptom (b):** `vite: permission denied` or `tsx not found` on Termux.
**Fix:**
```bash
# (a) Use Chrome/Edge or Capacitor WebView (which uses Chrome engine). Check:
# In browser console: 'webkitSpeechRecognition' in window
# If false → switch browser. Voices empty until user gesture: tap mic once, voices populate.

# (b) Termux deps:
pkg update && pkg install nodejs-lts clang make python
npm install   # reinstall
npm run lint  # verify tsc passes
# If cap sync fails (no SDK), just run web:
npm run dev   # works without Android SDK
```

---

## Quick Verify

```bash
curl -X POST http://localhost:3000/api/orchestrator/run \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Write a hello world in Python","mode":"chat"}'
```

Expected: `{"text":"...","intent":"coding","traces":[...]}`

