/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AppStatus = "idle" | "listening" | "thinking" | "speaking" | "error";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface VoiceOption {
  id: string;
  name: string;
  voiceName: "Zephyr" | "Kore" | "Puck" | "Charon" | "Fenrir";
  description: string;
  gender: "male" | "female";
}

export type TTSMethod = "gemini" | "browser";

export interface VoiceSuggestion {
  text: string;
  category: "utilidade" | "criativo" | "conversa" | "aprendizado";
}
