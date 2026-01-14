
import { Product, InputTransaction, OutputTransaction, DailyClosing, PriceHistory, PurchaseNote, Envelope, EnvelopeWithdrawal } from "../types";

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw5jUYHdQDTRCOzcbb0ZE0qXBDK63oe35185aHNy11QxicehhywWC9UXlsbkMWapY5zGg/exec";

const callApi = async (action: string, data: any = null) => {
  if (!APPS_SCRIPT_URL) return null;
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
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

  async getDashboardData() {
    const envelopes = this._envelopes;
    const products = this._products;

    const capitalEnv = envelopes.find(e => e.id === 'ENV4');
    const utilityEnvs = envelopes.filter(e => ['ENV1', 'ENV2', 'ENV3'].includes(e.id));
    const totalUtility = utilityEnvs.reduce((acc, e) => acc + (Number(e.balance) || 0), 0);
    
    const profitVsCapital = [
      { name: 'Capital', value: capitalEnv ? Number(capitalEnv.balance) : 0 },
      { name: 'Utilidad', value: totalUtility }
    ];

    const topVolume = [...products]
      .sort((a, b) => (b.totalOutputs || 0) - (a.totalOutputs || 0))
      .slice(0, 5)
      .map(p => ({ name: p.name, volume: p.totalOutputs || 0 }));

    const topProfit = [...products]
      .sort((a, b) => (b.totalEarned || 0) - (a.totalEarned || 0))
      .slice(0, 5)
      .map(p => ({ name: p.name, profit: p.totalEarned || 0 }));

    return { envelopes, profitVsCapital, topVolume, topProfit };
  },

  async saveEnvelope(e: Envelope) {
    await callApi('saveEnvelope', e);
    await this.fetchAll();
  },

  async withdrawEnvelope(withdrawal: EnvelopeWithdrawal) {
    await callApi('withdrawEnvelope', withdrawal);
    await this.fetchAll();
  },

  async deleteWithdrawal(id: string) {
    await callApi('deleteWithdrawal', id);
    await this.fetchAll();
  },

  async updateWithdrawal(withdrawal: EnvelopeWithdrawal) {
    await callApi('updateWithdrawal', withdrawal);
    await this.fetchAll();
  },

  async saveRestockNote(note: PurchaseNote) {
    await callApi('savePurchaseNote', note);
    await this.fetchAll();
  },

  async saveOutput(output: OutputTransaction) {
    await callApi('saveOutput', output);
    await this.fetchAll();
  },

  async saveClosing(closing: DailyClosing) {
    await callApi('saveClosing', closing);
    await this.fetchAll();
  },

  async saveProduct(p: Product) { await callApi('saveProduct', p); await this.fetchAll(); },
  async deleteProduct(id: string) { await callApi('deleteProduct', id); await this.fetchAll(); },
  async updateNoteStatus(id: string, status: string) { await callApi('updateNoteStatus', { id, status }); await this.fetchAll(); },
  async processPhysicalCount(counts: any[], shift: string) { const res = await callApi('processPhysicalCount', { counts, shift }); await this.fetchAll(); return res; },
  async sync() { await this.fetchAll(); return { success: true }; }
};
