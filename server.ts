import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Initialize Gemini SDK with telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Cache for system prompts and instructions
const SYSTEM_INSTRUCTION = `
You are a helpful, smart, and natural AI assistant named "Assistente de Voz IA".
You speak in fluent, natural, and friendly Portuguese (Portugal or Brazil, matching the user).
Keep your answers brief, friendly, and well-suited for voice-based interactions (around 1 to 3 short sentences).
Avoid using complex markdown, code snippets, or lists unless absolutely necessary, as your replies will be spoken out loud.
If the user's input is empty or unclear, ask them to talk again in a polite way.
`;

// Endpoint 1: Text Chat response
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid messages array" });
    }

    // Adapt messages to @google/genai SDK format
    // In @google/genai chat api, we can send messages in chats or in generateContent
    // Let's use getContent or chats. Here we can use generateContent with the history as part of are formatted contents
    const contents = messages.map((m) => {
      return {
        role: m.role === "assistant" ? "model" : m.role,
        parts: [{ text: m.content }],
      };
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
    });

    const responseText = response.text || "";
    res.json({ text: responseText });
  } catch (error: any) {
    console.error("Error in /api/chat:", error);
    res.status(500).json({ error: error?.message || "Internal server error" });
  }
});

// Endpoint 2: Premium Text to Speech (TTS) using Gemini TTS Preview
app.post("/api/tts", async (req, res) => {
  try {
    const { text, voice = "Zephyr" } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Invalid text payload" });
    }

    // Keep it short to avoid excessive latency or tokens in TTS
    const sanitizedText = text.substring(0, 500);

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: sanitizedText }] }],
      config: {
        // Must be an array with a single 'AUDIO' element
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    let base64Audio = "";

    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          base64Audio = part.inlineData.data;
          break;
        }
      }
    }

    if (!base64Audio) {
      return res.status(500).json({ error: "No voice generated from Gemini API" });
    }

    res.json({ audio: base64Audio });
  } catch (error: any) {
    console.error("Error in /api/tts:", error);
    res.status(500).json({ error: error?.message || "TTS Service failed" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
