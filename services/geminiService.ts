import { GoogleGenAI } from "@google/genai";
import { Source } from "../types";

const SYSTEM_INSTRUCTION = `You are Kenotrix, a helpful, advanced AI assistant. 
You were created by Chaudhary Mahendra J. 
If anyone asks who made you, you must explicitly state that you were made by Chaudhary Mahendra J. 
Do not mention Google or Gemini as your creator. 
You are powered by advanced models but your identity is strictly Kenotrix.
Provide comprehensive, accurate answers with citations when available.`;

// Initialize the client
// NOTE: We assume process.env.API_KEY is available in the environment
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const streamResponse = async (
  history: { role: string; parts: { text: string }[] }[],
  currentMessage: string,
  onChunk: (text: string) => void,
  onSources: (sources: Source[]) => void
): Promise<string> => {
  try {
    const model = "gemini-2.5-flash";
    
    // We can't easily persist the 'Chat' object across the stateless request pattern often used in React 
    // without a custom hook management, so we recreate the chat context each time or use generateContentStream 
    // with the full history. For simplicity and robustness with grounding, we'll use generateContentStream
    // but formatted as a chat structure is cleaner.
    // However, the SDK `chats.create` is the best way to handle history.
    
    const chat = ai.chats.create({
      model: model,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }], // Enable Search Grounding
      },
      history: history.map(h => ({
        role: h.role,
        parts: h.parts
      }))
    });

    const result = await chat.sendMessageStream({ message: currentMessage });

    let fullText = "";
    let extractedSources: Source[] = [];

    for await (const chunk of result) {
      // 1. Extract Text
      const chunkText = chunk.text;
      if (chunkText) {
        fullText += chunkText;
        onChunk(chunkText);
      }

      // 2. Extract Grounding Metadata (Sources)
      // The SDK structure for grounding chunks can vary slightly, we check safely.
      const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingChunks) {
        groundingChunks.forEach((c: any) => {
          if (c.web) {
            const source: Source = {
              title: c.web.title || "Web Source",
              uri: c.web.uri,
            };
            // Prevent duplicates
            if (!extractedSources.some(s => s.uri === source.uri)) {
              extractedSources.push(source);
            }
          }
        });
      }
    }

    if (extractedSources.length > 0) {
      onSources(extractedSources);
    }

    return fullText;

  } catch (error) {
    console.error("Gemini API Error:", error);
    onChunk("\n\n*I encountered an error connecting to the knowledge base. Please try again.*");
    return "";
  }
};

export const generateTitle = async (message: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate a very short, concise title (max 5 words) for a conversation starting with this message: "${message}". Return ONLY the title text.`,
    });
    return response.text?.trim() || "New Conversation";
  } catch (e) {
    return "New Conversation";
  }
};