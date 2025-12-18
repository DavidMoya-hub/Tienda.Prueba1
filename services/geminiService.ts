
import { GoogleGenAI, Type } from "@google/genai";
import { OCRResult } from "../types";

export const processTicketWithGemini = async (base64Image: string): Promise<OCRResult[]> => {
  // Always use process.env.API_KEY directly for initialization as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Analyze this purchase ticket/invoice image. Extract the following information for each item as a JSON array.
  Look for: Code/SKU, Name/Description, Grams (if applicable), Flavor (if applicable), Cost Price per unit, Suggested Sale Price, and Quantity purchased.
  Ensure numerical values are numbers, not strings. Use 0 if data is not found.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: base64Image.split(',')[1] || base64Image, mimeType: "image/jpeg" } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              code: { type: Type.STRING },
              name: { type: Type.STRING },
              grams: { type: Type.STRING },
              flavor: { type: Type.STRING },
              costPrice: { type: Type.NUMBER },
              salePrice: { type: Type.NUMBER },
              quantity: { type: Type.NUMBER },
            },
            required: ["name", "costPrice", "quantity"]
          }
        }
      }
    });

    // Access the .text property directly instead of as a method
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Gemini OCR error:", error);
    throw new Error("Failed to process ticket image. Please check your API key and connection.");
  }
};
