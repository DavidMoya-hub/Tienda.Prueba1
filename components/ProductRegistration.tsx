
import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Camera, Check, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { processTicketWithGemini } from '../services/geminiService';
import { dataService } from '../services/dataService';

const ProductRegistration: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleEnterPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const formInputs = Array.from(
        document.querySelectorAll('input:not([disabled]):not([type="checkbox"]):not([type="hidden"]), select:not([disabled])')
      ) as (HTMLInputElement | HTMLSelectElement)[];
      const index = formInputs.indexOf(e.currentTarget as any);
      if (index > -1 && index < formInputs.length - 1) {
        formInputs[index + 1].focus();
        if ('select' in formInputs[index + 1]) {
          (formInputs[index + 1] as HTMLInputElement).select();
        }
      }
    }
  };

  const editMode = !!location.state?.product;

  const [formData, setFormData] = useState({
    id: '',
    code: '',
    name: '',
    grams: '',
    flavor: '',
    costPrice: '',
    salePrice: '',
    stock: '',
    category: 'General',
    provider: ''
  });

  useEffect(() => {
    if (location.state?.product) {
      const p = location.state.product;
      setFormData({
        id: p.id,
        code: p.code,
        name: p.name,
        grams: p.grams,
        flavor: p.flavor,
        costPrice: p.costPrice.toString(),
        salePrice: p.salePrice.toString(),
        stock: p.stock.toString(),
        category: p.category || 'General',
        provider: p.provider || ''
      });
    }
  }, [location.state]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        const results = await processTicketWithGemini(base64);
        
        if (results.length > 0) {
          const item = results[0];
          setFormData(prev => ({
            ...prev,
            code: item.code || prev.code,
            name: item.name,
            grams: item.grams || prev.grams,
            flavor: item.flavor || prev.flavor,
            costPrice: item.costPrice.toString(),
            salePrice: (item.salePrice || item.costPrice * 1.3).toFixed(2),
            stock: item.quantity.toString()
          }));
        }
      } catch (err: any) {
        setError(err.message || 'Error procesando OCR');
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const existingProduct = editMode ? dataService.getProducts().find(p => p.id === formData.id) : null;
      
      // Fix: Ensure all properties required by Product interface are present
      const product = {
        id: editMode ? formData.id : Math.random().toString(36).substr(2, 9),
        code: formData.code,
        name: formData.name,
        grams: formData.grams,
        flavor: formData.flavor,
        costPrice: parseFloat(formData.costPrice),
        salePrice: parseFloat(formData.salePrice),
        stock: parseInt(formData.stock),
        category: formData.category,
        provider: formData.provider,
        totalInvested: editMode ? (existingProduct?.totalInvested || 0) : (parseFloat(formData.costPrice) * parseInt(formData.stock)),
        totalEarned: editMode ? (existingProduct?.totalEarned || 0) : 0,
        totalInputs: editMode ? (existingProduct?.totalInputs || 0) : parseInt(formData.stock),
        totalOutputs: editMode ? (existingProduct?.totalOutputs || 0) : 0
      };

      await dataService.saveProduct(product);
      setSuccess(true);
      if (editMode) {
        setTimeout(() => navigate('/inventory'), 1500);
      } else {
        setTimeout(() => setSuccess(false), 3000);
        setFormData({ id: '', code: '', name: '', grams: '', flavor: '', costPrice: '', salePrice: '', stock: '', category: 'General', provider: '' });
      }
    } catch (err) {
      setError("No se pudo guardar el producto.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div className="flex items-center space-x-4">
          {editMode && (
            <button onClick={() => navigate('/inventory')} className="p-3 bg-white hover:bg-red-50 text-red-600 rounded-2xl transition-all border border-red-50 shadow-sm active:scale-95">
              <ArrowLeft size={24} />
            </button>
          )}
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-blue-900 tracking-tight">
              {editMode ? 'Editar Artículo' : 'Nuevo Producto'}
            </h2>
            <p className="text-xs md:text-sm text-slate-500 font-medium">
              {editMode ? `Actualizando ${formData.name}` : 'Registra productos o usa IA con foto.'}
            </p>
          </div>
        </div>
        {!editMode && (
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="flex items-center justify-center space-x-2 bg-blue-900 text-white px-6 md:px-8 py-3 md:py-4 rounded-2xl hover:bg-blue-800 transition-all shadow-xl shadow-blue-900/20 active:scale-95 disabled:opacity-50 font-black uppercase text-[10px] md:text-xs tracking-widest w-full md:w-auto"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
            <span>IA Foto OCR</span>
          </button>
        )}
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
      </div>

      {error && (
        <div className="mb-8 p-4 md:p-5 bg-red-50 border-2 border-red-100 text-red-600 rounded-2xl md:rounded-[2rem] flex items-center space-x-3 font-bold text-sm md:text-base">
          <AlertCircle size={24} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-5 md:p-10 rounded-2xl md:rounded-[2.5rem] border border-blue-100 shadow-2xl shadow-blue-900/5 space-y-5 md:space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">
          <div className="space-y-2 md:space-y-3">
            <label className="text-[10px] md:text-xs font-black text-blue-900 uppercase tracking-widest block px-1">Código de Barras</label>
            <input 
              required
              value={formData.code}
              onChange={(e) => setFormData({...formData, code: e.target.value})}
              onKeyDown={handleEnterPress}
              className="w-full px-4 md:px-5 py-3 md:py-4 bg-blue-50/30 border-2 border-transparent rounded-xl md:rounded-2xl focus:bg-white focus:border-blue-500 focus:outline-none transition-all font-bold text-slate-800 text-sm md:text-base"
              placeholder="Ej. 750100..."
            />
          </div>
          <div className="space-y-2 md:space-y-3">
            <label className="text-[10px] md:text-xs font-black text-blue-900 uppercase tracking-widest block px-1">Categoría</label>
            <select 
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              onKeyDown={handleEnterPress as any}
              className="w-full px-4 md:px-5 py-3 md:py-4 bg-blue-50/30 border-2 border-transparent rounded-xl md:rounded-2xl focus:bg-white focus:border-blue-500 focus:outline-none transition-all font-bold text-slate-800 text-sm md:text-base"
            >
              <option>General</option>
              <option>Abarrotes</option>
              <option>Snacks</option>
              <option>Bebidas</option>
              <option>Lácteos</option>
              <option>Higiene</option>
              <option>Farmacia</option>
            </select>
          </div>
        </div>

        <div className="space-y-2 md:space-y-3">
          <label className="text-[10px] md:text-xs font-black text-blue-900 uppercase tracking-widest block px-1">Nombre Comercial</label>
          <input 
            required
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            onKeyDown={handleEnterPress}
            className="w-full px-4 md:px-5 py-3 md:py-4 bg-blue-50/30 border-2 border-transparent rounded-xl md:rounded-2xl focus:bg-white focus:border-blue-500 focus:outline-none transition-all font-bold text-slate-800 text-sm md:text-base"
            placeholder="Ej. Coca-Cola Original"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">
          <div className="space-y-2 md:space-y-3">
            <label className="text-[10px] md:text-xs font-black text-blue-900 uppercase tracking-widest block px-1">Proveedor Oficial</label>
            <input 
              value={formData.provider}
              onChange={(e) => setFormData({...formData, provider: e.target.value})}
              onKeyDown={handleEnterPress}
              className="w-full px-4 md:px-5 py-3 md:py-4 bg-blue-50/30 border-2 border-transparent rounded-xl md:rounded-2xl focus:bg-white focus:border-blue-500 focus:outline-none transition-all font-bold text-slate-800 text-sm md:text-base"
              placeholder="Ej. PepsiCo / Marinela"
            />
          </div>
          <div className="space-y-2 md:space-y-3">
            <label className="text-[10px] md:text-xs font-black text-blue-900 uppercase tracking-widest block px-1">Presentación (G/ML)</label>
            <input 
              value={formData.grams}
              onChange={(e) => setFormData({...formData, grams: e.target.value})}
              onKeyDown={handleEnterPress}
              className="w-full px-4 md:px-5 py-3 md:py-4 bg-blue-50/30 border-2 border-transparent rounded-xl md:rounded-2xl focus:bg-white focus:border-blue-500 focus:outline-none transition-all font-bold text-slate-800 text-sm md:text-base"
              placeholder="Ej. 600ml"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 md:gap-8 pt-6 border-t border-blue-50">
          <div className="space-y-2 md:space-y-3">
            <label className="text-[10px] md:text-xs font-black text-blue-900 uppercase tracking-widest block px-1">Costo ($)</label>
            <input 
              required
              type="number" step="0.01"
              value={formData.costPrice}
              onChange={(e) => setFormData({...formData, costPrice: e.target.value})}
              onKeyDown={handleEnterPress}
              className="w-full px-4 md:px-5 py-3 md:py-4 bg-red-50/50 border-2 border-transparent rounded-xl md:rounded-2xl focus:bg-white focus:border-red-500 focus:outline-none transition-all font-black text-red-600 text-base md:text-lg"
            />
          </div>
          <div className="space-y-2 md:space-y-3">
            <label className="text-[10px] md:text-xs font-black text-blue-900 uppercase tracking-widest block px-1">Venta ($)</label>
            <input 
              required
              type="number" step="0.01"
              value={formData.salePrice}
              onChange={(e) => setFormData({...formData, salePrice: e.target.value})}
              onKeyDown={handleEnterPress}
              className="w-full px-4 md:px-5 py-3 md:py-4 bg-blue-50/50 border-2 border-transparent rounded-xl md:rounded-2xl focus:bg-white focus:border-blue-500 focus:outline-none transition-all font-black text-blue-600 text-base md:text-lg"
            />
          </div>
          <div className="space-y-2 md:space-y-3">
            <label className="text-[10px] md:text-xs font-black text-blue-900 uppercase tracking-widest block px-1">Stock {editMode ? 'Actual' : 'Inicial'}</label>
            <input 
              required
              type="number"
              value={formData.stock}
              onChange={(e) => setFormData({...formData, stock: e.target.value})}
              onKeyDown={handleEnterPress}
              className="w-full px-4 md:px-5 py-3 md:py-4 bg-slate-50 border-2 border-transparent rounded-xl md:rounded-2xl focus:bg-white focus:border-slate-800 focus:outline-none transition-all font-black text-slate-800 text-base md:text-lg"
            />
          </div>
        </div>

        <button 
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white font-black py-4 md:py-6 rounded-xl md:rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/20 active:scale-95 flex items-center justify-center space-x-3 disabled:opacity-50 text-base md:text-xl"
        >
          {success ? <Check size={24} className="md:w-8 md:h-8" /> : <span>{editMode ? 'Guardar Cambios' : 'Registrar en Inventario'}</span>}
        </button>
      </form>
    </div>
  );
};

export default ProductRegistration;
