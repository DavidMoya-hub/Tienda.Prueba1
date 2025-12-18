import { Product, InputTransaction, OutputTransaction, DailyClosing, PriceHistory, PurchaseNote, Envelope, EnvelopeWithdrawal } from "../types";

const GAS_API_URL = "https://script.google.com/macros/s/AKfycbzTUE7hJMazOJQXOeF0OoOHdauxZi-l7rSJtJHN9B9fL9upxhXnZsw4Obq1YFv6Dn1pLw/exec";

const isGasEnv = () => {
  const g = (window as any).google;
  return typeof g !== 'undefined' && g.script && g.script.run;
};

const runGas = async (functionName: string, ...args: any[]): Promise<any> => {
  if (isGasEnv()) {
    return new Promise((resolve, reject) => {
      (window as any).google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)[functionName](...args);
    });
  } else {
    // Versión original: Fetch directo (Puede requerir configuración CORS en el servidor)
    const url = `${GAS_API_URL}?action=${functionName}`;
    if (functionName.startsWith('get')) {
      const response = await fetch(url);
      return await response.json();
    } else {
      const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(args[0] || {})
      });
      return await response.json();
    }
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
      const [p, e, eh, pn, i, o, c, ph] = await Promise.all([
        runGas('getProducts'),
        runGas('getEnvelopes'),
        runGas('getEnvelopeHistory'),
        runGas('getPurchaseNotes'),
        runGas('getInputs'),
        runGas('getOutputs'),
        runGas('getClosings'),
        runGas('getPriceHistory')
      ]);
      
      this._products = Array.isArray(p) ? p : [];
      this._envelopes = Array.isArray(e) ? e : [];
      this._envelopeHistory = Array.isArray(eh) ? eh : [];
      this._purchaseNotes = Array.isArray(pn) ? pn : [];
      this._inputs = Array.isArray(i) ? i : [];
      this._outputs = Array.isArray(o) ? o : [];
      this._closings = Array.isArray(c) ? c : [];
      this._priceHistory = Array.isArray(ph) ? ph : [];
    } catch (err) {
      console.error("Error en sincronización masiva");
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
    return await runGas('getDashboardData');
  },
  
  async withdrawEnvelope(withdrawal: EnvelopeWithdrawal) {
    await runGas('withdrawEnvelope', withdrawal);
    await this.fetchAll();
  },

  async processPhysicalCount(counts: any[], shift: string) {
    const res = await runGas('processPhysicalCount', { counts, shift });
    await this.fetchAll();
    return res;
  },

  async saveRestockNote(note: PurchaseNote) {
    await runGas('saveRestockNote', note);
    await this.fetchAll();
  },

  async updateNoteStatus(id: string, status: string) {
    await runGas('updateNoteStatus', { id, status });
    await this.fetchAll();
  },

  async saveProduct(p: Product) { await runGas('saveProduct', p); await this.fetchAll(); },
  async deleteProduct(id: string) { await runGas('deleteProduct', { id }); await this.fetchAll(); },
  
  async saveOutput(o: OutputTransaction) {
    await runGas('saveOutput', o);
    await this.fetchAll();
  },

  async saveClosing(c: DailyClosing) {
    await runGas('saveClosing', c);
    await this.fetchAll();
  },
  
  async setup() { return await runGas('setupSheet'); },
  async sync() { await this.fetchAll(); return { success: true }; }
};
