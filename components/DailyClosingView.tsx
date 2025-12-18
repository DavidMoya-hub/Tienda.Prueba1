import React, { useState, useMemo } from 'react';
import { DollarSign, Tag, Calculator, Save, Check, ArrowRightCircle, CreditCard, Wallet } from 'lucide-react';
import { dataService } from '../services/dataService';

const DailyClosingView: React.FC = () => {
  const products = dataService.getProducts();
  const purchaseNotes = dataService.getPurchaseNotes();
  const [salesItems, setSalesItems] = useState<any[]>([]);
  const [shift, setShift] = useState('Day');
  const [saved, setSaved] = useState(false);

  // Calculate supplier payments made TODAY
  const todayPayments = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return purchaseNotes
      .filter(note => note.date.split('T')[0] === today && note.status === 'Paid')
      .reduce((acc, note) => acc + (Number(note.totalAmount) || 0), 0);
  }, [purchaseNotes]);

  const addSaleItem = (productId: string, quantity: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    setSalesItems([...salesItems, {
      id: Math.random().toString(36).substr(2, 9),
      productId,
      name: product.name,
      quantity,
      salePrice: product.salePrice,
      costPrice: product.costPrice,
      totalSale: product.salePrice * quantity,
      totalCost: product.costPrice * quantity
    }]);
  };

  const handleClosing = () => {
    if (salesItems.length === 0) return;

    const totalSold = salesItems.reduce((acc, i) => acc + i.totalSale, 0);
    const totalCOGS = salesItems.reduce((acc, i) => acc + i.totalCost, 0);
    const netProfit = totalSold - totalCOGS;

    salesItems.forEach(item => {
      dataService.saveOutput({
        id: item.id,
        productId: item.productId,
        productName: item.name,
        quantity: item.quantity,
        salePrice: item.salePrice,
        totalSale: item.totalSale,
        date: new Date().toISOString(),
        shift
      });
    });

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
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Corte de Caja Diario</h2>
          <p className="text-slate-500">Registra ventas y revisa el flujo de efectivo real del día.</p>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
          <button 
            onClick={() => setShift('Day')}
            className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${shift === 'Day' ? 'bg-white shadow-md text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Matutino
          </button>
          <button 
            onClick={() => setShift('Night')}
            className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${shift === 'Night' ? 'bg-white shadow-md text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Vespertino
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <h3 className="text-lg font-black text-slate-800 flex items-center space-x-2">
              <Tag className="text-blue-500" size={20} />
              <span>Entrada Rápida de Ventas</span>
            </h3>
            <div className="space-y-4">
              <div className="relative">
                <select 
                  onChange={(e) => {
                    if (e.target.value) addSaleItem(e.target.value, 1);
                    e.target.value = "";
                  }}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-700"
                >
                  <option value="">Selecciona un producto para vender...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} - ${p.salePrice} (Stock: {p.stock})</option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {salesItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-blue-200 transition-all group">
                    <div className="flex items-center space-x-4">
                      <div className="bg-blue-600 text-white w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-lg shadow-blue-200">
                        {item.quantity}
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 block">{item.name}</span>
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-tighter">Precio: ${item.salePrice} c/u</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="font-black text-lg text-slate-900">${item.totalSale.toFixed(2)}</span>
                      <button 
                        onClick={() => setSalesItems(salesItems.filter((_, i) => i !== idx))}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Tag size={18} />
                      </button>
                    </div>
                  </div>
                ))}
                {salesItems.length === 0 && (
                  <div className="py-20 text-center space-y-3">
                    <Calculator className="mx-auto text-slate-200" size={48} />
                    <p className="text-slate-400 font-medium italic">Agrega productos vendidos durante el turno.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="bg-slate-900 text-white p-8 rounded-[2rem] shadow-2xl space-y-8 h-full flex flex-col justify-between border-4 border-slate-800">
            <div className="space-y-8">
              <h3 className="text-2xl font-black flex items-center space-x-3 text-blue-400 tracking-tight">
                <Calculator size={32} />
                <span>Cálculo de Turno</span>
              </h3>

              <div className="space-y-6">
                <div className="flex justify-between items-center group">
                  <span className="text-slate-400 font-bold flex items-center space-x-2">
                    <CreditCard size={18} /> <span>Ventas Brutas</span>
                  </span>
                  <span className="text-3xl font-black text-white leading-none">${totalSold.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="flex justify-between items-center group border-t border-slate-800 pt-6">
                  <span className="text-slate-400 font-bold flex items-center space-x-2">
                    <Wallet size={18} /> <span>Pagos Proveedores (Hoy)</span>
                  </span>
                  <span className="text-2xl font-bold text-red-400 leading-none">-${todayPayments.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="bg-blue-600/10 p-6 rounded-3xl mt-6 border border-blue-500/20 shadow-inner">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-blue-300 font-black text-xs uppercase tracking-widest">Efectivo Sugerido en Caja</span>
                    <Check className="text-blue-400" size={16} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-4xl font-black text-blue-400 tracking-tighter">${finalCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <p className="text-[10px] text-blue-400/60 mt-2 font-bold uppercase tracking-tight">Ventas Totales - Salidas de efectivo registradas</p>
                </div>
                
                <div className="flex justify-between items-center text-slate-500 pt-4 px-2">
                  <span className="text-xs font-bold uppercase">Utilidad Proyectada:</span>
                  <span className="font-black text-emerald-500">${(totalSold - totalCOGS).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <button 
              onClick={handleClosing}
              disabled={salesItems.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-blue-900/50 active:scale-95 flex items-center justify-center space-x-3 disabled:opacity-50 text-lg"
            >
              {saved ? <Check size={24} /> : <Save size={24} />}
              <span>{saved ? '¡Corte Guardado!' : 'Finalizar Turno'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyClosingView;