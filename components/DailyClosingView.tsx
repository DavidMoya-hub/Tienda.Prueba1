import React, { useState, useMemo, useEffect } from 'react';
import { DollarSign, Tag, Calculator, Save, Check, ArrowRightCircle, CreditCard, Wallet, X, PlusCircle, Minus, Plus, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { dataService } from '../services/dataService';
import { OutputTransaction, PurchaseNote, DailyClosing } from '../types';

const DailyClosingView: React.FC = () => {
  const products = dataService.getProducts();
  const purchaseNotes = dataService.getPurchaseNotes();
  const allOutputs = dataService.getOutputs();
  const allClosings = dataService.getClosings();

  const [manualSales, setManualSales] = useState<any[]>([]);
  const [excludedDebts, setExcludedDebts] = useState<Set<string>>(new Set());
  const [debtPaymentMethods, setDebtPaymentMethods] = useState<Record<string, 'Sales' | 'Capital'>>({});
  const [saved, setSaved] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [notes, setNotes] = useState('');

  // Find the last closing date to filter outputs
  const lastClosingDate = useMemo(() => {
    if (allClosings.length === 0) return new Date(0);
    const sorted = [...allClosings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return new Date(sorted[0].date);
  }, [allClosings]);

  // Filter outputs since last closing
  const periodOutputs = useMemo(() => {
    return allOutputs.filter(o => new Date(o.date).getTime() > lastClosingDate.getTime());
  }, [allOutputs, lastClosingDate]);

  const filteredProducts = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    if (!searchLower) return [];
    return products.filter(p => 
      String(p.name || '').toLowerCase().includes(searchLower) || 
      String(p.code || '').toLowerCase().includes(searchLower)
    ).slice(0, 10);
  }, [products, searchTerm]);

  const addSaleItem = (product: any, quantity: number) => {
    setManualSales([...manualSales, {
      id: "MAN-" + Math.random().toString(36).substr(2, 9),
      productId: product.id,
      name: product.name,
      quantity,
      salePrice: product.salePrice,
      costPrice: product.costPrice,
      totalSale: product.salePrice * quantity,
      totalCost: product.costPrice * quantity
    }]);
    setSearchTerm('');
  };

  const updateManualQuantity = (id: string, delta: number) => {
    setManualSales(manualSales.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return {
          ...item,
          quantity: newQty,
          totalSale: item.salePrice * newQty,
          totalCost: item.costPrice * newQty
        };
      }
      return item;
    }));
  };

  const pendingNotes = useMemo(() => {
    return purchaseNotes.filter(n => n.status === 'Pending');
  }, [purchaseNotes]);

  const debtsToPay = useMemo(() => {
    return pendingNotes.filter(n => !excludedDebts.has(n.id));
  }, [pendingNotes, excludedDebts]);

  const toggleDebt = (id: string) => {
    const newExcluded = new Set(excludedDebts);
    if (newExcluded.has(id)) {
      newExcluded.delete(id);
    } else {
      newExcluded.add(id);
    }
    setExcludedDebts(newExcluded);
  };

  const setPaymentMethod = (id: string, method: 'Sales' | 'Capital') => {
    setDebtPaymentMethods(prev => ({ ...prev, [id]: method }));
  };

  // Financial Calculations
  const periodSalesTotal = periodOutputs.reduce((acc, o) => acc + (Number(o.totalSale) || 0), 0);
  const manualSalesTotal = manualSales.reduce((acc, i) => acc + i.totalSale, 0);
  const totalSold = periodSalesTotal + manualSalesTotal;

  const periodCOGSTotal = periodOutputs.reduce((acc, o) => {
    const prod = products.find(p => String(p.id) === String(o.productId));
    const cost = prod ? (Number(prod.costPrice) || 0) : 0;
    return acc + (o.quantity * cost);
  }, 0);
  const manualCOGSTotal = manualSales.reduce((acc, i) => acc + i.totalCost, 0);
  const totalCOGS = periodCOGSTotal + manualCOGSTotal;

  const netProfit = totalSold - totalCOGS;

  const debtsPaidWithSales = debtsToPay.reduce((acc, n) => {
    const method = debtPaymentMethods[n.id] || 'Sales';
    return method === 'Sales' ? acc + (Number(n.totalAmount) || 0) : acc;
  }, 0);

  const debtsPaidWithCapital = debtsToPay.reduce((acc, n) => {
    const method = debtPaymentMethods[n.id] || 'Sales';
    return method === 'Capital' ? acc + (Number(n.totalAmount) || 0) : acc;
  }, 0);

  const cashInBox = totalSold - debtsPaidWithSales;

  const handleClosing = async () => {
    try {
      // 1. Save manual sales as outputs
      if (manualSales.length > 0) {
        const outputs: OutputTransaction[] = manualSales.map(item => ({
          id: item.id,
          productId: item.productId,
          productName: item.name,
          quantity: item.quantity,
          salePrice: item.salePrice,
          totalSale: item.totalSale,
          date: new Date().toISOString(),
          shift: 'General',
          notes: 'Venta manual en cierre', 
          type: 'exit'
        }));
        await dataService.saveOutputBatch(outputs);
      }

      // 2. Process debt payments
      for (const note of debtsToPay) {
        const method = debtPaymentMethods[note.id] || 'Sales';
        await dataService.updateNoteStatus(note.id, 'Paid', method);
      }

      // 3. Save closing report
      await dataService.saveClosing({
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString(),
        totalSold,
        cogs: totalCOGS,
        netProfit,
        debtsPaid: debtsPaidWithSales + debtsPaidWithCapital,
        cashInBox,
        notes: notes || `Cierre general. Deudas pagadas: ${debtsToPay.length}`
      });

      setSaved(true);
      setManualSales([]);
      setExcludedDebts(new Set());
      setDebtPaymentMethods({});
      setNotes('');
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Error al realizar el cierre:", error);
      alert("Error al realizar el cierre. Revisa la consola.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Corte de Caja Maestro</h2>
          <p className="text-sm md:text-base text-slate-500">
            Resumen de ventas desde el último cierre ({lastClosingDate.toLocaleString()})
          </p>
        </div>
        <div className="bg-blue-50 px-4 py-2 rounded-2xl border border-blue-100 flex items-center gap-3">
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
          <span className="text-blue-700 font-black text-xs uppercase tracking-widest">Cierre General Activo</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        {/* Left Column: Sales & Debts */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Period Sales Summary */}
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-lg font-black text-slate-800 flex items-center space-x-2">
              <ArrowRightCircle className="text-emerald-500" size={20} />
              <span>Ventas del Periodo</span>
            </h3>
            
            <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
              {periodOutputs.length > 0 ? (
                periodOutputs.map((o, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <span className="font-bold text-slate-700 block text-sm">{o.productName}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                        {o.quantity} unidades • ${o.salePrice} c/u
                      </span>
                    </div>
                    <span className="font-black text-slate-900">${(o.totalSale || 0).toFixed(2)}</span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-400 italic text-sm">No hay ventas registradas en este periodo.</div>
              )}
            </div>
          </div>

          {/* Manual Sales Entry */}
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-lg font-black text-slate-800 flex items-center space-x-2">
              <PlusCircle className="text-blue-500" size={20} />
              <span>Agregar Ventas Faltantes</span>
            </h3>
            <div className="relative">
              <input 
                type="text"
                placeholder="Buscar producto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-blue-500 transition-all font-bold text-slate-700 text-sm"
              />
              {searchTerm && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
                  {filteredProducts.map(p => (
                    <button
                      key={p.id}
                      onClick={() => addSaleItem(p, 1)}
                      className="w-full p-4 text-left hover:bg-blue-50 flex justify-between items-center border-b border-slate-50 last:border-0 transition-colors"
                    >
                      <div>
                        <span className="font-black text-slate-800 block text-sm">{p.name}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Stock: {p.stock} • ${p.salePrice}</span>
                      </div>
                      <PlusCircle className="text-blue-500" size={20} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              {manualSales.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-blue-50/30 rounded-xl border border-blue-100">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center bg-white rounded-lg border border-blue-100 p-1">
                      <button onClick={() => updateManualQuantity(item.id, -1)} className="p-1 text-blue-600"><Minus size={12} /></button>
                      <span className="w-6 text-center font-black text-blue-900 text-xs">{item.quantity}</span>
                      <button onClick={() => updateManualQuantity(item.id, 1)} className="p-1 text-blue-600"><Plus size={12} /></button>
                    </div>
                    <span className="font-bold text-slate-800 text-sm">{item.name}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="font-black text-slate-900 text-sm">${item.totalSale.toFixed(2)}</span>
                    <button onClick={() => setManualSales(manualSales.filter(i => i.id !== item.id))} className="text-red-400"><X size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Debt Manager */}
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-lg font-black text-slate-800 flex items-center space-x-2">
              <Wallet className="text-amber-500" size={20} />
              <span>Gestor de Deudas Pendientes</span>
            </h3>
            <div className="space-y-4">
              {pendingNotes.length > 0 ? (
                pendingNotes.map(note => (
                  <div key={note.id} className={`p-4 rounded-2xl border-2 transition-all ${excludedDebts.has(note.id) ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-amber-50/30 border-amber-100 shadow-sm'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => toggleDebt(note.id)}
                          className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${excludedDebts.has(note.id) ? 'bg-slate-200 text-slate-400' : 'bg-amber-500 text-white shadow-lg shadow-amber-200'}`}
                        >
                          {excludedDebts.has(note.id) ? <Plus size={14} /> : <Check size={14} />}
                        </button>
                        <div>
                          <span className="font-black text-slate-800 block">{note.provider}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(note.date).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <span className="font-black text-lg text-amber-600">${Number(note.totalAmount).toLocaleString()}</span>
                    </div>
                    
                    {!excludedDebts.has(note.id) && (
                      <div className="flex gap-2 mt-2">
                        <button 
                          onClick={() => setPaymentMethod(note.id, 'Sales')}
                          className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${ (debtPaymentMethods[note.id] || 'Sales') === 'Sales' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-white text-slate-400 border border-slate-200'}`}
                        >
                          Pagar con Ventas
                        </button>
                        <button 
                          onClick={() => setPaymentMethod(note.id, 'Capital')}
                          className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${ debtPaymentMethods[note.id] === 'Capital' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-400 border border-slate-200'}`}
                        >
                          Pagar con Capital
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-400 italic text-sm">No hay deudas pendientes por liquidar.</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Summary & Finalization */}
        <div className="lg:col-span-5">
          <div className="bg-slate-900 text-white p-6 md:p-8 rounded-[2.5rem] shadow-2xl space-y-6 md:space-y-8 sticky top-8 border-4 border-slate-800">
            <h3 className="text-xl md:text-2xl font-black flex items-center space-x-3 text-blue-400 tracking-tight">
              <Calculator size={24} />
              <span>Resumen de Cierre</span>
            </h3>

            <div className="space-y-5">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-bold text-sm">Ventas Totales</span>
                <span className="text-2xl font-black text-white">${totalSold.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="flex justify-between items-center border-t border-slate-800 pt-4">
                <span className="text-slate-400 font-bold text-sm">Costo de Mercancía</span>
                <span className="text-xl font-bold text-slate-300">-${totalCOGS.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-emerald-400 font-black text-sm uppercase tracking-widest">Utilidad Neta</span>
                <span className="text-2xl font-black text-emerald-400">${netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="space-y-3 border-t border-slate-800 pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold text-sm">Deudas Pagadas (Ventas)</span>
                  <span className="text-lg font-bold text-red-400">-${debtsPaidWithSales.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold text-sm">Deudas Pagadas (Capital)</span>
                  <span className="text-lg font-bold text-blue-400">-${debtsPaidWithCapital.toLocaleString()}</span>
                </div>
              </div>

              <div className="bg-blue-600/10 p-6 rounded-[2rem] border border-blue-500/20 shadow-inner">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-blue-300 font-black text-xs uppercase tracking-widest">Efectivo para Entregar</span>
                  <DollarSign className="text-blue-400" size={16} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-4xl font-black text-blue-400 tracking-tighter">${cashInBox.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <p className="text-[10px] text-blue-400/60 mt-2 font-bold uppercase tracking-tight">Ventas Totales - Deudas pagadas con ventas</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Notas del Cierre</label>
                <textarea 
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Observaciones sobre el corte..."
                  className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold focus:border-blue-500 outline-none transition-all h-20 resize-none"
                />
              </div>
            </div>

            <button 
              onClick={handleClosing}
              disabled={totalSold === 0 && debtsToPay.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-blue-900/50 active:scale-95 flex items-center justify-center space-x-3 disabled:opacity-50 text-lg"
            >
              {saved ? <Check size={24} /> : <Save size={24} />}
              <span>{saved ? '¡Cierre Exitoso!' : 'Realizar Corte Maestro'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyClosingView;