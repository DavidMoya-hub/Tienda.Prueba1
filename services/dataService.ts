import { Product, InputTransaction, OutputTransaction, DailyClosing, AuditLog, PurchaseNote, Envelope, EnvelopeWithdrawal } from "../types";

const API_URL = "https://script.google.com/macros/s/AKfycbyhemaPMbTOyeZeG5UBY5URcvVgbbj4JWjCxZGblbrvsGFcejY_9zJBTily46dwD8gT2g/exec";

declare var google: any;

const isGasEnv = typeof google !== 'undefined' && google.script && google.script.run;

const runGas = async (action: string, data: any = null, retries = 2): Promise<any> => {
  if (isGasEnv) {
    return new Promise((resolve, reject) => {
      (google.script.run as any)
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)[action](data);
    });
  }

  // Entorno Vercel / Local (Fetch API al servidor Express)
  const targetUrl = "/api/exec";
  
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, data })
      });

      if (!response.ok) {
        throw new Error(`Error de Servidor: ${response.status}`);
      }

      const json = await response.json();
      if (json && json.error) throw new Error(json.error);
      return json.data || json;
    } catch (error) {
      if (i === retries) {
        console.error(`Error en fetch directo (${action}):`, error);
        throw error;
      }
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
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
  _audits: [] as AuditLog[],
  _draftPhysicalCount: [] as OutputTransaction[],
  _draftClosingData: null as any[] | null,
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
      const products = await runGas('getProducts');
      const envelopes = await runGas('getEnvelopes');
      const envHistory = await runGas('getEnvelopeHistory');
      const purchaseNotes = await runGas('getPurchaseNotes');
      const inputs = await runGas('getInputs');
      const outputs = await runGas('getOutputs');
      const closings = await runGas('getClosings');
      const priceHistory = await runGas('getAudits');

      this._products = (Array.isArray(products) ? products : []).map((p: any) => ({
        ...p,
        id: String(p.id || ''),
        costPrice: Number(p.costPrice || 0),
        salePrice: Number(p.salePrice || 0),
        stock: Number(p.stock || 0)
      }));
      this._envelopes = Array.isArray(envelopes) ? envelopes : [];
      this._envelopeHistory = Array.isArray(envHistory) ? envHistory : [];
      this._purchaseNotes = (Array.isArray(purchaseNotes) ? purchaseNotes : []).map((n: any) => ({
        ...n,
        totalAmount: Number(n.totalAmount || 0),
        paymentSource: n.paymentSource || 'Capital'
      }));
      this._inputs = (Array.isArray(inputs) ? inputs : []).map((i: any) => ({ ...i, type: 'entry', notes: i.notes || '' }));
      this._outputs = (Array.isArray(outputs) ? outputs : []).map((o: any) => ({ ...o, type: 'exit', notes: o.notes || '' }));
      this._closings = (Array.isArray(closings) ? closings : []).map((c: any) => ({
        ...c,
        totalSold: Number(c.totalSold || 0),
        netProfit: Number(c.netProfit || 0),
        cogs: Number(c.cogs || 0),
        debtsPaid: Number(c.debtsPaid || 0),
        cashInBox: Number(c.cashInBox || 0)
      }));
      this._audits = Array.isArray(priceHistory) ? priceHistory : [];
      
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
  getAudits() { return this._audits; },
  getDraftPhysicalCount() { return this._draftPhysicalCount; },
  setDraftPhysicalCount(draft: OutputTransaction[]) {
    this._draftPhysicalCount = draft;
    this._notify();
  },
  setDraftClosingData(data: any[]) { 
    this._draftClosingData = data; 
    this._notify();
  },
  getDraftClosingData() { return this._draftClosingData; },
  clearDraftClosingData() { 
    this._draftClosingData = null; 
    this._notify();
  },

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
    const oldProduct = this._products.find(prod => prod.id === p.id);
    if (oldProduct) {
      if (Number(oldProduct.costPrice) !== Number(p.costPrice)) {
        await this.saveAudit({ 
          id: "AUDIT-" + Math.random().toString(36).substr(2, 9),
          productId: p.id, 
          productName: p.name, 
          field: 'Costo', 
          oldValue: oldProduct.costPrice, 
          newValue: p.costPrice, 
          date: new Date().toISOString() 
        });
      }
      if (Number(oldProduct.salePrice) !== Number(p.salePrice)) {
        await this.saveAudit({ 
          id: "AUDIT-" + Math.random().toString(36).substr(2, 9),
          productId: p.id, 
          productName: p.name, 
          field: 'Precio', 
          oldValue: oldProduct.salePrice, 
          newValue: p.salePrice, 
          date: new Date().toISOString() 
        });
      }
    }
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
  async saveInput(i: InputTransaction) {
    const res = await runGas('saveInput', i);
    if (res && res.success) {
      const oldInput = this._inputs.find(inp => inp.id === i.id);
      const oldQty = oldInput ? (Number(oldInput.quantity) || 0) : 0;
      const oldCost = oldInput ? (Number(oldInput.totalCost) || 0) : 0;
      
      // Recalcular localmente totalCost = quantity * unitCost
      const newQty = Number(i.quantity) || 0;
      const newUnitCost = Number(i.unitCost) || 0;
      const newCost = newQty * newUnitCost;
      
      // Asegurar que el objeto modificado conserve su propiedad notes y el nuevo costo
      const updatedInput = { 
        ...i, 
        totalCost: newCost,
        notes: (i.notes && i.notes.trim() !== "") ? i.notes : (oldInput?.notes || "")
      };
      
      const diffQty = newQty - oldQty;
      const diffCost = newCost - oldCost;

      // 1. Actualizar Inputs (map)
      if (oldInput) {
        this._inputs = this._inputs.map(inp => inp.id === i.id ? updatedInput : inp);
      } else {
        this._inputs = [updatedInput, ...this._inputs];
      }

      // 2. Actualizar Products (Delta)
      this._products = this._products.map(p => {
        if (String(p.id) === String(i.productId)) {
          return {
            ...p,
            stock: (Number(p.stock) || 0) + diffQty,
            totalInputs: (Number(p.totalInputs) || 0) + diffQty,
            totalInvested: (Number(p.totalInvested) || 0) + diffCost,
            costPrice: newUnitCost
          };
        }
        return p;
      });

      // 3. Actualizar PurchaseNotes (Delta y Recálculo)
      const noteRef = updatedInput.notes;
      if (noteRef.startsWith("Compra: ")) {
        const noteId = noteRef.replace("Compra: ", "").trim();
        this._purchaseNotes = this._purchaseNotes.map(note => {
          if (note.id === noteId) {
            let details = [];
            try {
              details = JSON.parse(note.detailsJson || "[]");
            } catch(e) {}
            
            const newDetails = details.map((item: any) => {
              if (String(item.productId) === String(i.productId)) {
                return { ...item, quantity: newQty, totalCost: newCost };
              }
              return item;
            });

            // Recalcular totalAmount sumando todos los ítems
            const newTotal = newDetails.reduce((acc: number, curr: any) => acc + (Number(curr.totalCost) || 0), 0);
            const realDiff = newTotal - (Number(note.totalAmount) || 0);

            // Ajustar sobre 4 si estaba pagada
            if (note.status === 'Paid' && realDiff !== 0) {
              this._envelopes = this._envelopes.map(env => 
                env.id === 'ENV4' ? { ...env, balance: (Number(env.balance) || 0) - realDiff } : env
              );
            }

            return { ...note, totalAmount: newTotal, detailsJson: JSON.stringify(newDetails) };
          }
          return note;
        });
      }
      
      this._notify();
    }
    return res;
  },
  async deleteInput(id: string) {
    const res = await runGas('deleteInput', id);
    if (res && res.success) {
      const inputToDelete = this._inputs.find(i => i.id === id);
      if (inputToDelete) {
        const qty = Number(inputToDelete.quantity) || 0;
        const cost = Number(inputToDelete.totalCost) || 0;

        // 1. Restar cantidad en Products (Inmutabilidad estricta)
        this._products = this._products.map(p => {
          if (String(p.id) === String(inputToDelete.productId)) {
            return {
              ...p,
              stock: (Number(p.stock) || 0) - qty,
              totalInputs: (Number(p.totalInputs) || 0) - qty,
              totalInvested: (Number(p.totalInvested) || 0) - cost
            };
          }
          return p;
        });

        // 2. Actualizar PurchaseNotes (Borrado condicional)
        const noteRef = inputToDelete.notes || "";
        if (noteRef.startsWith("Compra: ")) {
          const noteId = noteRef.replace("Compra: ", "").trim();
          this._purchaseNotes = this._purchaseNotes.reduce((acc, note) => {
            if (note.id === noteId) {
              const currentTotal = Number(note.totalAmount) || 0;
              const newTotal = Math.max(0, currentTotal - cost);
              
              let details = [];
              try {
                details = JSON.parse(note.detailsJson || "[]");
              } catch(e) {}
              
              const newDetails = details.filter((item: any) => String(item.productId) !== String(inputToDelete.productId));
              
              // Si la nota queda en $0 o vacía, quítala (Borrado en cascada condicional)
              if (newDetails.length === 0 || newTotal <= 0) {
                return acc;
              }

              // Si la nota estaba pagada, devolver el dinero al sobre 4 (Capital) localmente
              if (note.status === 'Paid') {
                this._envelopes = this._envelopes.map(env => 
                  env.id === 'ENV4' ? { ...env, balance: (Number(env.balance) || 0) + cost } : env
                );
              }

              acc.push({ ...note, totalAmount: newTotal, detailsJson: JSON.stringify(newDetails) });
            } else {
              acc.push(note);
            }
            return acc;
          }, [] as PurchaseNote[]);
        }

        // 3. Filtra el input de this._inputs
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
      this._closings = [c, ...this._closings.filter(cl => cl.id !== c.id)];
      this._notify();
    }
    return res;
  },
  async updateClosing(id: string, newData: any) {
    const res = await runGas('updateClosing', { id, newData });
    if (res && res.success) {
      await this.fetchAll();
    }
    return res;
  },
  async deleteClosing(id: string) {
    const res = await runGas('deleteClosing', id);
    if (res && res.success) {
      const closingToDelete = this._closings.find(c => c.id === id);
      if (closingToDelete) {
        // 1. Revertir stock de productos localmente
        // El backend devuelve los productos vendidos en el cierre para revertir
        if (res.revertProducts) {
          this._products = this._products.map(p => {
            const soldItem = res.revertProducts.find((item: any) => String(item.productId) === String(p.id));
            if (soldItem) {
              const qty = Number(soldItem.quantity) || 0;
              const sale = Number(soldItem.totalSale) || 0;
              return {
                ...p,
                stock: (Number(p.stock) || 0) + qty,
                totalOutputs: (Number(p.totalOutputs) || 0) - qty,
                totalEarned: (Number(p.totalEarned) || 0) - sale
              };
            }
            return p;
          });
        }

        // 2. Revertir deudas localmente
        if (res.revertNotes) {
          this._purchaseNotes = this._purchaseNotes.map(n => {
            if (res.revertNotes.includes(n.id)) {
              return { ...n, status: 'Pending', paymentSource: 'Capital' };
            }
            return n;
          });
        }

        // 3. Revertir sobres localmente
        const profit = Number(closingToDelete.netProfit) || 0;
        const cogs = Number(closingToDelete.cogs) || 0;
        this._envelopes = this._envelopes.map(e => {
          if (e.id === 'ENV4') return { ...e, balance: (Number(e.balance) || 0) - cogs };
          if (profit > 0 && ['ENV1', 'ENV2', 'ENV3'].includes(e.id)) {
            return { ...e, balance: (Number(e.balance) || 0) - (profit / 3) };
          }
          return e;
        });

        // 4. Eliminar registros de outputs asociados
        this._outputs = this._outputs.filter(o => o.notes !== `Cierre Maestro: ${id}`);
        
        // 4. Eliminar el cierre
        this._closings = this._closings.filter(c => c.id !== id);
        
        this._notify();
      }
    }
    return res;
  },
  async saveMasterClosing(data: {
    closing: DailyClosing,
    products: any[],
    debtsToPay: { id: string, method: 'Sales' | 'Capital' }[]
  }) {
    const res = await runGas('saveMasterClosing', data);
    if (res && res.success) {
      // 1. Actualizar stock de productos localmente
      this._products = this._products.map(p => {
        const soldItem = data.products.find(item => String(item.productId) === String(p.id));
        if (soldItem) {
          const qty = Number(soldItem.quantity) || 0;
          const sale = Number(soldItem.totalSale) || 0;
          return {
            ...p,
            stock: (Number(p.stock) || 0) - qty,
            totalOutputs: (Number(p.totalOutputs) || 0) + qty,
            totalEarned: (Number(p.totalEarned) || 0) + sale
          };
        }
        return p;
      });

      // 2. Actualizar deudas localmente y calcular total pagado con capital para ajuste de Sobre 4
      let totalDebtsFromCapital = 0;
      this._purchaseNotes = this._purchaseNotes.map(n => {
        const debt = data.debtsToPay.find(d => d.id === n.id);
        if (debt) {
          if (debt.method === 'Capital') {
            totalDebtsFromCapital += (Number(n.totalAmount) || 0);
          }
          return { ...n, status: 'Paid', paymentSource: debt.method };
        }
        return n;
      });

      // 3. Crear registro de output localmente
      const masterOutput: OutputTransaction = {
        id: "OUT-" + Math.random().toString(36).substr(2, 9),
        productId: "MASTER",
        productName: "Cierre Maestro",
        quantity: 0,
        salePrice: 0,
        totalSale: data.closing.totalSold,
        date: data.closing.date,
        shift: "General",
        notes: `Cierre Maestro: ${data.closing.id}`,
        type: 'exit'
      };
      this._outputs = [masterOutput, ...this._outputs];

      // 4. Guardar el cierre localmente
      this._closings = [data.closing, ...this._closings];

      // 5. Distribuir utilidad y COGS en sobres localmente
      const profit = Number(data.closing.netProfit) || 0;
      const cogs = Number(data.closing.cogs) || 0;
      
      // Flujo neto para Sobre 4: Costo de mercancía - Deudas pagadas con Capital
      const netCapitalFlow = cogs - totalDebtsFromCapital;

      this._envelopes = this._envelopes.map(e => {
        if (e.id === 'ENV4') return { ...e, balance: (Number(e.balance) || 0) + netCapitalFlow };
        if (profit > 0 && ['ENV1', 'ENV2', 'ENV3'].includes(e.id)) {
          return { ...e, balance: (Number(e.balance) || 0) + (profit / 3) };
        }
        return e;
      });

      // 6. Limpiar el borrador de inventario
      this._draftPhysicalCount = [];

      this._notify();
    }
    return res;
  },
  async saveAudit(h: AuditLog) { await runGas('saveAudit', h); await this.fetchAll(); },
  async deleteAudit(id: string) { await runGas('deleteAudit', id); await this.fetchAll(); },
  async saveEnvelope(e: Envelope) { await runGas('saveEnvelope', e); await this.fetchAll(); },
  async updateEnvelope(envelope: Partial<Envelope> & { id: string }) {
    const res = await runGas('updateEnvelope', envelope);
    if (res && res.success) {
      this._envelopes = this._envelopes.map(e => {
        if (e.id === envelope.id) {
          return {
            ...e,
            balance: envelope.balance !== undefined ? Number(envelope.balance) : e.balance,
            percentage: envelope.percentage !== undefined ? Number(envelope.percentage) : e.percentage
          };
        }
        return e;
      });
      this._notify();
    }
    return res;
  },
  async withdrawEnvelope(w: EnvelopeWithdrawal) { await runGas('withdrawEnvelope', w); await this.fetchAll(); },
  async deleteWithdrawal(id: string) { await runGas('deleteWithdrawal', id); await this.fetchAll(); },
  async updateWithdrawal(w: EnvelopeWithdrawal) { await runGas('updateWithdrawal', w); await this.fetchAll(); },
  async saveRestockNote(note: PurchaseNote) {
    const res = await runGas('savePurchaseNote', note);
    if (res && res.success) {
      const isUpdate = this._purchaseNotes.some(n => n.id === note.id);
      const details = JSON.parse(note.detailsJson || '[]');
      
      if (isUpdate) {
        this._purchaseNotes = this._purchaseNotes.map(n => n.id === note.id ? note : n);
      } else {
        this._purchaseNotes = [note, ...this._purchaseNotes];
        
        // Crear entradas individuales en el estado local (Solo para notas nuevas)
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
              totalInvested: (Number(p.totalInvested) || 0) + (Number(item.totalCost) || 0),
              costPrice: Number(item.unitCost) || 0
            };
          }
          return p;
        });

        if (note.status === 'Paid') {
          this._envelopes = this._envelopes.map(e => 
            e.id === 'ENV4' ? { ...e, balance: (Number(e.balance) || 0) - (Number(note.totalAmount) || 0) } : e
          );
        }
      }
      this._notify();
    }
    return res;
  },
  async deletePurchaseNote(id: string) {
    const res = await runGas('deletePurchaseNote', id);
    if (res && res.success) {
      const noteToDelete = this._purchaseNotes.find(n => n.id === id);
      if (noteToDelete) {
        // 1. Encuentra todos los inputs en this._inputs vinculados a esa nota
        const noteMatch = "Compra: " + id;
        const linkedInputs = this._inputs.filter(i => i.notes === noteMatch);

        // 2. Revertir stock de cada input vinculado en this._products
        this._products = this._products.map(p => {
          const inputsForThisProduct = linkedInputs.filter(i => String(i.productId) === String(p.id));
          if (inputsForThisProduct.length > 0) {
            const totalQty = inputsForThisProduct.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
            const totalCost = inputsForThisProduct.reduce((acc, curr) => acc + (Number(curr.totalCost) || 0), 0);
            return {
              ...p,
              stock: (Number(p.stock) || 0) - totalQty,
              totalInputs: (Number(p.totalInputs) || 0) - totalQty,
              totalInvested: (Number(p.totalInvested) || 0) - totalCost
            };
          }
          return p;
        });

        // 3. Usa .filter() para eliminar la nota de this._purchaseNotes y los inputs de this._inputs
        this._inputs = this._inputs.filter(i => i.notes !== noteMatch);
        this._purchaseNotes = this._purchaseNotes.filter(n => n.id !== id);

        // 4. Si estaba pagada, devolver capital al sobre 4
        if (noteToDelete.status === 'Paid') {
          this._envelopes = this._envelopes.map(e => 
            e.id === 'ENV4' ? { ...e, balance: (Number(e.balance) || 0) + (Number(noteToDelete.totalAmount) || 0) } : e
          );
        }

        this._notify();
      }
    }
    return res;
  },
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
  async updateNoteStatus(id: string, status: 'Paid' | 'Pending', source: 'Sales' | 'Capital' = 'Capital') {
    const res = await runGas('updateNoteStatus', { id, status, source });
    if (res && res.success) {
      const note = this._purchaseNotes.find(n => n.id === id);
      if (note) {
        // Si pasa a Paid y el origen es Capital (Sobre 4)
        if (status === 'Paid' && note.status === 'Pending' && source === 'Capital') {
          this._envelopes = this._envelopes.map(e => 
            e.id === 'ENV4' ? { ...e, balance: (Number(e.balance) || 0) - (Number(note.totalAmount) || 0) } : e
          );
        }
        // Si pasa a Pending, devolver al sobre 4 solo si el origen era Capital
        else if (status === 'Pending' && note.status === 'Paid') {
          const oldSource = note.paymentSource || 'Capital';
          if (oldSource === 'Capital') {
            this._envelopes = this._envelopes.map(e => 
              e.id === 'ENV4' ? { ...e, balance: (Number(e.balance) || 0) + (Number(note.totalAmount) || 0) } : e
            );
          }
        }
        
        this._purchaseNotes = this._purchaseNotes.map(n => n.id === id ? { ...n, status, paymentSource: source } : n);
        this._notify();
      }
    }
    return res;
  },
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
            totalInvested: (Number(p.totalInvested) || 0) + (Number(newItem.totalCost) || 0),
            costPrice: Number(newItem.unitCost) || 0
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
  async deleteItemFromNote(noteId: string, productId: string) {
    const res = await runGas('deleteItemFromPurchaseNote', { noteId, productId });
    if (res && res.success) {
      const note = this._purchaseNotes.find(n => n.id === noteId);
      if (!note) return res;

      const details = JSON.parse(note.detailsJson || '[]');
      const itemToDelete = details.find((d: any) => String(d.productId) === String(productId));
      if (!itemToDelete) return res;

      const qtyToDelete = Number(itemToDelete.quantity) || 0;
      const costToDelete = Number(itemToDelete.totalCost) || 0;

      // 1. Filtrar el ítem borrado de this._inputs (Doble Condición)
      this._inputs = this._inputs.filter(i => {
        const isTargetNote = i.notes?.includes(noteId);
        const isTargetProduct = String(i.productId) === String(productId);
        // Mantenemos si NO coinciden ambos al mismo tiempo
        return !(isTargetNote && isTargetProduct);
      });

      // 2. Restar la cantidad al stock en this._products (Solo para ese productId)
      this._products = this._products.map(p => {
        if (String(p.id) === String(productId)) {
          return {
            ...p,
            stock: (Number(p.stock) || 0) - qtyToDelete,
            totalInputs: (Number(p.totalInputs) || 0) - qtyToDelete,
            totalInvested: (Number(p.totalInvested) || 0) - costToDelete
          };
        }
        return p;
      });

      // 3. Actualizar o eliminar la nota (Lógica de Precisión Local)
      const updatedNotes = this._purchaseNotes.map(n => {
        if (n.id === noteId) {
          const currentDetails = JSON.parse(n.detailsJson || '[]');
          const filteredDetails = currentDetails.filter((p: any) => String(p.productId) !== String(productId));
          const newTotal = (Number(n.totalAmount) || 0) - costToDelete;
          
          return {
            ...n,
            totalAmount: newTotal,
            detailsJson: JSON.stringify(filteredDetails)
          };
        }
        return n;
      });

      // Si el detailsJson resultante queda vacío, sacamos la nota
      this._purchaseNotes = updatedNotes.filter(n => {
        const details = JSON.parse(n.detailsJson || '[]');
        return details.length > 0 && Number(n.totalAmount) > 0;
      });

      this._notify();
    }
    return res;
  },
  processPhysicalCount(counts: Record<string, number>, shift: string) {
    const products = this.getProducts();
    const draft: OutputTransaction[] = [];
    let totalSold = 0;
    let totalCOGS = 0;

    Object.entries(counts).forEach(([id, val]) => {
      const product = products.find(p => String(p.id) === String(id));
      if (product) {
        const systemStock = Number(product.stock) || 0;
        const physicalCount = Number(val) || 0;
        const difference = systemStock - physicalCount;
        
        if (difference > 0) {
          const itemSale = difference * product.salePrice;
          const itemCost = difference * product.costPrice;
          totalSold += itemSale;
          totalCOGS += itemCost;

          draft.push({
            id: "DFT-" + Math.random().toString(36).substr(2, 9),
            productId: product.id,
            productName: product.name,
            quantity: difference,
            salePrice: product.salePrice,
            totalSale: itemSale,
            date: new Date().toISOString(),
            shift: shift,
            notes: "Diferencia Inventario Físico",
            type: 'exit'
          });
        }
      }
    });

    this._draftPhysicalCount = draft;
    this._notify();
    return { 
      success: true, 
      draft,
      totalSold,
      totalCOGS,
      netProfit: totalSold - totalCOGS
    };
  },
  async sync() { await this.fetchAll(); return { success: true }; }
};
