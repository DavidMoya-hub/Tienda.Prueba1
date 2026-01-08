
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Save, AlertCircle, RefreshCw, Check, Trash2 } from 'lucide-react';
import { dataService } from '../services/dataService';
import { Product } from '../types';

const ProductsTable: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [localChanges, setLocalChanges] = useState<{ [key: string]: { costPrice: number, salePrice: number } }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success'>('idle');

  const refreshLocalProducts = () => {
    setProducts([...dataService.getProducts()]);
  };

  useEffect(() => {
    refreshLocalProducts();
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

    return { pc, pv, gananciaUnitaria, rentabilidad, invertido, vendido, ganadoTotal, porcGanancia, entradas, salidas, stock };
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
      
      const newLocalChanges = { ...localChanges };
      delete newLocalChanges[product.id];
      setLocalChanges(newLocalChanges);
      
      setSaveStatus('success');
      refreshLocalProducts();
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      alert("Error al guardar cambios");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`¿Eliminar "${name}" permanentemente? Se perderá todo su historial.`)) {
      setIsSaving(true);
      try {
        await dataService.deleteProduct(id);
        refreshLocalProducts();
      } catch (e) {
        alert("Error al eliminar.");
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-blue-900 tracking-tight">Gestión Maestra</h2>
          <p className="text-slate-500 font-medium">Edita precios o elimina artículos obsoletos.</p>
        </div>
        <div className="relative max-w-md w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border-2 border-blue-50 rounded-2xl focus:outline-none focus:border-blue-500 transition-all font-bold text-slate-700 shadow-sm"
          />
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-blue-100 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1400px]">
            <thead>
              <tr className="bg-blue-900 text-white text-[10px] font-black uppercase tracking-widest">
                <th className="px-4 py-5">Código</th>
                <th className="px-4 py-5">Producto</th>
                <th className="px-4 py-5">Proveedor</th>
                <th className="px-4 py-5 text-center">Stock</th>
                <th className="px-4 py-5 text-center">Entradas</th>
                <th className="px-4 py-5 text-center">Salidas</th>
                <th className="px-4 py-5 bg-blue-800">P. Compra</th>
                <th className="px-4 py-5 text-center">% Rent.</th>
                <th className="px-4 py-5 bg-blue-800">P. Venta</th>
                <th className="px-4 py-5 text-center">Ganancia</th>
                <th className="px-4 py-5 text-center">Invertido</th>
                <th className="px-4 py-5 text-center">Ganado</th>
                <th className="px-4 py-5 text-right">Acciones</th>
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
                    </td>
                    <td className="px-4 py-4 text-xs font-bold text-slate-500">{p.provider}</td>
                    <td className="px-4 py-4 text-center">
                      <span className="bg-slate-100 px-3 py-1 rounded-lg font-black text-xs text-slate-600">{row.stock}</span>
                    </td>
                    <td className="px-4 py-4 text-center font-black text-blue-600 text-xs">{row.entradas}</td>
                    <td className="px-4 py-4 text-center font-black text-red-600 text-xs">{row.salidas}</td>
                    <td className="px-4 py-4 bg-blue-50/30">
                      <input type="number" step="0.01" value={row.pc} onChange={(e) => handlePriceChange(p.id, 'costPrice', e.target.value)} className="w-20 p-2 bg-white border-2 border-blue-100 rounded-xl font-black text-center" />
                    </td>
                    <td className="px-4 py-4 text-center font-black text-emerald-600 text-xs">{row.rentabilidad.toFixed(1)}%</td>
                    <td className="px-4 py-4 bg-blue-50/30">
                      <input type="number" step="0.01" value={row.pv} onChange={(e) => handlePriceChange(p.id, 'salePrice', e.target.value)} className="w-20 p-2 bg-white border-2 border-blue-100 rounded-xl font-black text-center" />
                    </td>
                    <td className="px-4 py-4 text-center font-black text-emerald-600 text-sm">${row.gananciaUnitaria.toFixed(2)}</td>
                    <td className="px-4 py-4 text-center text-slate-400 text-xs">${row.invertido.toLocaleString()}</td>
                    <td className="px-4 py-4 text-center font-black text-blue-600 text-sm">${row.ganadoTotal.toLocaleString()}</td>
                    <td className="px-4 py-4 text-right space-x-2">
                      {hasChanges && (
                        <button onClick={() => saveChanges(p)} disabled={isSaving} className="p-2 bg-blue-600 text-white rounded-xl shadow-lg active:scale-95"><Save size={16} /></button>
                      )}
                      <button onClick={() => handleDelete(p.id, p.name)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProductsTable;
