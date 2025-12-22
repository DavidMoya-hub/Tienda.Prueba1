
import React, { useState, useMemo, useRef } from 'react';
import { Save, Calculator, CheckCircle2, Wallet, ArrowRight, RefreshCcw, Search, AlertCircle, Store, Camera, Loader2, Image as ImageIcon } from 'lucide-react';
import { dataService } from '../services/dataService';
import { processInventoryImage } from '../services/geminiService';

const DailyInventoryCount: React.FC = () => {
  const products = dataService.getProducts();
  const purchaseNotes = dataService.getPurchaseNotes();
  const envelopes = dataService.getEnvelopes();
  const [counts, setCounts] = useState<{ [key: string]: number }>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.code.includes(searchTerm)
    );
  }, [products, searchTerm]);

  const pendingNotes = useMemo(() => {
    const notes = purchaseNotes || [];
    return notes.filter((n: any) => n.status === 'Pending');
  }, [purchaseNotes]);

  const capitalBalance = envelopes.find(e => e.id === "ENV4")?.balance || 0;

  const handleCountChange = (id: string, val: string) => {
    setCounts({ ...counts, [id]: parseInt(val) || 0 });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        const results = await processInventoryImage(base64);
        
        const newCounts = { ...counts };
        let matchCount = 0;

        results.forEach(res => {
          // Mapeo flexible: Busca coincidencias por nombre
          const match = products.find(p => 
            p.name.toLowerCase().includes(res.name.toLowerCase()) ||
            res.name.toLowerCase().includes(p.name.toLowerCase())
          );
          
          if (match) {
            newCounts[match.id] = res.physicalCount;
            matchCount++;
          }
        });

        setCounts(newCounts);
        if (matchCount > 0) {
          alert(`Se detectaron y mapearon ${matchCount} productos desde la imagen.`);
        } else {
          alert("No se encontraron coincidencias exactas de productos en la imagen.");
        }
      } catch (err) {
        alert("Error procesando imagen de inventario: " + err);
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const processClosing = async () => {
    if (Object.keys(counts).length === 0) return alert("Ingresa al menos un conteo físico.");
    
    setIsProcessing(true);
    try {
      const payload = Object.entries(counts).map(([id, val]) => ({ productId: id, physicalCount: val }));
      const res = await dataService.processPhysicalCount(payload, 'Daily Count');
      setSummary(res);
      if (pendingNotes.length > 0) setShowDebtModal(true);
    } catch (e) {
      alert("Error procesando el cierre.");
    } finally {
      setIsProcessing(false);
    }
  };

  const payNote = async (id: string) => {
    await dataService.updateNoteStatus(id, 'Paid');
    alert("Nota pagada con éxito");
  };

  if (summary) {
    return (
      <div className="max-w-2xl mx-auto space-y-8 animate-in zoom-in-95 duration-500">
        <div className="bg-white p-12 rounded-[3rem] border-4 border-red-50 shadow-[0_35px_60px_-15px_rgba(0,0,0,0.1)] space-y-10 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-600 to-blue-900"></div>
          
          <div className="bg-emerald-100 text-emerald-600 w-24 h-24 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 size={56} />
          </div>
          
          <div>
            <h2 className="text-4xl font-black text-blue-900 tracking-tighter mb-2">Salida Registrada</h2>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em]">Cierre tiendita Certificado</p>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="p-8 bg-blue-50/50 rounded-[2.5rem] border border-blue-100 shadow-sm group hover:bg-blue-600 transition-all duration-500">
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-1 group-hover:text-blue-100">Venta Bruta</span>
              <p className="text-3xl font-black text-blue-900 group-hover:text-white transition-colors">${summary.totalSold.toLocaleString()}</p>
            </div>
            <div className="p-8 bg-red-50/50 rounded-[2.5rem] border border-red-100 shadow-sm group hover:bg-red-600 transition-all duration-500">
              <span className="text-[10px] font-black text-red-400 uppercase tracking-widest block mb-1 group-hover:text-red-100">Utilidad Real</span>
              <p className="text-3xl font-black text-red-600 group-hover:text-white transition-colors">${summary.netProfit.toLocaleString()}</p>
            </div>
          </div>

          <div className="p-8 bg-slate-900 rounded-[2.5rem] text-left space-y-4 border-2 border-slate-800 shadow-xl shadow-slate-900/40">
            <div className="flex items-center space-x-3 text-red-500 font-black uppercase text-xs tracking-widest">
              <Wallet size={18} /> <span>Auditoría de Flujos</span>
            </div>
            <p className="text-sm text-slate-300 font-medium leading-relaxed">
              La utilidad se ha dividido en <strong className="text-white">3 partes iguales</strong> para los sobres operativos. El 100% del costo (<strong className="text-red-400">${summary.totalCOGS.toLocaleString()}</strong>) ha sido blindado en el <strong className="text-blue-400">Sobre 4 de Capital</strong> para resurtido.
            </p>
          </div>

          <button 
            onClick={() => { setSummary(null); setCounts({}); }} 
            className="w-full bg-blue-900 text-white font-black py-6 rounded-2xl hover:bg-blue-800 transition-all flex items-center justify-center space-x-3 shadow-xl shadow-blue-900/30 text-lg active:scale-95"
          >
            <span>Nueva Operación</span>
            <ArrowRight size={20} />
          </button>
        </div>

        {showDebtModal && pendingNotes.length > 0 && (
          <div className="bg-white p-10 rounded-[2.5rem] border-2 border-red-100 shadow-2xl space-y-8 animate-in slide-in-from-bottom-10 duration-700">
            <div className="flex items-center space-x-4">
              <div className="bg-red-600 text-white p-3 rounded-2xl shadow-lg shadow-red-200">
                <AlertCircle size={24} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-blue-900 tracking-tight">Cuentas por Pagar</h3>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Utiliza tu capital recuperado</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {pendingNotes.map((n: any) => (
                <div key={n.id} className="flex items-center justify-between p-6 bg-blue-50/30 rounded-3xl border border-blue-100 transition-all hover:border-blue-300 group">
                  <div>
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-1">{n.provider}</span>
                    <p className="text-2xl font-black text-blue-900 tracking-tighter">${Number(n.totalAmount).toLocaleString()}</p>
                  </div>
                  <button 
                    onClick={() => payNote(n.id)}
                    disabled={capitalBalance < Number(n.totalAmount)}
                    className="bg-red-600 text-white px-8 py-3 rounded-2xl font-black text-sm hover:bg-red-700 transition-all shadow-xl shadow-red-900/20 disabled:opacity-20 disabled:grayscale active:scale-95"
                  >
                    Liquidar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-500">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-blue-900 tracking-tighter flex items-center gap-3">
            <Store className="text-red-600" size={36} />
            Inventario Físico
          </h2>
          <p className="text-slate-500 font-medium italic">Registra salidas comparando Stock Real vs Stock Sistema.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center justify-center space-x-3 bg-red-600 text-white px-6 py-4 rounded-2xl font-black hover:bg-red-700 transition-all shadow-xl shadow-red-900/20 active:scale-95 disabled:opacity-50"
          >
            {isUploading ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
            <span>Cargar Foto Inventario</span>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            accept="image/*" 
            className="hidden" 
          />
          
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-blue-400 group-focus-within:text-red-600 transition-colors" size={20} />
            <input 
              type="text"
              placeholder="Buscar producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 pl-14 pr-6 py-4 bg-white border-2 border-blue-50 rounded-[2rem] shadow-sm focus:border-blue-500 focus:outline-none font-bold text-slate-700 transition-all"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] border border-blue-100 shadow-2xl shadow-blue-900/5 overflow-hidden">
        <div className="p-8 bg-blue-50/50 border-b border-blue-50 grid grid-cols-12 text-[10px] font-black uppercase text-blue-900/40 tracking-[0.2em]">
          <div className="col-span-4 md:col-span-5">Producto / Proveedor</div>
          <div className="col-span-2 md:col-span-2 text-center">Sistema</div>
          <div className="col-span-3 md:col-span-2 text-center">Físico</div>
          <div className="col-span-3 md:col-span-3 text-right">Salida (Dif)</div>
        </div>
        <div className="divide-y divide-blue-50 max-h-[600px] overflow-y-auto custom-scrollbar">
          {filteredProducts.map(p => {
            const systemStock = p.stock || 0;
            const physicalCount = counts[p.id] !== undefined ? counts[p.id] : systemStock;
            const diff = systemStock - physicalCount;
            const isOutput = diff > 0;

            return (
              <div key={p.id} className={`p-8 grid grid-cols-12 items-center hover:bg-blue-50/20 transition-all group ${isOutput ? 'bg-red-50/20' : ''}`}>
                <div className="col-span-4 md:col-span-5">
                  <span className="font-black text-slate-800 block text-lg mb-1 group-hover:text-blue-600 transition-colors">{p.name}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{p.provider} • {p.code}</span>
                </div>
                <div className="col-span-2 md:col-span-2 text-center">
                  <span className="bg-white px-4 py-2 rounded-xl text-blue-900 font-black text-sm shadow-sm border border-blue-50">{systemStock}</span>
                </div>
                <div className="col-span-3 md:col-span-2 flex justify-center">
                  <input 
                    type="number"
                    placeholder={systemStock.toString()}
                    value={counts[p.id] !== undefined ? counts[p.id] : ''}
                    onChange={(e) => handleCountChange(p.id, e.target.value)}
                    className={`w-20 md:w-28 p-4 border-2 border-transparent rounded-[1.5rem] text-center font-black text-xl focus:bg-white focus:outline-none transition-all shadow-inner ${
                      counts[p.id] !== undefined ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-50 text-slate-400'
                    }`}
                  />
                </div>
                <div className="col-span-3 md:col-span-3 text-right">
                  {isOutput ? (
                    <div className="flex flex-col items-end">
                      <span className="bg-red-600 text-white px-4 py-1.5 rounded-xl font-black text-sm shadow-lg shadow-red-200">
                        -{diff} unidades
                      </span>
                      <span className="text-[9px] font-black text-red-400 uppercase mt-1 tracking-widest">Salida automática</span>
                    </div>
                  ) : (
                    <span className="text-xs font-black text-slate-300 uppercase italic">Sin cambios</span>
                  )}
                </div>
              </div>
            );
          })}
          {filteredProducts.length === 0 && (
            <div className="p-32 text-center text-blue-200 font-black italic text-xl">No hay artículos que coincidan.</div>
          )}
        </div>
        <div className="p-10 bg-blue-900 border-t border-blue-800 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center space-x-4">
             <div className="bg-red-600 p-3 rounded-2xl shadow-lg shadow-red-900/40">
                <Calculator className="text-white" size={24} />
             </div>
             <div>
                <p className="text-white font-black uppercase text-xs tracking-widest">Auditoría tiendita AI</p>
                <p className="text-blue-400 text-xs font-medium italic">Se registrarán salidas solo si el Físico es menor al Sistema.</p>
             </div>
          </div>
          <button 
            onClick={processClosing}
            disabled={isProcessing || Object.keys(counts).length === 0}
            className="w-full md:w-auto flex items-center justify-center space-x-4 bg-red-600 text-white px-16 py-6 rounded-2xl font-black hover:bg-red-500 transition-all shadow-2xl shadow-red-900/50 active:scale-95 disabled:opacity-30 disabled:grayscale text-xl tracking-tighter"
          >
            {isProcessing ? <RefreshCcw className="animate-spin" /> : <Save size={28} />}
            <span>Procesar Diferencias y Cerrar</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DailyInventoryCount;
