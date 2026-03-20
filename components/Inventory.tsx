import React, { useState } from 'react';
import { Search, Filter, Download, Edit2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dataService } from '../services/dataService';
import Modal from './Modal';

const Inventory: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [, setUpdateCount] = useState(0);
  const [modal, setModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'confirm' | 'info'; onConfirm?: () => void }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });
  const navigate = useNavigate();

  React.useEffect(() => {
    return dataService.subscribe(() => setUpdateCount(c => c + 1));
  }, []);

  const products = dataService.getProducts();

  const filteredProducts = React.useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    return products.filter(p => {
      const nameMatch = String(p.name || '').toLowerCase().includes(searchLower);
      const codeMatch = String(p.code || '').toLowerCase().includes(searchLower);
      return nameMatch || codeMatch;
    });
  }, [products, searchTerm]);

  const handleDelete = (id: string, name: string) => {
    setModal({
      isOpen: true,
      title: 'Eliminar Producto',
      message: `¿Estás seguro de eliminar "${name}"? Esta acción no se puede deshacer.`,
      type: 'confirm',
      onConfirm: async () => {
        try {
          await dataService.deleteProduct(id);
        } catch (error) {
          console.error('Error deleting product:', error);
        }
      }
    });
  };

  const handleEdit = (product: any) => {
    navigate('/register', { state: { product } });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl md:text-3xl font-black text-blue-900 tracking-tight">Base de Datos</h2>
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <button className="flex-1 md:flex-none flex items-center justify-center space-x-2 px-5 py-2.5 bg-white border border-blue-100 rounded-xl text-blue-600 hover:bg-blue-50 transition-all font-bold shadow-sm">
            <Download size={18} />
            <span className="text-sm">Exportar CSV</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl md:rounded-[2rem] border border-blue-100 shadow-xl shadow-blue-900/5 overflow-hidden">
        <div className="p-4 md:p-6 border-b border-blue-50 bg-blue-50/20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por código o nombre..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 md:py-3 bg-white border-2 border-blue-50 rounded-xl md:rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-xs md:text-sm font-bold"
            />
          </div>
          <div className="flex items-center justify-end space-x-2">
            <button className="p-2.5 md:p-3 text-blue-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-blue-100">
              <Filter size={20} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-blue-50/50 text-blue-900/50 text-[8px] md:text-[10px] font-black uppercase tracking-widest border-b border-blue-50">
                <th className="px-4 md:px-6 py-4 md:py-5">Producto / Detalles</th>
                <th className="px-4 md:px-6 py-4 md:py-5">Stock</th>
                <th className="px-4 md:px-6 py-4 md:py-5">Coste / Venta</th>
                <th className="px-4 md:px-6 py-4 md:py-5">Rendimiento Total</th>
                <th className="px-4 md:px-6 py-4 md:py-5">Proveedor</th>
                <th className="px-4 md:px-6 py-4 md:py-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-50 text-xs md:text-sm">
              {filteredProducts.map((p) => (
                <tr key={p.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="px-4 md:px-6 py-4 md:py-5">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-800 text-sm md:text-base">{p.name}</span>
                      <span className="text-[10px] md:text-xs font-bold text-blue-400 uppercase tracking-tighter">{p.code} • {p.grams} • {p.flavor}</span>
                    </div>
                  </td>
                  <td className="px-4 md:px-6 py-4 md:py-5">
                    <span className={`inline-flex items-center px-3 md:px-4 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-black ${
                      p.stock < 10 ? 'bg-red-100 text-red-600 shadow-sm shadow-red-100' : 'bg-blue-100 text-blue-600 shadow-sm shadow-blue-100'
                    }`}>
                      {p.stock} unidades
                    </span>
                  </td>
                  <td className="px-4 md:px-6 py-4 md:py-5">
                    <div className="flex flex-col">
                      <span className="text-slate-400 font-bold text-[10px] md:text-xs">Costo: ${p.costPrice?.toFixed(2)}</span>
                      <span className="text-blue-900 font-black text-base md:text-lg">Venta: ${p.salePrice?.toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="px-4 md:px-6 py-4 md:py-5">
                    <div className="flex flex-col">
                      <span className="text-[10px] md:text-xs text-slate-400 font-bold">Invertido: ${p.totalInvested?.toFixed(0)}</span>
                      <span className="text-red-600 font-black text-sm md:text-base">Ganado: ${p.totalEarned?.toFixed(0)}</span>
                    </div>
                  </td>
                  <td className="px-4 md:px-6 py-4 md:py-5 text-slate-400 font-bold italic">
                    {p.provider || 'N/A'}
                  </td>
                  <td className="px-4 md:px-6 py-4 md:py-5 text-right">
                    <div className="flex items-center justify-end space-x-1.5 md:space-x-2">
                      <button 
                        onClick={() => handleEdit(p)}
                        className="p-2 md:p-2.5 text-blue-400 hover:text-white hover:bg-blue-600 rounded-lg md:rounded-xl transition-all shadow-sm active:scale-95"
                        title="Editar"
                      >
                        <Edit2 size={16} className="md:w-[18px] md:h-[18px]" />
                      </button>
                      <button 
                        onClick={() => handleDelete(p.id, p.name)}
                        className="p-2 md:p-2.5 text-red-400 hover:text-white hover:bg-red-600 rounded-lg md:rounded-xl transition-all shadow-sm active:scale-95"
                        title="Eliminar"
                      >
                        <Trash2 size={16} className="md:w-[18px] md:h-[18px]" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 md:py-24 text-center text-blue-300 font-black italic text-base md:text-lg">
                    No se encontraron productos que coincidan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Modal 
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onConfirm={modal.onConfirm}
      />
    </div>
  );
};

export default Inventory;