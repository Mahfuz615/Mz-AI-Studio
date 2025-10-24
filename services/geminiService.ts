import { GoogleGenAI, Chat, Modality, Type } from "@google/genai";
import type { GroundingSource } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export const createChatSession = (): Chat => {
  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: 'You are Gemini, a helpful and creative AI assistant. Respond with clarity and personality.',
    },
  });
  return chat;
};

export const createFastChatSession = (): Chat => {
  const chat = ai.chats.create({
    model: 'gemini-flash-lite-latest',
    config: {
      systemInstruction: 'You are Gemini Lite, a fast and helpful AI assistant. Keep responses brief and to the point.',
    },
  });
  return chat;
};

export const generateGroundedContent = async (
  prompt: string
): Promise<{ text: string; sources: GroundingSource[] }> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text;
    const sources: GroundingSource[] = [];

    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    if (groundingMetadata?.groundingChunks) {
      for (const chunk of groundingMetadata.groundingChunks) {
        if (chunk.web) {
          sources.push({
            uri: chunk.web.uri,
            title: chunk.web.title || chunk.web.uri,
          });
        }
      }
    }

    return { text, sources };
  } catch (error) {
    console.error("Error generating grounded content:", error);
    throw new Error("Failed to generate grounded response. The model may not be available in your region.");
  }
};

export const generateComplexContent = async (prompt: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: 32768 },
            },
        });
        return response.text;
    } catch (error) {
        console.error("Error generating complex content:", error);
        throw new Error("Failed to generate complex response. The model may be unavailable or the query too complex.");
    }
};

export const generateImage = async (prompt: string, style: string): Promise<string> => {
  try {
    const fullPrompt = `${prompt}, in a ${style.toLowerCase()} style`;
    
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: fullPrompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/png',
          aspectRatio: '1:1',
        },
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
      const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
      return `data:image/png;base64,${base64ImageBytes}`;
    } else {
      throw new Error("No image was generated.");
    }
  } catch (error) {
    console.error("Error generating image:", error);
    throw new Error("Failed to generate image. Please check the prompt or API key.");
  }
};

export const editImage = async (
  base64ImageData: string,
  mimeType: string,
  prompt: string
): Promise<string> => {
  try {
    const imagePart = {
      inlineData: {
        data: base64ImageData,
        mimeType: mimeType,
      },
    };
    const textPart = {
      text: prompt,
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [imagePart, textPart],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const base64ImageBytes: string = part.inlineData.data;
        return `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
      }
    }
    throw new Error("No edited image was generated.");
  } catch (error) {
    console.error("Error editing image:", error);
    throw new Error("Failed to edit image. Please check the prompt or try a different image.");
  }
};

export const generateSpeech = async (text: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return base64Audio;
    } else {
      throw new Error("No audio was generated.");
    }
  } catch (error) {
    console.error("Error generating speech:", error);
    throw new Error("Failed to generate speech. The model may be unavailable in your region.");
  }
};

export const transcribeAudio = async (
  base64AudioData: string,
  mimeType: string
): Promise<string> => {
  try {
    const audioPart = {
      inlineData: {
        data: base64AudioData,
        mimeType: mimeType,
      },
    };
    const textPart = {
      text: "Transcribe the following audio:",
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [textPart, audioPart],
      },
    });

    return response.text;
  } catch (error) {
    console.error("Error transcribing audio:", error);
    throw new Error("Failed to transcribe audio. The model may be unavailable or the audio format is not supported.");
  }
};

export const generateCode = async (prompt: string, language: string): Promise<string> => {
    const fullPrompt = `Generate a snippet of ${language} code that does the following: ${prompt}. Only return the raw code inside a markdown block, with no explanation.`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: fullPrompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error generating code:", error);
        throw new Error("Failed to generate code.");
    }
};

export const explainCode = async (code: string, language: string): Promise<string> => {
    const fullPrompt = `Explain the following ${language} code snippet. Break it down and describe what it does.\n\n\`\`\`${language}\n${code}\n\`\`\``;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: fullPrompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error explaining code:", error);
        throw new Error("Failed to explain code.");
    }
};

export const debugCode = async (code: string, language: string): Promise<string> => {
    const fullPrompt = `Analyze the following ${language} code for bugs, errors, or improvements. Provide a corrected version of the code inside a markdown block and then explain the issue and the fix.\n\n\`\`\`${language}\n${code}\n\`\`\``;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: fullPrompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error debugging code:", error);
        throw new Error("Failed to debug code.");
    }
};

export const formatCode = async (code: string, language: string): Promise<string> => {
    const fullPrompt = `Format the following ${language} code according to standard conventions. Only return the formatted code inside a markdown block.\n\n\`\`\`${language}\n${code}\n\`\`\``;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fullPrompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error formatting code:", error);
        throw new Error("Failed to format code.");
    }
};

export const generateProject = async (prompt: string): Promise<{ path: string; content: string }[]> => {
    const systemInstruction = `You are an expert software architect and developer. Based on the user's prompt, generate a complete, runnable file and folder structure for a web application. Output the result as a single JSON object that adheres to the provided schema. The JSON object should be an array of file objects, where each object has a 'path' (e.g., 'src/components/Button.tsx') and 'content' (the full, raw file content as a string). Ensure all necessary files, including package.json, entry points (index.html, index.js), components, and basic styles are included.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            path: {
                                type: Type.STRING,
                                description: "The full path of the file, including directories. E.g., 'src/components/Header.js'",
                            },
                            content: {
                                type: Type.STRING,
                                description: "The complete, raw source code or content of the file.",
                            },
                        },
                         required: ['path', 'content'],
                    },
                },
            },
        });
        
        const jsonString = response.text;
        const projectFiles = JSON.parse(jsonString);
        return projectFiles;

    } catch (error) {
        console.error("Error generating project:", error);
        throw new Error("Failed to generate project. The request may be too complex or the model may be unavailable.");
    }
};