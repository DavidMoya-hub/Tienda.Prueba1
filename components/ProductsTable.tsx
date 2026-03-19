
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Save, AlertCircle, RefreshCw, Check } from 'lucide-react';
import { dataService } from '../services/dataService';
import { Product } from '../types';

const ProductsTable: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localChanges, setLocalChanges] = useState<{ [key: string]: { costPrice: number, salePrice: number } }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success'>('idle');

  useEffect(() => {
    setProducts(dataService.getProducts());
    return dataService.subscribe(() => {
      setProducts(dataService.getProducts());
    });
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.code.includes(searchTerm)
    );
  }, [products, searchTerm]);

  const handlePriceChange = (id: string, field: 'costPrice' | 'salePrice', value: string) => {
    const numValue = parseFloat(value) || 0;
    const currentProduct = products.find(p => p.id === id);
    if (!currentProduct) return;

    setLocalChanges(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || { costPrice: currentProduct.costPrice, salePrice: currentProduct.salePrice }),
        [field]: numValue
      }
    }));
  };

  const calculateRow = (product: Product) => {
    const changes = localChanges[product.id];
    const pc = changes ? changes.costPrice : product.costPrice;
    const pv = changes ? changes.salePrice : product.salePrice;
    const stock = product.stock || 0;
    const entradas = product.totalInputs || 0;
    const salidas = product.totalOutputs || 0;

    const gananciaUnitaria = pv - pc;
    const rentabilidad = pc > 0 ? (gananciaUnitaria / pc) * 100 : 0;
    const invertido = pc * stock;
    const vendido = pv * salidas;
    const ganadoTotal = gananciaUnitaria * salidas;
    const porcGanancia = invertido > 0 ? (ganadoTotal / invertido) * 100 : 0;

    return {
      pc, pv, gananciaUnitaria, rentabilidad, invertido, vendido, ganadoTotal, porcGanancia, entradas, salidas, stock
    };
  };

  const saveChanges = async (product: Product) => {
    const changes = localChanges[product.id];
    if (!changes) return;

    setIsSaving(true);
    try {
      const updatedProduct = {
        ...product,
        costPrice: changes.costPrice,
        salePrice: changes.salePrice
      };
      await dataService.saveProduct(updatedProduct);
      
      // Actualizar estado local
      setProducts(prev => prev.map(p => p.id === product.id ? updatedProduct : p));
      
      // Limpiar cambios locales de esa fila
      const newLocalChanges = { ...localChanges };
      delete newLocalChanges[product.id];
      setLocalChanges(newLocalChanges);
      
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      alert("Error al guardar cambios");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-blue-900 tracking-tight">Gestión Maestra</h2>
          <p className="text-xs md:text-sm text-slate-500 font-medium">Análisis de rentabilidad y costos.</p>
        </div>
        <div className="relative max-w-md w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por código o nombre..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border-2 border-blue-50 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-700"
          />
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-blue-100 shadow-2xl shadow-blue-900/5 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1400px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-blue-900 text-white text-[10px] font-black uppercase tracking-widest">
                <th className="px-4 py-5 whitespace-nowrap">Código</th>
                <th className="px-4 py-5 whitespace-nowrap">Producto</th>
                <th className="px-4 py-5 whitespace-nowrap">Proveedor</th>
                <th className="px-4 py-5 whitespace-nowrap text-center">Cant Ex</th>
                <th className="px-4 py-5 whitespace-nowrap text-center">Entrada</th>
                <th className="px-4 py-5 whitespace-nowrap text-center">Salidas</th>
                <th className="px-4 py-5 whitespace-nowrap bg-blue-800">P. Compra</th>
                <th className="px-4 py-5 whitespace-nowrap text-center">% Rent.</th>
                <th className="px-4 py-5 whitespace-nowrap bg-blue-800">P. Venta</th>
                <th className="px-4 py-5 whitespace-nowrap text-center">Ganancia</th>
                <th className="px-4 py-5 whitespace-nowrap text-center">Invertido</th>
                <th className="px-4 py-5 whitespace-nowrap text-center">Vendido</th>
                <th className="px-4 py-5 whitespace-nowrap text-center">Ganado</th>
                <th className="px-4 py-5 whitespace-nowrap text-center">% Ganancia</th>
                <th className="px-4 py-5 whitespace-nowrap text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-50">
              {filteredProducts.map((p) => {
                const row = calculateRow(p);
                const hasChanges = !!localChanges[p.id];

                return (
                  <tr key={p.id} className={`hover:bg-blue-50/30 transition-colors ${hasChanges ? 'bg-amber-50/30' : ''}`}>
                    <td className="px-4 py-4 font-bold text-slate-400 text-xs">{p.code}</td>
                    <td className="px-4 py-4">
                      <div className="font-black text-slate-800 text-sm truncate max-w-[150px]">{p.name}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">{p.grams} {p.flavor}</div>
                    </td>
                    <td className="px-4 py-4 text-xs font-bold text-slate-500">{p.provider || 'N/A'}</td>
                    <td className="px-4 py-4 text-center">
                      <span className="bg-slate-100 px-3 py-1 rounded-lg font-black text-xs text-slate-600">{row.stock}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-blue-600 font-black text-xs">{row.entradas}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-red-600 font-black text-xs">{row.salidas}</span>
                    </td>
                    <td className="px-4 py-4 bg-blue-50/30">
                      <input 
                        type="number" step="0.01"
                        value={row.pc}
                        onChange={(e) => handlePriceChange(p.id, 'costPrice', e.target.value)}
                        className="w-20 p-2 bg-white border-2 border-blue-100 rounded-xl focus:border-blue-500 outline-none font-black text-blue-900 text-sm text-center shadow-sm"
                      />
                    </td>
                    <td className={`px-4 py-4 text-center font-black text-xs ${row.rentabilidad > 30 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {row.rentabilidad.toFixed(1)}%
                    </td>
                    <td className="px-4 py-4 bg-blue-50/30">
                      <input 
                        type="number" step="0.01"
                        value={row.pv}
                        onChange={(e) => handlePriceChange(p.id, 'salePrice', e.target.value)}
                        className="w-20 p-2 bg-white border-2 border-blue-100 rounded-xl focus:border-blue-500 outline-none font-black text-blue-900 text-sm text-center shadow-sm"
                      />
                    </td>
                    <td className="px-4 py-4 text-center font-black text-emerald-600 text-sm">
                      ${row.gananciaUnitaria.toFixed(2)}
                    </td>
                    <td className="px-4 py-4 text-center text-slate-400 font-bold text-xs">
                      ${row.invertido.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-center text-slate-400 font-bold text-xs">
                      ${row.vendido.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-center font-black text-blue-600 text-sm">
                      ${row.ganadoTotal.toLocaleString()}
                    </td>
                    <td className={`px-4 py-4 text-center font-black text-xs ${row.porcGanancia > 20 ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {row.porcGanancia.toFixed(1)}%
                    </td>
                    <td className="px-4 py-4 text-right">
                      {hasChanges && (
                        <button 
                          onClick={() => saveChanges(p)}
                          disabled={isSaving}
                          className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                        >
                          {isSaving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                        </button>
                      )}
                      {!hasChanges && saveStatus === 'success' && (
                        <Check size={18} className="text-emerald-500 ml-auto" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredProducts.length === 0 && (
            <div className="p-20 text-center space-y-4">
              <AlertCircle className="mx-auto text-blue-200" size={64} />
              <p className="text-blue-300 font-black italic text-xl">No se encontraron productos.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductsTable;
