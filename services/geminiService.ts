
import { GoogleGenAI, Type } from "@google/genai";
import { OCRResult } from "../types";

export interface InventoryOCRResult {
  name: string;
  physicalCount: number;
}

export const processTicketWithGemini = async (base64Image: string): Promise<OCRResult[]> => {
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

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Gemini OCR error:", error);
    throw new Error("Failed to process ticket image.");
  }
};

/**
 * Nueva función para procesar hojas de inventario físico
 */
export const processInventoryImage = async (base64Image: string): Promise<InventoryOCRResult[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Analiza esta imagen de una hoja de inventario físico. 
  Busca las columnas "ALMACÉN" (o Producto) y "TOTAL FÍSICO".
  Extrae una lista de productos con sus cantidades físicas encontradas.
  Ignora otras columnas como ventas, costos o precios.
  Devuelve solo un array JSON con objetos { "name": string, "physicalCount": number }.`;

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
              name: { type: Type.STRING, description: "Nombre del producto en la columna Almacén" },
              physicalCount: { type: Type.NUMBER, description: "Valor de la columna Total Físico" },
            },
            required: ["name", "physicalCount"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Gemini Inventory OCR error:", error);
    throw new Error("No se pudo procesar la imagen del inventario.");
  }
};
