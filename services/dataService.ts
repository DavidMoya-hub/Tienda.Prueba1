
import { Product, InputTransaction, OutputTransaction, DailyClosing, PriceHistory, PurchaseNote, Envelope, EnvelopeWithdrawal } from "../types";

// La URL se obtiene de las variables de entorno de Vite/Vercel
const APPS_SCRIPT_URL = (import.meta as any).env.VITE_APPS_SCRIPT_URL;

const callApi = async (action: string, data: any = null) => {
  if (!APPS_SCRIPT_URL) {
    console.error("VITE_APPS_SCRIPT_URL no está configurada.");
    return null;
  }

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'cors', // Crucial para Vercel
      headers: { 'Content-Type': 'text/plain' }, // Apps Script prefiere text/plain para evitar pre-flight CORS
      body: JSON.stringify({ action, data })
    });
    return await response.json();
  } catch (error) {
    console.error(`Error en API (${action}):`, error);
    return null;
  }
};

export const dataService = {
  _products: [] as Product[],
  _envelopes: [] as Envelope[],
  _envelopeHistory: [] as EnvelopeWithdrawal[],
  _purchaseNotes: [] as PurchaseNote[],
  _inputs: [] as InputTransaction[],
  _outputs: [] as OutputTransaction[],
  _closings: [] as DailyClosing[],
  _priceHistory: [] as PriceHistory[],

  async fetchAll() {
    try {
      const [products, envelopes, envHistory, purchaseNotes, inputs, outputs, closings, priceHistory] = await Promise.all([
        callApi('getProducts'),
        callApi('getEnvelopes'),
        callApi('getEnvelopeHistory'),
        callApi('getPurchaseNotes'),
        callApi('getInputs'),
        callApi('getOutputs'),
        callApi('getClosings'),
        callApi('getPriceHistory'),
      ]);
      
      this._products = Array.isArray(products) ? products : [];
      this._envelopes = Array.isArray(envelopes) ? envelopes : [];
      this._envelopeHistory = Array.isArray(envHistory) ? envHistory : [];
      this._purchaseNotes = Array.isArray(purchaseNotes) ? purchaseNotes : [];
      this._inputs = Array.isArray(inputs) ? inputs : [];
      this._outputs = Array.isArray(outputs) ? outputs : [];
      this._closings = Array.isArray(closings) ? closings : [];
      this._priceHistory = Array.isArray(priceHistory) ? priceHistory : [];
    } catch (e) { 
      console.error("Error cargando datos:", e); 
    }
  },

  getProducts() { return this._products; },
  getEnvelopes() { return this._envelopes; },
  getEnvelopeHistory() { return this._envelopeHistory; },
  getPurchaseNotes() { return this._purchaseNotes; },
  getInputs() { return this._inputs; },
  getOutputs() { return this._outputs; },
  getClosings() { return this._closings; },
  getPriceHistory() { return this._priceHistory; },
  
  async getDashboardData() { 
    return await callApi('getDashboardData'); 
  },
  
  async withdrawEnvelope(withdrawal: EnvelopeWithdrawal) {
    await callApi('withdrawEnvelope', withdrawal);
    await this.fetchAll();
  },

  async processPhysicalCount(counts: any[], shift: string) {
    const res = await callApi('processPhysicalCount', { counts, shift });
    await this.fetchAll();
    return res;
  },

  async saveRestockNote(note: PurchaseNote) {
    await callApi('saveRestockNote', note);
    await this.fetchAll();
  },

  async updateNoteStatus(id: string, status: string) {
    await callApi('updateNoteStatus', { id, status });
    await this.fetchAll();
  },

  async saveProduct(p: Product) { 
    await callApi('saveProduct', p); 
    await this.fetchAll(); 
  },

  async deleteProduct(id: string) { 
    await callApi('deleteProduct', id); 
    await this.fetchAll(); 
  },
  
  async saveOutput(o: OutputTransaction) {
    await callApi('saveOutput', o);
    await this.fetchAll();
  },

  async saveClosing(c: DailyClosing) {
    await callApi('saveClosing', c);
    await this.fetchAll();
  },
  
  async setup() { 
    return await callApi('setup'); 
  },

  async sync() { 
    await this.fetchAll(); 
    return { success: true }; 
  }
};
