
import { Product, InputTransaction, OutputTransaction, DailyClosing, PriceHistory, PurchaseNote, Envelope, EnvelopeWithdrawal } from "../types";

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzTUE7hJMazOJQXOeF0OoOHdauxZi-l7rSJtJHN9B9fL9upxhXnZsw4Obq1YFv6Dn1pLw/exec";

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

  // Added method to aggregate and return dashboard-specific data structures
  async getDashboardData() {
    if (this._products.length === 0 && this._envelopes.length === 0) {
      await this.fetchAll();
    }
    const envelopes = this._envelopes;
    
    // Calculate total utility from envelopes ENV1, ENV2, ENV3 and capital from ENV4
    const util1 = envelopes.find(e => e.id === 'ENV1')?.balance || 0;
    const util2 = envelopes.find(e => e.id === 'ENV2')?.balance || 0;
    const util3 = envelopes.find(e => e.id === 'ENV3')?.balance || 0;
    const capital = envelopes.find(e => e.id === 'ENV4')?.balance || 0;
    const totalUtility = util1 + util2 + util3;

    return {
      envelopes,
      profitVsCapital: [
        { name: 'Utilidad Acum.', value: totalUtility },
        { name: 'Capital Invertido', value: capital }
      ],
      topVolume: [...this._products]
        .sort((a, b) => (b.totalOutputs || 0) - (a.totalOutputs || 0))
        .slice(0, 5)
        .map(p => ({ name: p.name, volume: p.totalOutputs || 0 })),
      topProfit: [...this._products]
        .sort((a, b) => (b.totalEarned || 0) - (a.totalEarned || 0))
        .slice(0, 5)
        .map(p => ({ name: p.name, profit: p.totalEarned || 0 }))
    };
  },

  getProducts() { return this._products; },
  getEnvelopes() { return this._envelopes; },
  getEnvelopeHistory() { return this._envelopeHistory; },
  getPurchaseNotes() { return this._purchaseNotes; },
  getInputs() { return this._inputs; },
  getOutputs() { return this._outputs; },
  getClosings() { return this._closings; },
  getPriceHistory() { return this._priceHistory; },

  async saveEnvelope(e: Envelope) { await callApi('saveEnvelope', e); await this.fetchAll(); },
  async withdrawEnvelope(withdrawal: EnvelopeWithdrawal) { await callApi('withdrawEnvelope', withdrawal); await this.fetchAll(); },
  async deleteWithdrawal(id: string) { await callApi('deleteWithdrawal', id); await this.fetchAll(); },
  async updateWithdrawal(withdrawal: EnvelopeWithdrawal) { await callApi('updateWithdrawal', withdrawal); await this.fetchAll(); },
  
  async deleteInput(id: string) { await callApi('deleteInput', id); await this.fetchAll(); },
  async deletePurchaseNote(id: string) { await callApi('deletePurchaseNote', id); await this.fetchAll(); },

  async saveProduct(p: Product) { await callApi('saveProduct', p); await this.fetchAll(); },

  // Added method to save restock/purchase notes
  async saveRestockNote(note: PurchaseNote) { await callApi('savePurchaseNote', note); await this.fetchAll(); },
  
  // Added method to save product outputs/sales
  async saveOutput(output: OutputTransaction) { await callApi('saveOutput', output); await this.fetchAll(); },
  
  // Added method to save daily closings
  async saveClosing(closing: DailyClosing) { await callApi('saveClosing', closing); await this.fetchAll(); },

  async deleteProduct(id: string) { await callApi('deleteProduct', id); await this.fetchAll(); },
  async updateNoteStatus(id: string, status: string) { await callApi('updateNoteStatus', { id, status }); await this.fetchAll(); },
  async processPhysicalCount(counts: any[], shift: string) { const res = await callApi('processPhysicalCount', { counts, shift }); await this.fetchAll(); return res; },
  async sync() { await this.fetchAll(); return { success: true }; }
};
