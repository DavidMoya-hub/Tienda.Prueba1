
import React, { useState } from 'react';
import { Search, Filter, Download, Edit2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dataService } from '../services/dataService.ts';

const Inventory: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const products = dataService.getProducts();

  const filteredProducts = products.filter(p => 
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`¿Estás seguro de eliminar "${name}"? Esta acción no se puede deshacer.`)) {
      await dataService.deleteProduct(id);
    }
  };

  const handleEdit = (product: any) => {
    navigate('/register', { state: { product } });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-3xl font-black text-blue-900 tracking-tight">Base de Datos de Inventario</h2>
        <div className="flex items-center space-x-3">
          <button className="flex items-center space-x-2 px-5 py-2.5 bg-white border border-blue-100 rounded-xl text-blue-600 hover:bg-blue-50 transition-all font-bold shadow-sm">
            <Download size={18} />
            <span className="text-sm">Exportar CSV</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-blue-100 shadow-xl shadow-blue-900/5 overflow-hidden">
        <div className="p-6 border-b border-blue-50 bg-blue-50/20 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por código o nombre..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border-2 border-blue-50 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold"
            />
          </div>
          <div className="flex items-center space-x-2">
            <button className="p-3 text-blue-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-blue-100">
              <Filter size={20} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-blue-50/50 text-blue-900/50 text-[10px] font-black uppercase tracking-widest border-b border-blue-50">
                <th className="px-6 py-5">Producto / Detalles</th>
                <th className="px-6 py-5">Stock</th>
                <th className="px-6 py-5">Coste / Venta</th>
                <th className="px-6 py-5">Rendimiento Total</th>
                <th className="px-6 py-5">Proveedor</th>
                <th className="px-6 py-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-50 text-sm">
              {filteredProducts.map((p) => (
                <tr key={p.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-800 text-base">{p.name}</span>
                      <span className="text-xs font-bold text-blue-400 uppercase tracking-tighter">{p.code} • {p.grams} • {p.flavor}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`inline-flex items-center px-4 py-1 rounded-full text-xs font-black ${
                      p.stock < 10 ? 'bg-red-100 text-red-600 shadow-sm shadow-red-100' : 'bg-blue-100 text-blue-600 shadow-sm shadow-blue-100'
                    }`}>
                      {p.stock} unidades
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="text-slate-400 font-bold">Costo: ${p.costPrice?.toFixed(2)}</span>
                      <span className="text-blue-900 font-black text-lg">Venta: ${p.salePrice?.toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-400 font-bold">Invertido: ${p.totalInvested?.toFixed(0)}</span>
                      <span className="text-red-600 font-black text-base">Ganado: ${p.totalEarned?.toFixed(0)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-slate-400 font-bold italic">
                    {p.provider || 'N/A'}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button 
                        onClick={() => handleEdit(p)}
                        className="p-2.5 text-blue-400 hover:text-white hover:bg-blue-600 rounded-xl transition-all shadow-sm active:scale-95"
                        title="Editar"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(p.id, p.name)}
                        className="p-2.5 text-red-400 hover:text-white hover:bg-red-600 rounded-xl transition-all shadow-sm active:scale-95"
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-24 text-center text-blue-300 font-black italic text-lg">
                    No se encontraron productos que coincidan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Inventory;
