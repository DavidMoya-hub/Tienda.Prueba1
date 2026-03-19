import { Product, InputTransaction, OutputTransaction, DailyClosing, PriceHistory, PurchaseNote, Envelope, EnvelopeWithdrawal } from "../types";

const API_URL = "/api/exec";

declare var google: any;

const isGasEnv = typeof google !== 'undefined' && google.script && google.script.run;

const runGas = async (action: string, data: any = null): Promise<any> => {
  if (isGasEnv) {
    return new Promise((resolve, reject) => {
      (google.script.run as any)
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)[action](data);
    });
  }

  // Entorno Vercel / Local (Fetch API Directo)
  try {
    const fullUrl = window.location.origin + API_URL;
    console.log(`[Fetch] Calling ${action} at ${fullUrl}`);
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, data })
    });

    // Verificación de estado 200 o 302
    if (!response.ok && response.status !== 302) {
      throw new Error(`Error de Servidor: ${response.status}`);
    }

    const text = await response.text();
    
    if (text.includes('<html') || text.includes('<!DOCTYPE html>')) {
      throw new Error("Error de Servidor: El servidor devolvió una página de error (HTML). Verifica la URL del script.");
    }

    try {
      const json = JSON.parse(text);
      if (json && json.error) throw new Error(json.error);
      
      // Devolvemos el JSON tal cual. Si es un array (para GET), se mantiene como array.
      // Si es un objeto (para POST), se mantiene como objeto.
      return json;
    } catch (e) {
      // Si no es JSON pero el status es OK, devolvemos un objeto de éxito
      if (response.ok || response.status === 302) {
        return { success: true };
      }
      throw new Error("Error de Servidor: La respuesta no es un JSON válido. Respuesta recibida: " + text.substring(0, 100));
    }
  } catch (error) {
    console.error(`Error en fetch directo (${action}):`, error);
    throw error;
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
  _listeners: [] as (() => void)[],

  subscribe(listener: () => void) {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener);
    };
  },

  _notify() {
    this._listeners.forEach(l => l());
  },

  async fetchAll() {
    try {
      const [products, envelopes, envHistory, purchaseNotes, inputs, outputs, closings, priceHistory] = await Promise.all([
        runGas('getProducts'),
        runGas('getEnvelopes'),
        runGas('getEnvelopeHistory'),
        runGas('getPurchaseNotes'),
        runGas('getInputs'),
        runGas('getOutputs'),
        runGas('getClosings'),
        runGas('getPriceHistory'),
      ]);

      this._products = (Array.isArray(products) ? products : []).map((p: any) => ({
        ...p,
        id: String(p.id || ''),
        costPrice: Number(p.costPrice || 0),
        salePrice: Number(p.salePrice || 0),
        stock: Number(p.stock || 0)
      }));
      this._envelopes = Array.isArray(envelopes) ? envelopes : [];
      this._envelopeHistory = Array.isArray(envHistory) ? envHistory : [];
      this._purchaseNotes = Array.isArray(purchaseNotes) ? purchaseNotes : [];
      this._inputs = (Array.isArray(inputs) ? inputs : []).map((i: any) => ({ ...i, type: 'entry', notes: i.notes || '' }));
      this._outputs = (Array.isArray(outputs) ? outputs : []).map((o: any) => ({ ...o, type: 'exit', notes: o.notes || '' }));
      this._closings = Array.isArray(closings) ? closings : [];
      this._priceHistory = Array.isArray(priceHistory) ? priceHistory : [];
      
      this._notify();
    } catch (e) { 
      console.error("Error en fetchAll:", e);
      throw e; // Propagar el error para que la UI pueda reportarlo
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
    const envelopes = this._envelopes;
    const products = this._products;
    const capitalEnv = envelopes.find(e => e.id === 'ENV4');
    const utilityEnvs = envelopes.filter(e => ['ENV1', 'ENV2', 'ENV3'].includes(e.id));
    const totalUtility = utilityEnvs.reduce((acc, e) => acc + (Number(e.balance) || 0), 0);
    
    return {
      envelopes,
      profitVsCapital: [
        { name: 'Capital', value: capitalEnv ? Number(capitalEnv.balance) : 0 },
        { name: 'Utilidad', value: totalUtility }
      ],
      topVolume: [...products].sort((a, b) => (b.totalOutputs || 0) - (a.totalOutputs || 0)).slice(0, 5).map(p => ({ name: p.name, volume: p.totalOutputs || 0 })),
      topProfit: [...products].sort((a, b) => (b.totalEarned || 0) - (a.totalEarned || 0)).slice(0, 5).map(p => ({ name: p.name, profit: p.totalEarned || 0 }))
    };
  },

  async saveProduct(p: Product) { await runGas('saveProduct', p); await this.fetchAll(); },
  async deleteProduct(id: string) { await runGas('deleteProduct', id); await this.fetchAll(); },
  async saveEnvelope(e: Envelope) { await runGas('saveEnvelope', e); await this.fetchAll(); },
  async withdrawEnvelope(w: EnvelopeWithdrawal) { await runGas('withdrawEnvelope', w); await this.fetchAll(); },
  async deleteWithdrawal(id: string) { await runGas('deleteWithdrawal', id); await this.fetchAll(); },
  async updateWithdrawal(w: EnvelopeWithdrawal) { await runGas('updateWithdrawal', w); await this.fetchAll(); },
  async saveRestockNote(note: PurchaseNote) { const res = await runGas('savePurchaseNote', note); await this.fetchAll(); return res; },
  async saveOutput(output: OutputTransaction) { await runGas('saveOutput', output); await this.fetchAll(); },
  async saveOutputBatch(outputs: OutputTransaction[]) { await runGas('saveOutputBatch', outputs); await this.fetchAll(); },
  async saveClosing(closing: DailyClosing) { await runGas('saveClosing', closing); await this.fetchAll(); },
  async updateNoteStatus(id: string, status: string) { await runGas('updateNoteStatus', { id, status }); await this.fetchAll(); },
  async processPhysicalCount(counts: any[], shift: string) { const res = await runGas('processPhysicalCount', { counts, shift }); await this.fetchAll(); return res; },
  async sync() { await this.fetchAll(); return { success: true }; }
};
