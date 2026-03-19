import { Product, InputTransaction, OutputTransaction, DailyClosing, PriceHistory, PurchaseNote, Envelope, EnvelopeWithdrawal } from "../types";

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw5jUYHdQDTRCOzcbb0ZE0qXBDK63oe35185aHNy11QxicehhywWC9UXlsbkMWapY5zGg/exec";

// Proxy para evitar CORS en GET (Vercel/Local)
const PROXY_URL = "https://api.allorigins.win/raw?url=";

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

  // Si no estamos en GAS, usamos fetch (Mock o Proxy)
  if (process.env.NODE_ENV === 'development' && !APPS_SCRIPT_URL.includes('script.google.com')) {
    return mockHandler(action, data);
  }

  // 2. Entorno Vercel / Local (Fetch API)
  if (action.startsWith('get')) {
    try {
      const url = `${APPS_SCRIPT_URL}?action=${action}`;
      const response = await fetch(PROXY_URL + encodeURIComponent(url));
      const json = await response.json();
      // allorigins.win devuelve { contents: "..." }
      return json.contents ? JSON.parse(json.contents) : json;
    } catch (error) {
      console.warn(`Error en fetch vía proxy (${action}), intentando mock local...`, error);
      return mockHandler(action, data);
    }
  }

  // Para POST (Escritura)
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action, data })
    });
    return await response.json();
  } catch (error) {
    console.warn(`Error en fetch directo (${action}), intentando mock local...`, error);
    return mockHandler(action, data);
  }
};

const mockHandler = (action: string, data: any): any => {
  const getStorage = (key: string) => JSON.parse(localStorage.getItem(key) || '[]');
  const setStorage = (key: string, val: any) => localStorage.setItem(key, JSON.stringify(val));

  switch (action) {
    case 'getProducts': return getStorage('products');
    case 'getEnvelopes': 
      const envs = getStorage('envelopes');
      if (envs.length === 0) {
        const initial = [
          { id: 'ENV1', name: 'Sobre 1 - Operativo', balance: 0, description: 'Gastos', lastResetDate: new Date().toISOString() },
          { id: 'ENV2', name: 'Sobre 2 - Ahorro', balance: 0, description: 'Fondo', lastResetDate: new Date().toISOString() },
          { id: 'ENV3', name: 'Sobre 3 - Ganancia', balance: 0, description: 'Personal', lastResetDate: new Date().toISOString() },
          { id: 'ENV4', name: 'Sobre 4 - Capital', balance: 0, description: 'Resurtido', lastResetDate: new Date().toISOString() }
        ];
        setStorage('envelopes', initial);
        return initial;
      }
      return envs;
    case 'getInputs': return getStorage('inputs');
    case 'getOutputs': return getStorage('outputs');
    case 'getClosings': return getStorage('closings');
    case 'getPurchaseNotes': return getStorage('purchaseNotes');
    case 'getEnvelopeHistory': return getStorage('envelopeHistory');
    case 'getPriceHistory': return getStorage('priceHistory');
    
    case 'saveProduct':
      const products = getStorage('products');
      const idx = products.findIndex((p: any) => p.id === data.id);
      if (idx > -1) products[idx] = data; else products.push(data);
      setStorage('products', products);
      return { success: true };
    
    case 'saveOutputBatch':
      const outputs = getStorage('outputs');
      const currentProducts = getStorage('products');
      data.forEach((o: any) => {
        outputs.push(o);
        const p = currentProducts.find((p: any) => p.id === o.productId);
        if (p) {
          p.stock -= o.quantity;
          p.totalOutputs = (p.totalOutputs || 0) + o.quantity;
          p.totalEarned = (p.totalEarned || 0) + (o.totalSale - (o.quantity * p.costPrice));
        }
      });
      setStorage('outputs', outputs);
      setStorage('products', currentProducts);
      return { success: true };

    case 'saveClosing':
      const closings = getStorage('closings');
      closings.push(data);
      setStorage('closings', closings);
      return { success: true };

    default: return { success: true };
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
    } catch (e) { console.error("Error en fetchAll:", e); }
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
