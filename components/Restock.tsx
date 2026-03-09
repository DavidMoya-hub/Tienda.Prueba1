import React, { useState, useRef, useMemo } from 'react';
import { ShoppingCart, Search, Trash2, Camera, Banknote, CheckCircle2, Package, Tag, Calculator } from 'lucide-react';
import { dataService } from '../services/dataService';
import { processTicketWithGemini } from '../services/geminiService';
import { Product, PurchaseNote } from '../types';

const Restock: React.FC = () => {
  const [cart, setCart] = useState<any[]>([]);
  const [provider, setProvider] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<'Paid' | 'Pending'>('Paid');
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  const products = dataService.getProducts();
  const envelopes = dataService.getEnvelopes();
  const capitalBalance = envelopes.find(e => e.id === "ENV4")?.balance || 0;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return [];
    return products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.code.includes(searchTerm)).slice(0, 5);
  }, [products, searchTerm]);

  const addToCart = (product: Product, quantity: number = 1) => {
    const existing = cart.find(item => item.productId === product.id);
    if (existing) {
      setCart(cart.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + quantity, totalCost: (item.quantity + quantity) * item.unitCost } : item));
    } else {
      setCart([...cart, { productId: product.id, productName: product.name, quantity, unitCost: product.costPrice, totalCost: product.costPrice * quantity }]);
    }
    setSearchTerm(''); setIsSearching(false);
  };

  const handleOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        const results = await processTicketWithGemini(base64);
        results.forEach(result => {
          const match = products.find(p => p.code === result.code || p.name.toLowerCase().includes(result.name.toLowerCase()));
          if (match) addToCart(match, result.quantity);
        });
      } catch (err) { alert("Error en OCR"); } finally { setIsLoading(false); }
    };
    reader.readAsDataURL(file);
  };

  const completeRestock = async () => {
    if (cart.length === 0) return;
    const total = cart.reduce((acc, item) => acc + item.totalCost, 0);
    if (status === 'Paid' && capitalBalance < total) {
      if (!confirm("El saldo del Sobre 4 es insuficiente. ¿Deseas continuar de todas formas?")) return;
    }
    
    setIsLoading(true);
    try {
      const note: PurchaseNote = { id: 'NOTE-' + Math.random().toString(36).substr(2, 9).toUpperCase(), date: new Date(date).toISOString(), provider: provider || 'Proveedor Gral', totalAmount: total, status, detailsJson: JSON.stringify(cart) };
      await dataService.saveRestockNote(note);
      setCart([]); setProvider('');
      alert("¡Compra registrada correctamente!");
    } catch (e) { alert("Error al registrar"); } finally { setIsLoading(false); }
  };

  const grandTotal = cart.reduce((acc, item) => acc + item.totalCost, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-10 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="lg:col-span-2 space-y-6 md:space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
          <h2 className="text-2xl md:text-4xl font-black text-blue-900 tracking-tighter">Entrada de Mercancía</h2>
          <div className="flex items-center space-x-2 md:space-x-4">
            <div className="flex-1 md:flex-none bg-white px-3 md:px-8 py-2 md:py-4 rounded-xl md:rounded-3xl border-2 border-blue-50 flex items-center space-x-2 md:space-x-4 shadow-xl shadow-blue-900/5">
              <Banknote className="text-red-600 w-5 h-5 md:w-8 md:h-8" />
              <div>
                <span className="text-[7px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Bóveda Capital</span>
                <span className="text-sm md:text-2xl font-black text-blue-900">${capitalBalance.toLocaleString()}</span>
              </div>
            </div>
            <button onClick={() => fileInputRef.current?.click()} className="bg-red-600 text-white p-3 md:p-5 rounded-xl md:rounded-3xl hover:bg-red-700 transition-all shadow-xl shadow-red-900/30 active:scale-95"><Camera size={18} className="md:w-7 md:h-7" /></button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleOCR} />
          </div>
        </div>

        <div className="bg-white p-5 md:p-10 rounded-2xl md:rounded-[2.5rem] border border-blue-100 shadow-xl space-y-5 md:space-y-8">
          <div className="relative">
            <label className="block text-[10px] md:text-xs font-black text-blue-900 uppercase tracking-widest mb-2 md:mb-3 px-1">Buscador Inteligente</label>
            <div className="relative">
              <Search className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-blue-400 md:w-6 md:h-6" size={18} />
              <input 
                type="text" 
                placeholder="Nombre o Código..." 
                value={searchTerm}
                onFocus={() => setIsSearching(true)}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 md:pl-16 pr-4 md:pr-6 py-3 md:py-5 bg-blue-50/50 border-2 border-transparent rounded-xl md:rounded-3xl focus:bg-white focus:border-blue-500 transition-all font-black text-sm md:text-xl text-slate-800"
              />
            </div>
            {isSearching && filteredProducts.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 md:mt-3 bg-white border border-blue-100 rounded-xl md:rounded-[2rem] shadow-2xl z-50 overflow-hidden divide-y divide-blue-50 animate-in fade-in slide-in-from-top-2 duration-200">
                {filteredProducts.map(p => (
                  <button key={p.id} onClick={() => addToCart(p)} className="w-full p-4 md:p-6 flex items-center justify-between hover:bg-blue-50 transition-all group">
                    <div className="text-left">
                      <p className="font-black text-slate-800 text-sm md:text-lg group-hover:text-blue-600 transition-colors">{p.name}</p>
                      <p className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stock: {p.stock}</p>
                    </div>
                    <span className="bg-red-50 text-red-600 px-3 md:px-5 py-1 md:py-2 rounded-lg md:rounded-2xl font-black text-xs md:text-base shadow-sm">${p.costPrice}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            <div className="space-y-1 md:space-y-2">
              <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Proveedor</label>
              <input value={provider} onChange={(e) => setProvider(e.target.value)} className="w-full p-3 md:p-5 bg-slate-50 border-2 border-transparent rounded-lg md:rounded-2xl font-black text-sm md:text-slate-800 focus:bg-white focus:border-slate-300 transition-all" placeholder="Ej. Marinela / Pepsi" />
            </div>
            <div className="space-y-1 md:space-y-2">
              <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Fecha Factura</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-3 md:p-5 bg-slate-50 border-2 border-transparent rounded-lg md:rounded-2xl font-black text-sm md:text-slate-800 focus:bg-white focus:border-slate-300 transition-all" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl md:rounded-[2.5rem] border border-blue-100 overflow-hidden shadow-xl shadow-blue-900/5 divide-y divide-blue-50">
          <div className="p-4 md:p-6 bg-blue-50/50 flex items-center justify-between">
            <h3 className="text-[10px] md:text-sm font-black text-blue-900 uppercase tracking-widest flex items-center gap-2">
              <Package size={16} className="md:w-[18px] md:h-[18px]" /> <span>Lista de Carga</span>
            </h3>
            <span className="text-[8px] md:text-[10px] font-black text-blue-400 uppercase">{cart.length} artículos</span>
          </div>
          {cart.map(item => (
            <div key={item.productId} className="p-4 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50/50 transition-colors group gap-3 md:gap-4">
              <div className="flex-1">
                <p className="font-black text-base md:text-xl text-slate-800">{item.productName}</p>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-[10px] md:text-xs font-bold text-slate-400 flex items-center gap-1"><Tag size={10} className="md:w-3 md:h-3"/> ${item.unitCost} c/u</span>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end space-x-4 md:space-x-8">
                <div className="flex items-center bg-blue-50 rounded-lg md:rounded-2xl p-0.5 md:p-1 border border-blue-100">
                  <input type="number" min="1" value={item.quantity} onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    setCart(cart.map(i => i.productId === item.productId ? {...i, quantity: val, totalCost: val * i.unitCost} : i));
                  }} className="w-12 md:w-20 p-1.5 md:p-3 bg-white rounded md:rounded-xl text-center font-black text-blue-600 focus:outline-none text-xs md:text-base" />
                </div>
                <span className="text-lg md:text-2xl font-black text-slate-900 w-20 md:w-32 text-right tracking-tighter">${item.totalCost.toFixed(2)}</span>
                <button onClick={() => setCart(cart.filter(i => i.productId !== item.productId))} className="text-slate-300 hover:text-red-500 transition-all"><Trash2 className="md:w-6 md:h-6" size={18} /></button>
              </div>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="py-16 md:py-24 text-center space-y-4">
              <ShoppingCart className="mx-auto text-blue-100 md:w-16 md:h-16" size={48} />
              <p className="text-blue-300 font-black italic text-lg md:text-xl">Tu lista de compra está vacía.</p>
            </div>
          )}
        </div>
      </div>

      <div className="lg:col-span-1">
        <div className="bg-blue-900 text-white p-6 md:p-10 rounded-2xl md:rounded-[3rem] shadow-2xl h-full flex flex-col justify-between border-4 border-blue-800 lg:sticky lg:top-24 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
          
          <div className="space-y-6 md:space-y-10 relative z-10">
            <h3 className="text-xl md:text-3xl font-black text-red-500 flex items-center space-x-3 tracking-tighter">
              <Calculator size={24} className="md:w-9 md:h-9"/>
              <span>Total Nota</span>
            </h3>
            
            <div className="space-y-4 md:space-y-6">
              <div className="flex justify-between text-blue-300 font-black uppercase text-[9px] md:text-xs tracking-widest px-2">
                <span>Subtotal:</span>
                <span>${grandTotal.toLocaleString()}</span>
              </div>
              <div className="p-5 md:p-8 bg-white/5 rounded-2xl md:rounded-[2rem] border border-white/10 shadow-inner">
                <span className="text-blue-400 font-black text-[7px] md:text-[10px] uppercase tracking-[0.2em] mb-2 block">Importe a Pagar</span>
                <span className="text-3xl md:text-6xl font-black text-white tracking-tighter block">${grandTotal.toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[9px] md:text-xs font-black text-blue-400 uppercase tracking-widest px-2 mb-2 md:mb-4">Estado de la Factura</p>
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <button 
                  onClick={() => setStatus('Paid')} 
                  className={`py-3 md:py-5 rounded-lg md:rounded-2xl font-black transition-all border-2 text-[9px] md:text-sm tracking-widest ${status === 'Paid' ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/40' : 'border-blue-800 text-blue-400 hover:bg-blue-800'}`}
                >
                  PAGADO
                </button>
                <button 
                  onClick={() => setStatus('Pending')} 
                  className={`py-3 md:py-5 rounded-lg md:rounded-2xl font-black transition-all border-2 text-[9px] md:text-sm tracking-widest ${status === 'Pending' ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-900/40' : 'border-blue-800 text-blue-400 hover:bg-blue-800'}`}
                >
                  DEUDA
                </button>
              </div>
            </div>
          </div>

          <button 
            onClick={completeRestock} 
            disabled={cart.length === 0 || isLoading} 
            className="w-full bg-red-600 py-4 md:py-7 rounded-xl md:rounded-3xl font-black text-lg md:text-2xl mt-8 md:mt-12 hover:bg-red-500 transition-all shadow-2xl shadow-red-900/50 active:scale-95 disabled:opacity-30 disabled:grayscale tracking-tighter"
          >
            REGISTRAR COMPRA
          </button>
        </div>
      </div>
    </div>
  );
};

export default Restock;