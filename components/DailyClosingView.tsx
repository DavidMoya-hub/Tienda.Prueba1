import React, { useState, useMemo } from 'react';
import { DollarSign, Tag, Calculator, Save, Check, ArrowRightCircle, CreditCard, Wallet, X, PlusCircle, Minus, Plus } from 'lucide-react';
import { dataService } from '../services/dataService';

const DailyClosingView: React.FC = () => {
  const products = dataService.getProducts();
  const purchaseNotes = dataService.getPurchaseNotes();
  const [salesItems, setSalesItems] = useState<any[]>([]);
  const [shift, setShift] = useState('Day');
  const [saved, setSaved] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');

  const filteredProducts = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    return products.filter(p => 
      String(p.name || '').toLowerCase().includes(searchLower) || 
      String(p.code || '').toLowerCase().includes(searchLower)
    ).slice(0, 10);
  }, [products, searchTerm]);

  // Calculate supplier payments made TODAY
  const todayPayments = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return purchaseNotes
      .filter(note => note.date.split('T')[0] === today && note.status === 'Paid')
      .reduce((acc, note) => acc + (Number(note.totalAmount) || 0), 0);
  }, [purchaseNotes]);

  const addSaleItem = (product: any, quantity: number) => {
    setSalesItems([...salesItems, {
      id: Math.random().toString(36).substr(2, 9),
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

  const updateQuantity = (id: string, delta: number) => {
    setSalesItems(salesItems.map(item => {
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

  const handleClosing = () => {
    if (salesItems.length === 0) return;

    const totalSold = salesItems.reduce((acc, i) => acc + i.totalSale, 0);
    const totalCOGS = salesItems.reduce((acc, i) => acc + i.totalCost, 0);
    const netProfit = totalSold - totalCOGS;

    const outputs: any[] = salesItems.map(item => ({
      id: item.id,
      productId: item.productId,
      productName: item.name,
      quantity: item.quantity,
      salePrice: item.salePrice,
      totalSale: item.totalSale,
      date: new Date().toISOString(),
      shift,
      notes: '', 
      type: 'exit'
    }));

    dataService.saveOutputBatch(outputs);

    dataService.saveClosing({
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString(),
      totalSold,
      netProfit,
      cogs: totalCOGS
    });

    setSaved(true);
    setSalesItems([]);
    setTimeout(() => setSaved(false), 3000);
  };

  const totalSold = salesItems.reduce((acc, i) => acc + i.totalSale, 0);
  const totalCOGS = salesItems.reduce((acc, i) => acc + i.totalCost, 0);
  const finalCash = totalSold - todayPayments;

  return (
    <div className="max-w-5xl mx-auto space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Corte de Caja Diario</h2>
          <p className="text-sm md:text-base text-slate-500">Registra ventas y revisa el flujo de efectivo real del día.</p>
        </div>
        <div className="flex bg-slate-100 p-1 md:p-1.5 rounded-xl md:rounded-2xl border border-slate-200 shadow-inner w-full md:w-auto">
          <button 
            onClick={() => setShift('Day')}
            className={`flex-1 md:flex-none px-4 md:px-6 py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-black transition-all ${shift === 'Day' ? 'bg-white shadow-md text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Matutino
          </button>
          <button 
            onClick={() => setShift('Night')}
            className={`flex-1 md:flex-none px-4 md:px-6 py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-black transition-all ${shift === 'Night' ? 'bg-white shadow-md text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Vespertino
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-5 md:p-8 rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm space-y-4 md:space-y-6">
            <h3 className="text-base md:text-lg font-black text-slate-800 flex items-center space-x-2">
              <Tag className="text-blue-500 md:w-5 md:h-5" size={18} />
              <span>Entrada Rápida de Ventas</span>
            </h3>
            <div className="space-y-4">
              <div className="relative">
                <input 
                  type="text"
                  placeholder="Buscar producto por nombre o código..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full p-3 md:p-4 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-700 text-xs md:text-base"
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
                    {filteredProducts.length === 0 && (
                      <div className="p-4 text-center text-slate-400 font-medium italic">No se encontraron productos.</div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="space-y-3 max-h-[300px] md:max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {salesItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 md:p-4 bg-white rounded-xl md:rounded-2xl border border-slate-100 shadow-sm hover:border-blue-200 transition-all group">
                    <div className="flex items-center space-x-3 md:space-x-4">
                      <div className="flex items-center bg-blue-50 rounded-xl border border-blue-100 p-1">
                        <button 
                          onClick={() => updateQuantity(item.id, -1)}
                          className="p-1 hover:bg-white rounded-lg transition-colors text-blue-600"
                        >
                          <Minus size={14} />
                        </button>
                        <div className="w-8 text-center font-black text-blue-900 text-sm">
                          {item.quantity}
                        </div>
                        <button 
                          onClick={() => updateQuantity(item.id, 1)}
                          className="p-1 hover:bg-white rounded-lg transition-colors text-blue-600"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 block text-xs md:text-base">{item.name}</span>
                        <span className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-tighter">Precio: ${item.salePrice} c/u</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 md:space-x-4">
                      <span className="font-black text-base md:text-lg text-slate-900">${item.totalSale.toFixed(2)}</span>
                      <button 
                        onClick={() => setSalesItems(salesItems.filter((_, i) => i !== idx))}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <X size={16} className="md:w-[18px] md:h-[18px]" />
                      </button>
                    </div>
                  </div>
                ))}
                {salesItems.length === 0 && (
                  <div className="py-16 md:py-20 text-center space-y-3">
                    <Calculator className="mx-auto text-slate-200 md:w-12 md:h-12" size={40} />
                    <p className="text-slate-400 font-medium italic text-xs md:text-base">Busca y agrega productos vendidos durante el turno.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="bg-slate-900 text-white p-6 md:p-8 rounded-2xl md:rounded-[2rem] shadow-2xl space-y-6 md:space-y-8 h-full flex flex-col justify-between border-4 border-slate-800">
            <div className="space-y-6 md:space-y-8">
              <h3 className="text-xl md:text-2xl font-black flex items-center space-x-3 text-blue-400 tracking-tight">
                <Calculator size={24} className="md:w-8 md:h-8" />
                <span>Cálculo de Turno</span>
              </h3>

              <div className="space-y-4 md:space-y-6">
                <div className="flex justify-between items-center group">
                  <span className="text-slate-400 font-bold flex items-center space-x-2 text-xs md:text-sm">
                    <CreditCard size={16} className="md:w-[18px] md:h-[18px]" /> <span>Ventas Brutas</span>
                  </span>
                  <span className="text-2xl md:text-3xl font-black text-white leading-none">${totalSold.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="flex justify-between items-center group border-t border-slate-800 pt-4 md:pt-6">
                  <span className="text-slate-400 font-bold flex items-center space-x-2 text-xs md:text-sm">
                    <Wallet size={16} className="md:w-[18px] md:h-[18px]" /> <span>Pagos Proveedores (Hoy)</span>
                  </span>
                  <span className="text-xl md:text-2xl font-bold text-red-400 leading-none">-${todayPayments.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="bg-blue-600/10 p-4 md:p-6 rounded-2xl md:rounded-3xl mt-4 md:mt-6 border border-blue-500/20 shadow-inner">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-blue-300 font-black text-[10px] md:text-xs uppercase tracking-widest">Efectivo Sugerido en Caja</span>
                    <Check className="text-blue-400 md:w-4 md:h-4" size={14} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-3xl md:text-4xl font-black text-blue-400 tracking-tighter">${finalCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <p className="text-[8px] md:text-[10px] text-blue-400/60 mt-2 font-bold uppercase tracking-tight">Ventas Totales - Salidas de efectivo registradas</p>
                </div>
                
                <div className="flex justify-between items-center text-slate-500 pt-2 md:pt-4 px-2">
                  <span className="text-[10px] md:text-xs font-bold uppercase">Utilidad Proyectada:</span>
                  <span className="font-black text-emerald-500 text-sm md:text-base">${(totalSold - totalCOGS).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <button 
              onClick={handleClosing}
              disabled={salesItems.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 md:py-5 rounded-xl md:rounded-2xl transition-all shadow-xl shadow-blue-900/50 active:scale-95 flex items-center justify-center space-x-3 disabled:opacity-50 text-base md:text-lg mt-6"
            >
              {saved ? <Check size={20} className="md:w-6 md:h-6" /> : <Save size={20} className="md:w-6 md:h-6" />}
              <span>{saved ? '¡Corte Guardado!' : 'Finalizar Turno'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyClosingView;