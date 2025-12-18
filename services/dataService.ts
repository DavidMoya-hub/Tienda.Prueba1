
import { Product, InputTransaction, OutputTransaction, DailyClosing, PriceHistory, PurchaseNote, Envelope, EnvelopeWithdrawal } from "../types";

const isGasEnv = () => {
  const g = (window as any).google;
  return typeof g !== 'undefined' && g.script && g.script.run;
};

const runGas = (functionName: string, ...args: any[]): Promise<any> => {
  const google = (window as any).google;
  if (isGasEnv()) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)[functionName](...args);
    });
  } else {
    return mockHandler(functionName, args);
  }
};

const mockHandler = async (fn: string, args: any[]): Promise<any> => {
  const getStorage = (key: string) => JSON.parse(localStorage.getItem(key) || '[]');
  const setStorage = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));

  switch (fn) {
    case 'getProducts': return getStorage('zenith_products');
    case 'getDashboardData':
      const envs = getStorage('zenith_envelopes');
      return {
        envelopes: envs.length ? envs : [
          { id: "ENV1", name: "Sobre 1 - Operativo", balance: 150.5, description: "1/3 Utilidad", lastResetDate: new Date().toISOString() },
          { id: "ENV2", name: "Sobre 2 - Ahorro", balance: 150.5, description: "1/3 Utilidad", lastResetDate: new Date().toISOString() },
          { id: "ENV3", name: "Sobre 3 - Ganancia", balance: 150.5, description: "1/3 Utilidad", lastResetDate: new Date().toISOString() },
          { id: "ENV4", name: "Sobre 4 - Capital", balance: 4500, description: "Fondo Resurtido", lastResetDate: new Date().toISOString() }
        ],
        profitVsCapital: [{name: 'Utilidad', value: 450}, {name: 'Capital', value: 4500}],
        topVolume: [{name: 'Coca Cola', volume: 10}],
        topProfit: [{name: 'Coca Cola', profit: 50}]
      };
    case 'getEnvelopes': return getStorage('zenith_envelopes');
    case 'getEnvelopeHistory': return getStorage('zenith_envelope_history');
    case 'getPurchaseNotes': return getStorage('zenith_purchase_notes');
    case 'getOutputs': return getStorage('zenith_outputs');
    case 'getInputs': return getStorage('zenith_inputs');
    case 'getClosings': return getStorage('zenith_closings');
    case 'getPriceHistory': return getStorage('zenith_price_history');
    case 'processPhysicalCount': return { totalSold: 100, netProfit: 30, totalCOGS: 70 };
    case 'withdrawEnvelope': return true;
    case 'setupSheet': return "Sheet Setup Done";
    default: return null;
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
      this._products = products || [];
      this._envelopes = envelopes || [];
      this._envelopeHistory = envHistory || [];
      this._purchaseNotes = purchaseNotes || [];
      this._inputs = inputs || [];
      this._outputs = outputs || [];
      this._closings = closings || [];
      this._priceHistory = priceHistory || [];
    } catch (e) { console.error(e); }
  },

  getProducts() { return this._products; },
  getEnvelopes() { return this._envelopes; },
  getEnvelopeHistory() { return this._envelopeHistory; },
  getPurchaseNotes() { return this._purchaseNotes; },
  getInputs() { return this._inputs; },
  getOutputs() { return this._outputs; },
  getClosings() { return this._closings; },
  getPriceHistory() { return this._priceHistory; },
  
  async getDashboardData() { return await runGas('getDashboardData'); },
  
  async withdrawEnvelope(withdrawal: EnvelopeWithdrawal) {
    await runGas('withdrawEnvelope', withdrawal);
    await this.fetchAll();
  },

  async processPhysicalCount(counts: any[], shift: string) {
    const res = await runGas('processPhysicalCount', counts, shift);
    await this.fetchAll();
    return res;
  },

  async saveRestockNote(note: PurchaseNote) {
    await runGas('saveRestockNote', note);
    await this.fetchAll();
  },

  async updateNoteStatus(id: string, status: string) {
    await runGas('updateNoteStatus', id, status);
    await this.fetchAll();
  },

  async saveProduct(p: Product) { await runGas('saveProduct', p); await this.fetchAll(); },
  async deleteProduct(id: string) { await runGas('deleteProduct', id); await this.fetchAll(); },
  
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
