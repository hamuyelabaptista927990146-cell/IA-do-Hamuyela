/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { AppStatus, Message } from "./types";
import { VOICE_OPTIONS, VOICE_SUGGESTIONS, playBase64Pcm } from "./utils";
import VoiceCircle from "./components/VoiceCircle";
import ConversationList from "./components/ConversationList";
import { 
  Volume2, 
  Trash2, 
  Settings2, 
  Info, 
  VolumeX, 
  Radio, 
  Speech, 
  HelpCircle,
  X,
  Sparkles,
  RefreshCw,
  Mic,
  MessageSquareOff
} from "lucide-react";

// Add declaration safely for window.webkitSpeechRecognition / SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function App() {
  const [status, setStatus] = useState<AppStatus>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  const [selectedVoice, setSelectedVoice] = useState<string>("Zephyr");
  const [ttsMode, setTtsMode] = useState<"gemini" | "browser">("gemini");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showConfig, setShowConfig] = useState<boolean>(false);

  // Audio References for Visualizer and State Controls
  const [activeAnalyser, setActiveAnalyser] = useState<AnalyserNode | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const activeAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const isSpeakingRef = useRef<boolean>(false);

  // Save/Load message logs
  useEffect(() => {
    const saved = localStorage.getItem("voice_assist_history");
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (e) {
        console.error("Error reading saved history:", e);
      }
    }
  }, []);

  const saveMessages = (updated: Message[]) => {
    setMessages(updated);
    localStorage.setItem("voice_assist_history", JSON.stringify(updated));
  };

  // Setup Web Speech API Voice Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = "pt-PT"; // default Portuguese

      rec.onstart = () => {
        setStatus("listening");
        setInterimTranscript("");
        setErrorMessage(null);
        stopCurrentModelAudio(); // Stop model voice output if starting new query
      };

      rec.onresult = (event: any) => {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (interim) {
          setInterimTranscript(interim);
        }

        if (final) {
          setInterimTranscript("");
          handleUserQuery(final);
        }
      };

      rec.onerror = (event: any) => {
        console.error("Speech Recognition Error:", event.error);
        if (event.error === "no-speech") {
          setErrorMessage("Nenhuma fala detetada. Tenta falar mais próximo do microfone.");
        } else if (event.error === "not-allowed") {
          setErrorMessage("Acesso ao microfone recusado. Por favor, concede permissões nas definições do navegador.");
        } else {
          setErrorMessage(`Erro ao capturar voz: ${event.error}`);
        }
        setStatus("error");
        cleanupMicrophone();
      };

      rec.onend = () => {
        // Only return to idle if we aren't already thinking or speaking
        setStatus((prev) => {
          if (prev === "listening") {
            cleanupMicrophone();
            return "idle";
          }
          return prev;
        });
      };

      recognitionRef.current = rec;
    } else {
      console.warn("Speech recognition is not fully supported in this environment / iframe.");
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
      cleanupMicrophone();
    };
  }, [selectedVoice, ttsMode]);

  // Safely stop any running audio
  const stopCurrentModelAudio = () => {
    if (activeAudioSourceRef.current) {
      try {
        activeAudioSourceRef.current.stop();
      } catch (e) {}
      activeAudioSourceRef.current = null;
    }
    // Browser voice
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    isSpeakingRef.current = false;
    setActiveAnalyser(null);
    setStatus("idle");
  };

  const cleanupMicrophone = () => {
    if (micStream) {
      micStream.getTracks().forEach((track) => track.stop());
      setMicStream(null);
    }
  };

  // Starts the interactive Voice mode
  const toggleVoiceMode = async () => {
    // If speaking or thinking or listening, tapping the button cancels/stops the interaction
    if (status === "listening") {
      try {
        recognitionRef.current?.stop();
      } catch (e) {}
      cleanupMicrophone();
      setStatus("idle");
      return;
    }

    if (status === "thinking" || status === "speaking") {
      stopCurrentModelAudio();
      return;
    }

    // Otherwise, start voice recording
    stopCurrentModelAudio();
    setErrorMessage(null);

    if (!recognitionRef.current) {
      // Browser doesn't support speech recognition, so alert user with typing simulation fallback
      setErrorMessage("O reconhecimento de voz nativo não está disponível neste navegador/iframe. Usa um das sugestões abaixo.");
      setStatus("error");
      return;
    }

    try {
      // Request micro permissions explicitly
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicStream(stream);

      recognitionRef.current.start();
    } catch (err: any) {
      console.error("Microphone access failed:", err);
      setErrorMessage("Não foi possível aceder ao microfone. Verifica as permissões.");
      setStatus("error");
    }
  };

  // Process the user question (from voice or suggestion prompt click)
  const handleUserQuery = async (queryText: string) => {
    if (!queryText.trim()) return;

    // Build user message
    const userMessage: Message = {
      id: `m-${Date.now()}-u`,
      role: "user",
      content: queryText,
      timestamp: new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    };

    const newHistory = [...messages, userMessage];
    saveMessages(newHistory);
    setStatus("thinking");
    cleanupMicrophone();

    try {
      // Call server backend chat pipeline
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newHistory.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro de rede: ${response.statusText}`);
      }

      const data = await response.json();
      const assistantText = data.text || "Desculpe, não consegui obter resposta.";

      // Build model reply message
      const assistantMessage: Message = {
        id: `m-${Date.now()}-a`,
        role: "assistant",
        content: assistantText,
        timestamp: new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      };

      const finalHistory = [...newHistory, assistantMessage];
      saveMessages(finalHistory);

      if (isMuted) {
        setStatus("idle");
      } else {
        await playVoiceOutput(assistantText);
      }
    } catch (e: any) {
      console.error("Error communicating with endpoint:", e);
      setErrorMessage("Erro ao processar áudio de resposta da IA.");
      setStatus("error");
    }
  };

  // Convert the text response into real audio output
  const playVoiceOutput = async (text: string) => {
    setStatus("speaking");
    isSpeakingRef.current = true;

    if (ttsMode === "gemini") {
      try {
        const voiceConfig = VOICE_OPTIONS.find((v) => v.name.includes(selectedVoice) || v.voiceName === selectedVoice);
        const voiceName = voiceConfig ? voiceConfig.voiceName : "Zephyr";

        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice: voiceName }),
        });

        if (!response.ok) {
          throw new Error("Gemini TTS high-quality service failed");
        }

        const data = await response.json();
        if (data.audio) {
          // Play PCM audio base64 payload nicely
          const { source, analyser } = await playBase64Pcm(data.audio, 24000, () => {
            // Callback when speech ends
            setStatus("idle");
            isSpeakingRef.current = false;
            setActiveAnalyser(null);
          });

          activeAudioSourceRef.current = source;
          setActiveAnalyser(analyser);
        } else {
          throw new Error("No payload found");
        }
      } catch (err) {
        console.warn("Gemini premium voice failed, falling back to local SpeechSynthesis:", err);
        playBrowserTTS(text);
      }
    } else {
      playBrowserTTS(text);
    }
  };

  // Fallback engine: HTML5 Speech Synthesis
  const playBrowserTTS = (text: string) => {
    if (!window.speechSynthesis) {
      setStatus("idle");
      return;
    }

    // Cancel any active utterance
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Attempt local Portuguese voice resolution matching
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find((v) => v.lang.startsWith("pt")) || voices[0];
    if (ptVoice) {
      utterance.voice = ptVoice;
    }
    utterance.lang = "pt-PT";
    utterance.rate = 1.0;

    utterance.onend = () => {
      setStatus("idle");
      isSpeakingRef.current = false;
    };

    utterance.onerror = (e) => {
      console.error("TTS error:", e);
      setStatus("idle");
      isSpeakingRef.current = false;
    };

    window.speechSynthesis.speak(utterance);
  };

  // Interactive triggers from suggestions buttons
  const handleSuggestionClick = (promptText: string) => {
    stopCurrentModelAudio();
    handleUserQuery(promptText);
  };

  // Clean log
  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem("voice_assist_history");
  };

  return (
    <div id="assistente-app-root" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600/30 selection:text-blue-200 antialiased overflow-x-hidden relative">
      
      {/* Dynamic Animated Atmospheric blue orbs behind elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-700/15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-700/10 blur-[130px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full px-6 py-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/10">
            <Radio className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
              Assistente de Voz IA
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20 font-medium tracking-wide uppercase">Voz Inteligente</span>
            </h1>
            <p className="text-[10.5px] text-slate-400">Canal de conversação em tempo real</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Audio toggle button */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`p-2 rounded-lg border transition-all duration-200 cursor-pointer ${
              isMuted 
                ? "bg-red-500/10 border-red-500/30 text-red-400" 
                : "bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white"
            }`}
            title={isMuted ? "Áudio Silenciado" : "Falar Ativo"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Configuration Settings Button */}
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`p-2 rounded-lg border transition-all duration-200 cursor-pointer ${
              showConfig 
                ? "bg-blue-600/10 border-blue-500/30 text-blue-400" 
                : "bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white"
            }`}
            title="Configurações de Voz"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Container spacing */}
      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 py-8 lg:p-8 flex flex-col md:grid md:grid-cols-12 gap-6 lg:gap-8 overflow-hidden">
        
        {/* LEFT COLUMN: Voice interaction trigger with circle (ChatGPT Style visual prominence) */}
        <div className="md:col-span-6 flex flex-col items-center justify-center p-4 lg:p-6 bg-slate-900/35 border border-slate-800/60 rounded-3xl backdrop-blur-md relative overflow-hidden min-h-[420px] shadow-xl">
          <div className="absolute top-4 left-4 flex items-center gap-1 text-[11px] text-slate-500 font-mono tracking-wider uppercase font-medium">
            <Speech className="w-3.5 h-3.5 text-blue-500" />
            <span>Módulo Interactividade</span>
          </div>

          {/* Voice Circle ChatGPT voice mode inspired wrapper */}
          <div className="flex-1 flex flex-col items-center justify-center mt-6">
            <VoiceCircle
              status={status}
              onClick={toggleVoiceMode}
              analyser={activeAnalyser}
              microphoneStream={micStream}
            />
          </div>

          {/* Short guidance */}
          <div className="mt-4 text-center max-w-sm px-2">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-widest mb-1.5 flex items-center justify-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              Sintonia de Alta Qualidade
            </h4>
            <p className="text-[11px] text-slate-400 leading-normal">
              O círculo adapta-se dinamicamente conforme falas ou ouves o assistente inteligente Gemini.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: Conversation log transcripts & tools instructions */}
        <div className="md:col-span-6 flex flex-col gap-6 h-full min-h-[450px]">
          
          {/* Quick Config Modal banner */}
          {showConfig && (
            <div className="p-4 bg-slate-900/90 border border-blue-500/25 rounded-2xl shadow-xl space-y-3 relative overflow-hidden animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Settings2 className="w-3.5 h-3.5 text-blue-400" /> Definições do Sintetizador
                </span>
                <button 
                  onClick={() => setShowConfig(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* TTS selection */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-slate-400">Motor de Geração de Voz (TTS)</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => setTtsMode("gemini")}
                    className={`text-xs py-1.5 px-3 rounded-lg font-medium border text-center transition-all cursor-pointer ${
                      ttsMode === "gemini"
                        ? "bg-blue-600/10 border-blue-500/40 text-blue-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300"
                    }`}
                  >
                    Gemini Premium (Estúdio)
                  </button>
                  <button
                    onClick={() => setTtsMode("browser")}
                    className={`text-xs py-1.5 px-3 rounded-lg font-medium border text-center transition-all cursor-pointer ${
                      ttsMode === "browser"
                        ? "bg-blue-600/10 border-blue-500/40 text-blue-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300"
                    }`}
                  >
                    Sintetizador do Browser
                  </button>
                </div>
              </div>

              {/* Character Voice options */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-slate-400">Escolha da Voz IA (Suportado no Gemini Premium)</label>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-1.5">
                  {VOICE_OPTIONS.map((voice) => (
                    <button
                      key={voice.id}
                      onClick={() => setSelectedVoice(voice.voiceName)}
                      className={`text-[11px] p-2 rounded-xl text-left border transition-all cursor-pointer ${
                        selectedVoice === voice.voiceName
                          ? "bg-blue-600/15 border-blue-500/50 text-white"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300 hover:border-slate-750"
                      }`}
                    >
                      <span className="font-semibold block">{voice.name}</span>
                      <span className="text-[9px] text-slate-500 line-clamp-1 block">{voice.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Quick Alert Display */}
          {errorMessage && (
            <div className="p-3 bg-red-950/40 border border-red-500/25 text-red-200 text-xs rounded-xl flex items-start gap-2.5 animate-shake">
              <Info className="w-4 h-4 text-red-400 select-none flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold text-red-300 block mb-0.5">Nota Importante</span>
                <p className="leading-relaxed text-red-300/90">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Feed Container */}
          <div className="flex-1 flex flex-col min-h-0">
            <ConversationList
              messages={messages}
              interimTranscript={interimTranscript}
              onSuggestionClick={handleSuggestionClick}
              suggestions={VOICE_SUGGESTIONS}
            />
          </div>

          {/* Operations Actions bar */}
          {messages.length > 0 && (
            <div className="flex justify-end gap-2.5">
              <button
                onClick={clearHistory}
                className="text-xs py-2 px-3.5 rounded-xl border border-slate-800 text-slate-400 hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/5 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar Transcrições</span>
              </button>
            </div>
          )}

        </div>
      </main>

      {/* Footer information */}
      <footer className="relative z-10 w-full mt-auto py-4 px-6 border-t border-slate-900 bg-slate-950 text-center flex flex-col sm:flex-row items-center justify-between text-slate-500 text-[10.5px]">
        <div className="flex items-center gap-1 justify-center sm:justify-start">
          <span>Desenvolvido com IA Avançada Gemini</span>
          <span className="text-slate-700 select-none">•</span>
          <span className="text-slate-400 font-medium">Idioma Ativo: Português</span>
        </div>
        <span className="mt-1 sm:mt-0 text-[10px] uppercase font-mono tracking-widest text-slate-600">Assistente de Voz IA v1.2</span>
      </footer>
    </div>
  );
}
