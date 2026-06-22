/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from "react";
import { Message } from "../types";
import { User, MessageSquare, Bot, ArrowRight, CircleAlert } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ConversationListProps {
  messages: Message[];
  interimTranscript: string;
  onSuggestionClick: (promptText: string) => void;
  suggestions: { text: string; category: string }[];
}

export default function ConversationList({
  messages,
  interimTranscript,
  onSuggestionClick,
  suggestions,
}: ConversationListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto scroll to the absolute end on new messages or transcripts
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, interimTranscript]);

  return (
    <div id="conversation-container" className="flex flex-col h-full bg-slate-900/60 rounded-2xl border border-slate-800 backdrop-blur-md overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-800 bg-slate-950/40">
        <MessageSquare className="w-5 h-5 text-blue-400" />
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-widest">Transcrição da Conversa</h3>
        {messages.length > 0 && (
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
            {messages.length} {messages.length === 1 ? "mensagem" : "mensagens"}
          </span>
        )}
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-[250px] max-h-[500px]">
        {messages.length === 0 && !interimTranscript && (
          <div className="flex flex-col items-center justify-center h-full text-center py-10 px-4">
            <Bot className="w-12 h-12 text-slate-700 mb-3 animate-pulse" />
            <p className="text-slate-400 font-medium text-sm">Nenhuma conversa ativa no momento.</p>
            <p className="text-slate-500 text-xs mt-1 max-w-xs leading-relaxed">
              Toca no círculo principal para iniciares o comando de voz, ou escolhe uma das sugestões abaixo.
            </p>

            {/* Quick Suggestions Inside Feed */}
            <div className="mt-6 w-full max-w-md grid grid-cols-1 gap-2 text-left">
              <span className="text-[10px] font-mono uppercase text-slate-500 tracking-wider mb-1 block pl-1">Algumas questões sugeridas:</span>
              {suggestions.slice(0, 3).map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => onSuggestionClick(suggestion.text)}
                  className="flex items-center justify-between text-xs py-2.5 px-3.5 rounded-xl bg-slate-800/40 border border-slate-800 hover:border-blue-500/40 hover:bg-blue-950/10 text-slate-300 hover:text-white transition-all duration-200 group text-left cursor-pointer"
                >
                  <span className="line-clamp-1">{suggestion.text}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-blue-400 transition-colors ml-2 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              layout
              className={`flex gap-3 max-w-[85%] ${
                message.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
              }`}
            >
              {/* Profile Ring */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 select-none ${
                  message.role === "user"
                    ? "bg-blue-600/35 text-blue-300 border border-blue-500/20"
                    : "bg-slate-800 text-sky-400/90 border border-slate-700"
                }`}
              >
                {message.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Text Balloon */}
              <div className="space-y-1">
                <div
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-md ${
                    message.role === "user"
                      ? "bg-blue-600/80 text-white rounded-tr-none border border-blue-500/30"
                      : "bg-slate-800/80 text-slate-150 rounded-tl-none border border-slate-700/60"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
                {/* Meta details */}
                <span
                  className={`text-[9px] font-mono text-slate-500 block ${
                    message.role === "user" ? "text-right" : "text-left"
                  }`}
                >
                  {message.timestamp}
                </span>
              </div>
            </motion.div>
          ))}

          {/* Real-time speech-to-text preview */}
          {interimTranscript && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3 max-w-[85%] ml-auto flex-row-reverse"
            >
              <div className="w-8 h-8 rounded-full bg-cyan-600/20 text-cyan-300 border border-cyan-500/20 flex items-center justify-center flex-shrink-0 animate-pulse">
                <User className="w-4 h-4" />
              </div>

              <div className="space-y-1">
                <div className="px-4 py-3 rounded-2xl rounded-tr-none bg-cyan-900/20 text-cyan-300 border border-cyan-500/25 shadow-sm italic text-sm">
                  <p className="line-clamp-4">{interimTranscript}...</p>
                </div>
                <span className="text-[9px] font-mono text-cyan-500 block text-right">Transcrição em tempo real</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Fallback Typing Input */}
      <div className="border-t border-slate-800 bg-slate-950/20 px-4 py-3 text-xs text-slate-500 flex items-center gap-2">
        <CircleAlert className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
        <span>Podes falar diretamente, ou usar uma das sugestões acima para simular a resposta em voz.</span>
      </div>
    </div>
  );
}
