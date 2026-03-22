import { Product, InputTransaction, OutputTransaction, DailyClosing, PriceHistory, PurchaseNote, Envelope, EnvelopeWithdrawal } from "../types";

const API_URL = "https://script.google.com/macros/s/AKfycbwIR5xnF6ooXKqrhEUgpbDQTYrMsvkwz8OYkIvv1Z4F79bbmiejauHdVF7-6JeQu2mahw/exec";

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
    const response = await fetch(API_URL, {
      method: 'POST',
      redirect: 'follow',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
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

  async saveProduct(p: Product) {
    const res = await runGas('saveProduct', p);
    if (res && res.success) {
      const index = this._products.findIndex(prod => prod.id === p.id);
      if (index !== -1) {
        this._products = this._products.map(prod => prod.id === p.id ? { ...prod, ...p } : prod);
      } else {
        this._products = [...this._products, p];
      }
      this._notify();
    }
    return res;
  },
  async deleteProduct(id: string) { await runGas('deleteProduct', id); await this.fetchAll(); },
  async saveInput(i: InputTransaction) { await runGas('saveInput', i); await this.fetchAll(); },
  async deleteInput(id: string) {
    const res = await runGas('deleteInput', id);
    if (res && res.success) {
      const inputToDelete = this._inputs.find(i => i.id === id);
      if (inputToDelete) {
        this._products = this._products.map(p => {
          if (String(p.id) === String(inputToDelete.productId)) {
            return {
              ...p,
              stock: (Number(p.stock) || 0) - (Number(inputToDelete.quantity) || 0),
              totalInputs: (Number(p.totalInputs) || 0) - (Number(inputToDelete.quantity) || 0),
              totalInvested: (Number(p.totalInvested) || 0) - (Number(inputToDelete.totalCost) || 0)
            };
          }
          return p;
        });
        this._inputs = this._inputs.filter(i => i.id !== id);
        this._notify();
      }
    }
    return res;
  },
  async saveOutput(o: OutputTransaction) { await runGas('saveOutput', o); await this.fetchAll(); },
  async deleteOutput(id: string) { await runGas('deleteOutput', id); await this.fetchAll(); },
  async saveClosing(c: DailyClosing) {
    const res = await runGas('saveClosing', c);
    if (res && res.success) {
      this._closings = [c, ...this._closings];
      this._notify();
    }
    return res;
  },
  async deleteClosing(id: string) { await runGas('deleteClosing', id); await this.fetchAll(); },
  async savePriceHistory(h: PriceHistory) { await runGas('savePriceHistory', h); await this.fetchAll(); },
  async deletePriceHistory(id: string) { await runGas('deletePriceHistory', id); await this.fetchAll(); },
  async saveEnvelope(e: Envelope) { await runGas('saveEnvelope', e); await this.fetchAll(); },
  async withdrawEnvelope(w: EnvelopeWithdrawal) { await runGas('withdrawEnvelope', w); await this.fetchAll(); },
  async deleteWithdrawal(id: string) { await runGas('deleteWithdrawal', id); await this.fetchAll(); },
  async updateWithdrawal(w: EnvelopeWithdrawal) { await runGas('updateWithdrawal', w); await this.fetchAll(); },
  async saveRestockNote(note: PurchaseNote) {
    const res = await runGas('savePurchaseNote', note);
    if (res && res.success) {
      this._purchaseNotes = [note, ...this._purchaseNotes];
      const details = JSON.parse(note.detailsJson || '[]');
      
      // Crear entradas individuales en el estado local
      const newInputs: InputTransaction[] = details.map((item: any) => ({
        id: "INP-" + Math.random().toString(36).substr(2, 9),
        productId: item.productId,
        productName: item.productName,
        quantity: Number(item.quantity),
        unitCost: Number(item.unitCost),
        totalCost: Number(item.totalCost),
        date: note.date,
        provider: note.provider,
        notes: "Compra: " + note.id,
        type: 'entry'
      }));
      this._inputs = [...newInputs, ...this._inputs];

      this._products = this._products.map(p => {
        const item = details.find((d: any) => String(d.productId) === String(p.id) || d.code === p.code);
        if (item) {
          return {
            ...p,
            stock: (Number(p.stock) || 0) + (Number(item.quantity) || 0),
            totalInputs: (Number(p.totalInputs) || 0) + (Number(item.quantity) || 0),
            totalInvested: (Number(p.totalInvested) || 0) + (Number(item.totalCost) || 0)
          };
        }
        return p;
      });

      if (note.status === 'Paid') {
        this._envelopes = this._envelopes.map(e => 
          e.id === 'ENV4' ? { ...e, balance: (Number(e.balance) || 0) - (Number(note.totalAmount) || 0) } : e
        );
      }
      this._notify();
    }
    return res;
  },
  async deletePurchaseNote(id: string) { await runGas('deletePurchaseNote', id); await this.fetchAll(); },
  async saveOutputBatch(outputs: OutputTransaction[]) {
    const res = await runGas('saveOutputBatch', outputs);
    if (res && res.success) {
      const formattedOutputs = outputs.map(o => ({ ...o, type: 'exit' as const, notes: o.notes || '' }));
      this._outputs = [...formattedOutputs, ...this._outputs];

      this._products = this._products.map(p => {
        const out = outputs.find(o => String(o.productId) === String(p.id));
        if (out) {
          return {
            ...p,
            stock: (Number(p.stock) || 0) - (Number(out.quantity) || 0),
            totalOutputs: (Number(p.totalOutputs) || 0) + (Number(out.quantity) || 0),
            totalEarned: (Number(p.totalEarned) || 0) + (Number(out.totalSale) || 0)
          };
        }
        return p;
      });
      this._notify();
    }
    return res;
  },
  async updateNoteStatus(id: string, status: string) { await runGas('updateNoteStatus', { id, status }); await this.fetchAll(); },
  async updatePurchaseNoteDetails(id: string, totalAmount: number, detailsJson: string) {
    const res = await runGas('updatePurchaseNoteDetails', { id, totalAmount, detailsJson });
    if (res && res.success) {
      const oldNote = this._purchaseNotes.find(n => n.id === id);
      if (!oldNote) return res;

      const oldDetails = JSON.parse(oldNote.detailsJson || '[]');
      const newDetails = JSON.parse(detailsJson || '[]');

      // --- PASO B: REVERTIR STOCK ANTIGUO EN ESTADO LOCAL ---
      this._products = this._products.map(p => {
        const oldItem = oldDetails.find((d: any) => String(d.productId) === String(p.id));
        if (oldItem) {
          return {
            ...p,
            stock: (Number(p.stock) || 0) - (Number(oldItem.quantity) || 0),
            totalInputs: (Number(p.totalInputs) || 0) - (Number(oldItem.quantity) || 0),
            totalInvested: (Number(p.totalInvested) || 0) - (Number(oldItem.totalCost) || 0)
          };
        }
        return p;
      });

      // --- PASO C: LIMPIAR ENTRADAS EN ESTADO LOCAL ---
      const noteMatch = "Compra: " + id;
      this._inputs = this._inputs.filter(i => i.notes !== noteMatch);

      // --- PASO D: REAPLICAR NUEVO EN ESTADO LOCAL ---
      const newInputs: InputTransaction[] = newDetails.map((item: any) => ({
        id: "INP-" + Math.random().toString(36).substr(2, 9),
        productId: item.productId,
        productName: item.productName,
        quantity: Number(item.quantity),
        unitCost: Number(item.unitCost),
        totalCost: Number(item.totalCost),
        date: oldNote.date,
        provider: oldNote.provider,
        notes: noteMatch,
        type: 'entry'
      }));
      this._inputs = [...newInputs, ...this._inputs];

      this._products = this._products.map(p => {
        const newItem = newDetails.find((d: any) => String(d.productId) === String(p.id));
        if (newItem) {
          return {
            ...p,
            stock: (Number(p.stock) || 0) + (Number(newItem.quantity) || 0),
            totalInputs: (Number(p.totalInputs) || 0) + (Number(newItem.quantity) || 0),
            totalInvested: (Number(p.totalInvested) || 0) + (Number(newItem.totalCost) || 0)
          };
        }
        return p;
      });

      // Actualizar sobres si estaba pagada
      if (oldNote.status === 'Paid') {
        const diffTotal = totalAmount - (Number(oldNote.totalAmount) || 0);
        if (diffTotal !== 0) {
          this._envelopes = this._envelopes.map(e => 
            e.id === 'ENV4' ? { ...e, balance: (Number(e.balance) || 0) - diffTotal } : e
          );
        }
      }

      // --- PASO E: ACTUALIZAR NOTA EN ESTADO LOCAL ---
      this._purchaseNotes = this._purchaseNotes.map(n => 
        n.id === id ? { ...n, totalAmount, detailsJson } : n
      );

      this._notify();
    }
    return res;
  },
  async processPhysicalCount(counts: any[], shift: string) { const res = await runGas('processPhysicalCount', { counts, shift }); await this.fetchAll(); return res; },
  async sync() { await this.fetchAll(); return { success: true }; }
};
