import { Product, InputTransaction, OutputTransaction, DailyClosing, PriceHistory, PurchaseNote, Envelope, EnvelopeWithdrawal } from "../types";

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw5jUYHdQDTRCOzcbb0ZE0qXBDK63oe35185aHNy11QxicehhywWC9UXlsbkMWapY5zGg/exec";

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
    // Usamos POST para todas las peticiones para asegurar compatibilidad y evitar CORS con GET
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      redirect: 'follow', // Obligatorio para Google Apps Script
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action, data })
    });

    if (!response.ok) {
      throw new Error(`Error de Servidor: ${response.status}`);
    }

    const text = await response.text();
    
    // Validación de JSON: Si recibimos HTML (un error de Google), lanzamos error
    if (text.includes('<html') || text.includes('<!DOCTYPE html>')) {
      throw new Error("Error de Servidor: Respuesta no válida (HTML)");
    }

    try {
      const json = JSON.parse(text);
      if (json && json.error) throw new Error(json.error);
      return json;
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Error de Servidor")) throw e;
      throw new Error("Error de Servidor: Respuesta no válida (No JSON)");
    }
  } catch (error) {
    console.error(`Error en fetch directo (${action}):`, error);
    throw error; // Reportar el error, no usar mock
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
        runGas('getProducts'),
        runGas('getEnvelopes'),
        runGas('getEnvelopeHistory'),
        runGas('getPurchaseNotes'),
        runGas('getInputs'),
        runGas('getOutputs'),
        runGas('getClosings'),
        runGas('getPriceHistory'),
      ]);

      this._products = (products || []).map((p: any) => ({
        ...p,
        id: String(p.id || ''),
        costPrice: Number(p.costPrice || 0),
        salePrice: Number(p.salePrice || 0),
        stock: Number(p.stock || 0)
      }));
      this._envelopes = envelopes || [];
      this._envelopeHistory = envHistory || [];
      this._purchaseNotes = purchaseNotes || [];
      this._inputs = (inputs || []).map((i: any) => ({ ...i, type: 'entry', notes: i.notes || '' }));
      this._outputs = (outputs || []).map((o: any) => ({ ...o, type: 'exit', notes: o.notes || '' }));
      this._closings = closings || [];
      this._priceHistory = priceHistory || [];
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
  async saveRestockNote(note: PurchaseNote) { await runGas('savePurchaseNote', note); await this.fetchAll(); },
  async saveOutput(output: OutputTransaction) { await runGas('saveOutput', output); await this.fetchAll(); },
  async saveOutputBatch(outputs: OutputTransaction[]) { await runGas('saveOutputBatch', outputs); await this.fetchAll(); },
  async saveClosing(closing: DailyClosing) { await runGas('saveClosing', closing); await this.fetchAll(); },
  async updateNoteStatus(id: string, status: string) { await runGas('updateNoteStatus', { id, status }); await this.fetchAll(); },
  async processPhysicalCount(counts: any[], shift: string) { const res = await runGas('processPhysicalCount', { counts, shift }); await this.fetchAll(); return res; },
  async sync() { await this.fetchAll(); return { success: true }; }
};
