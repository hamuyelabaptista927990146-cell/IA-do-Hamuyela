/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, MicOff, Sparkles, Volume2, Search, AlertCircle } from "lucide-react";
import { AppStatus } from "../types";

interface VoiceCircleProps {
  status: AppStatus;
  onClick: () => void;
  analyser: AnalyserNode | null;
  microphoneStream: MediaStream | null;
}

export default function VoiceCircle({ status, onClick, analyser, microphoneStream }: VoiceCircleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const internalAnalyserRef = useRef<AnalyserNode | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);

  // Setup live microphone analyzer if listening
  useEffect(() => {
    if (status === "listening" && microphoneStream) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        const source = audioCtx.createMediaStreamSource(microphoneStream);
        const micAnalyser = audioCtx.createAnalyser();
        micAnalyser.fftSize = 64;
        source.connect(micAnalyser);
        
        internalAnalyserRef.current = micAnalyser;
        micCtxRef.current = audioCtx;
      } catch (err) {
        console.error("Error building mic analyzer:", err);
      }
    } else {
      // Clean up mic analyzer
      if (micCtxRef.current) {
        try {
          micCtxRef.current.close();
        } catch (e) {}
        micCtxRef.current = null;
      }
      internalAnalyserRef.current = null;
    }

    return () => {
      if (micCtxRef.current) {
        try {
          micCtxRef.current.close();
        } catch (e) {}
      }
    };
  }, [status, microphoneStream]);

  // Audio simulation/real rendering loops on HTML5 Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth * window.devicePixelRatio;
        canvas.height = parent.clientHeight * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    let phase = 0;

    const draw = () => {
      const w = canvas.width / window.devicePixelRatio;
      const h = canvas.height / window.devicePixelRatio;
      const originX = w / 2;
      const originY = h / 2;
      const maxRadius = Math.min(w, h) / 2.3;

      ctx.clearRect(0, 0, w, h);

      // Determine the active analyzer (either playback analyser passed as prop, or mic analyser)
      const activeAnalyser = analyser || internalAnalyserRef.current;
      let amplitude = 0.15;
      let frequencyArray: Uint8Array | null = null;

      if (activeAnalyser) {
        const bufferLength = activeAnalyser.frequencyBinCount;
        frequencyArray = new Uint8Array(bufferLength);
        activeAnalyser.getByteFrequencyData(frequencyArray);

        // Calculate average volume/amplitude
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += frequencyArray[i];
        }
        amplitude = sum / bufferLength / 255;
        // Normalise amplitude minimum and boost nices waves
        amplitude = Math.max(0.1, amplitude * 1.8);
      } else {
        // Mock idle or organic heartbeat wave amplitudes
        if (status === "idle") {
          amplitude = 0.08 + Math.sin(phase * 2) * 0.02;
        } else if (status === "thinking") {
          amplitude = 0.12 + Math.cos(phase * 4) * 0.04;
        } else if (status === "speaking") {
          // Speak wave simulation if real context is missing
          amplitude = 0.18 + Math.sin(phase * 8) * 0.1;
        }
      }

      phase += 0.03;

      // Draw gorgeous layered glow bubbles and orbits depending on status
      if (status === "thinking") {
        // Draw rotating cyber-halos
        ctx.strokeStyle = "rgba(56, 189, 248, 0.45)"; // sky-400
        ctx.lineWidth = 2;
        ctx.shadowBlur = 15;
        ctx.shadowColor = "rgba(14, 165, 233, 0.5)"; // sky-500

        // External halo
        ctx.beginPath();
        ctx.arc(originX, originY, maxRadius * 0.9, phase * 2, phase * 2 + Math.PI * 1.5);
        ctx.stroke();

        // Inner halo counter-rotating
        ctx.strokeStyle = "rgba(96, 165, 250, 0.6)"; // blue-400
        ctx.beginPath();
        ctx.arc(originX, originY, maxRadius * 0.72, -phase * 3, -phase * 3 + Math.PI * 1.22);
        ctx.stroke();

        // Core glow
        const grad = ctx.createRadialGradient(originX, originY, 0, originX, originY, maxRadius * 0.5);
        grad.addColorStop(0, "rgba(29, 78, 216, 0.6)"); // blue-700
        grad.addColorStop(0.7, "rgba(59, 130, 246, 0.2)"); // blue-500
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = grad;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(originX, originY, maxRadius * 0.5, 0, Math.PI * 2);
        ctx.fill();

      } else {
        // Waveform/Fluid style for idle/listening/speaking
        const numWaves = 4;
        const colors = [
          "rgba(14, 165, 233, 0.3)",  // Sky blue
          "rgba(59, 130, 246, 0.35)", // Royal blue
          "rgba(6, 182, 212, 0.4)",   // Cyan
          "rgba(99, 102, 241, 0.5)",  // Indigo-500
        ];

        ctx.shadowBlur = 18;
        ctx.shadowColor = "rgba(56, 189, 248, 0.6)";

        for (let wIdx = 0; wIdx < numWaves; wIdx++) {
          ctx.beginPath();
          ctx.strokeStyle = colors[wIdx];
          ctx.lineWidth = 1.5 + (numWaves - wIdx) * 0.5;

          const waveFactor = 0.5 + wIdx * 0.15;
          const pointsCount = 120;

          for (let i = 0; i <= pointsCount; i++) {
            const angle = (i / pointsCount) * Math.PI * 2;
            
            // Generate standard wave deformations
            let offset = 0;
            if (status === "listening" || status === "speaking") {
              const frequencyIndex = Math.floor((i % (pointsCount / 2)) / (pointsCount / 2) * (frequencyArray?.length || 10));
              const dataVal = frequencyArray ? frequencyArray[frequencyIndex] / 255 : 0.5;
              
              const sinVal = Math.sin(angle * (5 + wIdx) + phase * (4 + wIdx));
              const cosVal = Math.cos(angle * 3 - phase * (2 + wIdx));
              offset = (sinVal * 15 + cosVal * 10) * amplitude * waveFactor;
              if (frequencyArray) {
                offset += dataVal * 25 * amplitude * waveFactor;
              }
            } else {
              // Gentle organic breathing wave
              offset = Math.sin(angle * 4 + phase + wIdx) * 8 * amplitude;
            }

            const r = maxRadius * 0.75 + offset;
            const x = originX + r * Math.cos(angle);
            const y = originY + r * Math.sin(angle);

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.closePath();
          ctx.stroke();
        }

        // Draw central elegant core orb
        ctx.shadowBlur = 25;
        ctx.shadowColor = "rgba(14, 165, 233, 0.6)";

        const coreRadius = maxRadius * 0.52 + (amplitude * 14);
        const coreGradient = ctx.createRadialGradient(originX, originY, 0, originX, originY, coreRadius);
        
        if (status === "error") {
          coreGradient.addColorStop(0, "rgba(239, 68, 68, 0.8)"); // red-500
          coreGradient.addColorStop(0.6, "rgba(220, 38, 38, 0.35)"); // red-600
          coreGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.shadowColor = "rgba(239, 68, 68, 0.8)";
        } else if (status === "listening") {
          coreGradient.addColorStop(0, "rgba(6, 182, 212, 0.95)"); // cyan-500
          coreGradient.addColorStop(0.5, "rgba(14, 165, 233, 0.4)"); // sky-500
          coreGradient.addColorStop(1, "rgba(29, 78, 216, 0.05)"); // blue-700
          ctx.shadowColor = "rgba(6, 182, 212, 0.8)";
        } else {
          coreGradient.addColorStop(0, "rgb(15, 76, 229)"); // Deep blue
          coreGradient.addColorStop(0.5, "rgba(59, 130, 246, 0.75)"); // light blue
          coreGradient.addColorStop(1, "rgba(12, 74, 110, 0.0)");
        }

        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(originX, originY, coreRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [status, analyser]);

  // Icons and visual indicators for the current status inside the circle
  const getStatusIcon = () => {
    switch (status) {
      case "listening":
        return (
          <motion.div
            key="listening"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [1, 1.15, 1], opacity: 1 }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="text-cyan-100 flex flex-col items-center justify-center gap-1"
          >
            <Mic id="mic-active-icon" className="w-10 h-10 stroke-[2.5]" />
            <span className="text-[10px] font-mono tracking-widest text-cyan-300 uppercase font-medium">Ouvindo</span>
          </motion.div>
        );
      case "thinking":
        return (
          <motion.div
            key="thinking"
            initial={{ opacity: 0, rotate: 0 }}
            animate={{ opacity: 1, rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="text-sky-200 flex flex-col items-center justify-center gap-1"
          >
            <Sparkles id="sparkles-active-icon" className="w-10 h-10 text-sky-300 stroke-[2]" />
            <span className="text-[10px] font-mono tracking-widest text-sky-400 uppercase font-semibold">Pensando</span>
          </motion.div>
        );
      case "speaking":
        return (
          <motion.div
            key="speaking"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-white flex flex-col items-center justify-center gap-1"
          >
            <Volume2 id="volume-active-icon" className="w-10 h-10 stroke-[2] text-sky-100" />
            <span className="text-[10px] font-mono tracking-widest text-sky-100 uppercase font-semibold">Falando</span>
          </motion.div>
        );
      case "error":
        return (
          <motion.div
            key="error"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-red-200 flex flex-col items-center justify-center gap-1"
          >
            <AlertCircle id="error-active-icon" className="w-10 h-10 text-red-400 stroke-[2.5]" />
            <span className="text-[9px] font-mono tracking-widest text-red-400 uppercase font-semibold">Erro</span>
          </motion.div>
        );
      case "idle":
      default:
        return (
          <motion.div
            key="idle"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-white flex flex-col items-center justify-center gap-1"
          >
            <div className="w-14 h-14 rounded-full bg-blue-600/60 hover:bg-blue-600/90 flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-105">
              <Mic id="mic-idle-icon" className="w-7 h-7 stroke-[2]" />
            </div>
            <span className="text-xs font-medium text-slate-300 group-hover:text-white transition-colors">Toca para falar</span>
          </motion.div>
        );
    }
  };

  return (
    <div className="relative w-80 h-80 flex items-center justify-center select-none">
      {/* Outer Halo Rings */}
      <AnimatePresence>
        {status === "listening" && (
          <>
            <motion.div
              initial={{ scale: 0.8, opacity: 0.5 }}
              animate={{ scale: 1.45, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
              className="absolute inset-0 rounded-full border border-cyan-400/35 shadow-2xl pointer-events-none"
            />
            <motion.div
              initial={{ scale: 0.7, opacity: 0.7 }}
              animate={{ scale: 1.3, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ repeat: Infinity, duration: 2, delay: 0.6, ease: "easeOut" }}
              className="absolute inset-0 rounded-full border border-sky-500/30 pointer-events-none"
            />
          </>
        )}
      </AnimatePresence>

      {/* Button Interface Wrapper */}
      <button
        id="voice-mode-trigger-button"
        onClick={onClick}
        className="group relative w-72 h-72 rounded-full flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-blue-500/30 active:scale-95 transition-transform duration-200 cursor-pointer overflow-hidden backdrop-blur-sm bg-slate-900/40 border border-slate-700/50"
      >
        {/* Canvas for Live Waveforms */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Content Centered Over Waves */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full h-full">
          <AnimatePresence mode="wait">
            {getStatusIcon()}
          </AnimatePresence>
        </div>
      </button>

      {/* Touch helper effect */}
      <div className="absolute -bottom-8 flex flex-col items-center gap-1.5 pointer-events-none">
        <FramerStatusBadge status={status} />
      </div>
    </div>
  );
}

// Small descriptive badge under the voice circle
function FramerStatusBadge({ status }: { status: AppStatus }) {
  const getText = () => {
    switch (status) {
      case "listening":
        return "Estou a ouvir, podes falar...";
      case "thinking":
        return "A processar o teu comando...";
      case "speaking":
        return "Assistente de Voz Ativo";
      case "error":
        return "Ocorreu um erro. Toca para tentar de novo.";
      case "idle":
      default:
        return "Pronto para falar. Toca no círculo.";
    }
  };

  const getColorClass = () => {
    switch (status) {
      case "listening":
        return "text-cyan-400";
      case "thinking":
        return "text-sky-400 animate-pulse";
      case "speaking":
        return "text-indigo-400";
      case "error":
        return "text-red-400 font-semibold";
      case "idle":
      default:
        return "text-slate-400";
    }
  };

  return (
    <motion.span
      key={status}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className={`text-sm tracking-wide text-center font-medium transition-colors ${getColorClass()}`}
    >
      {getText()}
    </motion.span>
  );
}
