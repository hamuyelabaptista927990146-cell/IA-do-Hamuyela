/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VoiceOption, VoiceSuggestion } from "./types";

export const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: "v1",
    name: "Zephyr (Suave)",
    voiceName: "Zephyr",
    description: "Voz masculina calorosa e natural",
    gender: "male",
  },
  {
    id: "v2",
    name: "Kore (Clara)",
    voiceName: "Kore",
    description: "Voz feminina brilhante e nítida",
    gender: "female",
  },
  {
    id: "v3",
    name: "Puck (Alegre)",
    voiceName: "Puck",
    description: "Voz masculina entusiasmada e expressiva",
    gender: "male",
  },
  {
    id: "v4",
    name: "Charon (Profunda)",
    voiceName: "Charon",
    description: "Voz masculina séria, calma e profunda",
    gender: "male",
  },
  {
    id: "v5",
    name: "Fenrir (Expressiva)",
    voiceName: "Fenrir",
    description: "Voz feminina calma, firme e profissional",
    gender: "female",
  },
];

export const VOICE_SUGGESTIONS: VoiceSuggestion[] = [
  {
    text: "Quais são as melhores dicas para aprender um novo idioma?",
    category: "aprendizado",
  },
  {
    text: "Conta-me uma história curta de ficção científica em português.",
    category: "criativo",
  },
  {
    text: "Como é que as estrelas funcionam? Explica como se eu tivesse rido anos.",
    category: "aprendizado",
  },
  {
    text: "Conta-me uma piada original e engraçada sobre programação.",
    category: "conversa",
  },
  {
    text: "Como manter o foco e a produtividade trabalhando em casa?",
    category: "utilidade",
  },
  {
    text: "Sugere uma receita rápida de sopa ou lanche da tarde.",
    category: "utilidade",
  },
];

/**
 * Converts a base64 string containing raw 16-bit little-endian PCM audio
 * into a float audio buffer, connects an AnalyserNode, and returns the audio play parameters.
 */
export async function playBase64Pcm(
  base64Data: string,
  sampleRate: number = 24000,
  onEnded: () => void
): Promise<{ source: AudioBufferSourceNode; audioCtx: AudioContext; analyser: AnalyserNode }> {
  const raw = atob(base64Data);
  const rawLength = raw.length;
  const arrayBuffer = new ArrayBuffer(rawLength);
  const uint8Array = new Uint8Array(arrayBuffer);
  
  for (let i = 0; i < rawLength; i++) {
    uint8Array[i] = raw.charCodeAt(i);
  }

  const numSamples = rawLength / 2;
  const float32Data = new Float32Array(numSamples);
  const dataView = new DataView(arrayBuffer);
  
  for (let i = 0; i < numSamples; i++) {
    const int16 = dataView.getInt16(i * 2, true); // true for little-endian
    float32Data[i] = int16 / 32768.0; // normalize to [-1.0, 1.0]
  }

  // Use standardized AudioContext naming
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("Web Audio API is not supported in this browser");
  }

  const audioCtx = new AudioContextClass({ sampleRate });
  const audioBuffer = audioCtx.createBuffer(1, numSamples, sampleRate);
  audioBuffer.copyToChannel(float32Data, 0);

  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;

  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);
  analyser.connect(audioCtx.destination);

  source.onended = () => {
    onEnded();
    // Safely close audio context to free system resources
    try {
      if (audioCtx.state !== "closed") {
        audioCtx.close();
      }
    } catch (e) {
      console.error("Error closing audio context:", e);
    }
  };

  source.start(0);

  return { source, audioCtx, analyser };
}
