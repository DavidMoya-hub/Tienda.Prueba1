import React, { useState, useMemo } from 'react';
import { Calendar, ArrowUpCircle, ArrowDownCircle, Search, ClipboardList, Wallet, CheckCircle, Clock, AlertCircle, Edit, Trash2, X, Save, Eye } from 'lucide-react';
import { dataService } from '../services/dataService';
import { InputTransaction, OutputTransaction, DailyClosing, PriceHistory, PurchaseNote } from '../types';
import Modal from './Modal';

const HistoryView: React.FC = () => {
  const [tab, setTab] = useState<'Inputs' | 'Outputs' | 'Closings' | 'Audit' | 'Debts'>('Inputs');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editType, setEditType] = useState<'Input' | 'Output' | 'Closing' | 'Debt' | 'Audit' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedNote, setSelectedNote] = useState<PurchaseNote | null>(null);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editedDetails, setEditedDetails] = useState<any[]>([]);
  
  // Modal state
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const inputs = dataService.getInputs();
  const outputs = dataService.getOutputs();
  const closings = dataService.getClosings();
  const priceHistory = dataService.getPriceHistory();
  const purchaseNotes = dataService.getPurchaseNotes();

  const filterAndSort = <T extends { date: string }>(data: T[], searchFields: (keyof T)[]) => {
    let filtered = [...data];

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        searchFields.some(field => {
          const val = item[field];
          return val && String(val).toLowerCase().includes(lowerSearch);
        })
      );
    }

    if (startDate) {
      const start = new Date(startDate).getTime();
      filtered = filtered.filter(item => new Date(item.date).getTime() >= start);
    }

    if (endDate) {
      const end = new Date(endDate).getTime() + 86400000; // Include the whole end day
      filtered = filtered.filter(item => new Date(item.date).getTime() <= end);
    }

    return filtered.sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  };

  const sortedInputs = useMemo(() => filterAndSort(inputs, ['productName', 'notes'] as any), [inputs, searchTerm, startDate, endDate, sortOrder]);
  const sortedOutputs = useMemo(() => filterAndSort(outputs, ['productName', 'shift'] as any), [outputs, searchTerm, startDate, endDate, sortOrder]);
  const sortedClosings = useMemo(() => filterAndSort(closings, [] as any), [closings, searchTerm, startDate, endDate, sortOrder]);
  const sortedDebts = useMemo(() => filterAndSort(purchaseNotes, ['provider'] as any), [purchaseNotes, searchTerm, startDate, endDate, sortOrder]);
  const sortedAudit = useMemo(() => filterAndSort(priceHistory, ['productName', 'field'] as any), [priceHistory, searchTerm, startDate, endDate, sortOrder]);

  const parseDetails = (json: string) => {
    try {
      return JSON.parse(json || '[]');
    } catch (e) {
      console.error("Error parsing detailsJson:", e);
      return [];
    }
  };

  const handleOpenDetails = (note: PurchaseNote) => {
    setSelectedNote(note);
    setEditedDetails(parseDetails(note.detailsJson));
    setIsEditingDetails(false);
  };

  const handleQuantityChange = (index: number, newQty: number) => {
    const updated = [...editedDetails];
    const item = { ...updated[index] };
    item.quantity = newQty;
    item.totalCost = newQty * (Number(item.unitCost) || 0);
    updated[index] = item;
    setEditedDetails(updated);
  };

  const handleUnitCostChange = (index: number, newUnitCost: number) => {
    const updated = [...editedDetails];
    const item = { ...updated[index] };
    item.unitCost = newUnitCost;
    item.totalCost = (Number(item.quantity) || 0) * newUnitCost;
    updated[index] = item;
    setEditedDetails(updated);
  };

  const editedTotalAmount = useMemo(() => {
    return editedDetails.reduce((acc, item) => acc + (Number(item.totalCost) || 0), 0);
  }, [editedDetails]);

  const handleSaveDetails = async () => {
    if (!selectedNote) return;
    try {
      await dataService.updatePurchaseNoteDetails(
        selectedNote.id,
        editedTotalAmount,
        JSON.stringify(editedDetails)
      );
      setSelectedNote(null);
      setIsEditingDetails(false);
      setModal({
        isOpen: true,
        title: 'Éxito',
        message: 'Detalles de la nota actualizados correctamente.',
        type: 'success'
      });
    } catch (error) {
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'Error al guardar cambios: ' + error,
        type: 'error'
      });
    }
  };

  const handleMarkAsPaid = async (noteId: string) => {
    if (confirm("¿Marcar esta nota como PAGADA? Se usará el capital del Sobre 4.")) {
      try {
        await dataService.updateNoteStatus(noteId, 'Paid');
        if (selectedNote?.id === noteId) {
          setSelectedNote(null);
        }
        setModal({
          isOpen: true,
          title: 'Éxito',
          message: 'Nota marcada como pagada correctamente.',
          type: 'success'
        });
      } catch (error) {
        setModal({
          isOpen: true,
          title: 'Error',
          message: 'Error al liquidar nota: ' + error,
          type: 'error'
        });
      }
    }
  };

  const handleDelete = async (id: string, type: 'Input' | 'Output' | 'Closing' | 'Debt' | 'Audit') => {
    if (!confirm("¿Estás seguro de eliminar este registro? Esta acción no se puede deshacer.")) return;
    
    try {
      switch (type) {
        case 'Input': await dataService.deleteInput(id); break;
        case 'Output': await dataService.deleteOutput(id); break;
        case 'Closing': await dataService.deleteClosing(id); break;
        case 'Debt': await dataService.deletePurchaseNote(id); break;
        case 'Audit': await dataService.deletePriceHistory(id); break;
      }
      setModal({
        isOpen: true,
        title: 'Éxito',
        message: 'Registro eliminado correctamente.',
        type: 'success'
      });
    } catch (error) {
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'Error al eliminar: ' + error,
        type: 'error'
      });
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editType) return;

    try {
      switch (editType) {
        case 'Input': await dataService.saveInput(editingItem); break;
        case 'Output': await dataService.saveOutput(editingItem); break;
        case 'Closing': await dataService.saveClosing(editingItem); break;
        case 'Debt': await dataService.saveRestockNote(editingItem); break;
        case 'Audit': await dataService.savePriceHistory(editingItem); break;
      }
      setEditingItem(null);
      setEditType(null);
      setModal({
        isOpen: true,
        title: 'Éxito',
        message: 'Registro actualizado correctamente.',
        type: 'success'
      });
    } catch (error) {
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'Error al guardar: ' + error,
        type: 'error'
      });
    }
  };

  const pendingDebts = useMemo(() => {
    return purchaseNotes.filter(n => n.status === 'Pending');
  }, [purchaseNotes]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <h2 className="text-2xl md:text-3xl font-black text-blue-900 tracking-tight">Bitácoras Maestro</h2>
        <div className="flex bg-blue-50/50 border-2 border-blue-100 p-1.5 md:p-2 rounded-2xl md:rounded-[2rem] shadow-xl shadow-blue-900/5 overflow-x-auto custom-scrollbar">
          <button 
            onClick={() => setTab('Inputs')}
            className={`px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl font-black transition-all flex items-center space-x-2 whitespace-nowrap tracking-tight text-xs md:text-base ${tab === 'Inputs' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-blue-400 hover:text-blue-600'}`}
          >
            <ArrowUpCircle size={18} className="md:w-5 md:h-5" />
            <span>Entradas</span>
          </button>
          <button 
            onClick={() => setTab('Outputs')}
            className={`px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl font-black transition-all flex items-center space-x-2 whitespace-nowrap tracking-tight text-xs md:text-base ${tab === 'Outputs' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'text-blue-400 hover:text-blue-600'}`}
          >
            <ArrowDownCircle size={18} className="md:w-5 md:h-5" />
            <span>Salidas</span>
          </button>
          <button 
            onClick={() => setTab('Closings')}
            className={`px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl font-black transition-all flex items-center space-x-2 whitespace-nowrap tracking-tight text-xs md:text-base ${tab === 'Closings' ? 'bg-red-600 text-white shadow-lg shadow-red-200' : 'text-blue-400 hover:text-blue-600'}`}
          >
            <Clock size={18} className="md:w-5 md:h-5" />
            <span>Cierres</span>
          </button>
          <button 
            onClick={() => setTab('Debts')}
            className={`px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl font-black transition-all flex items-center space-x-2 whitespace-nowrap tracking-tight text-xs md:text-base ${tab === 'Debts' ? 'bg-amber-600 text-white shadow-lg shadow-amber-200' : 'text-blue-400 hover:text-blue-600'}`}
          >
            <Wallet size={18} className="md:w-5 md:h-5" />
            <span>Deudas {pendingDebts.length > 0 && `(${pendingDebts.length})`}</span>
          </button>
          <button 
            onClick={() => setTab('Audit')}
            className={`px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl font-black transition-all flex items-center space-x-2 whitespace-nowrap tracking-tight text-xs md:text-base ${tab === 'Audit' ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : 'text-blue-400 hover:text-blue-600'}`}
          >
            <ClipboardList size={18} className="md:w-5 md:h-5" />
            <span>Auditoría</span>
          </button>
        </div>
      </div>

      {/* Filtros Globales */}
      <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-blue-100 shadow-xl shadow-blue-900/5 flex flex-col md:flex-row gap-4 md:items-end">
        <div className="flex-1 space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
            <Search size={12} /> <span>Buscador</span>
          </label>
          <input 
            type="text" 
            placeholder="Buscar por producto, proveedor, notas..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold focus:border-blue-500 outline-none transition-all text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-4 flex-1">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
              <Calendar size={12} /> <span>Desde</span>
            </label>
            <input 
              type="date" 
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold focus:border-blue-500 outline-none transition-all text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
              <Calendar size={12} /> <span>Hasta</span>
            </label>
            <input 
              type="date" 
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold focus:border-blue-500 outline-none transition-all text-sm"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
            <ClipboardList size={12} /> <span>Orden</span>
          </label>
          <select 
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value as 'asc' | 'desc')}
            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold focus:border-blue-500 outline-none transition-all text-sm appearance-none cursor-pointer"
          >
            <option value="desc">Más Reciente</option>
            <option value="asc">Más Antiguo</option>
          </select>
        </div>
        <button 
          onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); setSortOrder('desc'); }}
          className="bg-slate-100 text-slate-400 p-3.5 rounded-2xl hover:bg-slate-200 transition-all"
          title="Limpiar Filtros"
        >
          <X size={20} />
        </button>
      </div>

      <div className="bg-white rounded-[3rem] border border-blue-100 overflow-hidden shadow-2xl shadow-blue-900/5">
        {tab === 'Inputs' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-blue-50/50 text-blue-900/40 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-4 md:px-8 py-4 md:py-6">Fecha</th>
                  <th className="px-4 md:px-8 py-4 md:py-6">Producto</th>
                  <th className="px-4 md:px-8 py-4 md:py-6">Cant</th>
                  <th className="px-4 md:px-8 py-4 md:py-6">Notas</th>
                  <th className="px-4 md:px-8 py-4 md:py-6 text-right">Costo Total</th>
                  <th className="px-4 md:px-8 py-4 md:py-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50 text-xs md:text-sm">
                {sortedInputs.map(log => (
                  <tr key={log.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-4 md:px-8 py-3 md:py-5 text-slate-400 font-bold">{new Date(log.date).toLocaleDateString()}</td>
                    <td className="px-4 md:px-8 py-3 md:py-5 font-black text-slate-800 text-sm md:text-base">{log.productName}</td>
                    <td className="px-4 md:px-8 py-3 md:py-5 font-black text-blue-900"><span className="bg-blue-50 px-2 md:px-3 py-1 rounded-lg">{log.quantity}</span></td>
                    <td className="px-4 md:px-8 py-3 md:py-5 font-black text-slate-800 text-sm md:text-base">{log.notes || '-'}</td>
                    <td className="px-4 md:px-8 py-3 md:py-5 font-black text-right text-base md:text-lg text-red-600">
                      ${log.totalCost?.toFixed(2)}
                    </td>
                    <td className="px-4 md:px-8 py-3 md:py-5 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button 
                          onClick={() => { setEditingItem({...log}); setEditType('Input'); }}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors bg-blue-50"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(log.id, 'Input')}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-xl transition-colors bg-red-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'Outputs' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-emerald-50/50 text-emerald-900/40 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-4 md:px-8 py-4 md:py-6">Fecha</th>
                  <th className="px-4 md:px-8 py-4 md:py-6">Producto</th>
                  <th className="px-4 md:px-8 py-4 md:py-6">Cant</th>
                  <th className="px-4 md:px-8 py-4 md:py-6">Turno</th>
                  <th className="px-4 md:px-8 py-4 md:py-6 text-right">Venta Total</th>
                  <th className="px-4 md:px-8 py-4 md:py-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-50 text-xs md:text-sm">
                {sortedOutputs.map(log => (
                  <tr key={log.id} className="hover:bg-emerald-50/30 transition-colors group">
                    <td className="px-4 md:px-8 py-3 md:py-5 text-slate-400 font-bold">{new Date(log.date).toLocaleDateString()}</td>
                    <td className="px-4 md:px-8 py-3 md:py-5 font-black text-slate-800 text-sm md:text-base">{log.productName}</td>
                    <td className="px-4 md:px-8 py-3 md:py-5 font-black text-emerald-900"><span className="bg-emerald-50 px-2 md:px-3 py-1 rounded-lg">{log.quantity}</span></td>
                    <td className="px-4 md:px-8 py-3 md:py-5 font-black text-slate-800 text-sm md:text-base">{log.shift || '-'}</td>
                    <td className="px-4 md:px-8 py-3 md:py-5 font-black text-right text-base md:text-lg text-emerald-600">
                      ${log.totalSale?.toFixed(2)}
                    </td>
                    <td className="px-4 md:px-8 py-3 md:py-5 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button 
                          onClick={() => { setEditingItem({...log}); setEditType('Output'); }}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors bg-blue-50"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(log.id, 'Output')}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-xl transition-colors bg-red-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'Closings' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-blue-50/50 text-blue-900/40 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-4 md:px-8 py-4 md:py-6">Fecha Corte</th>
                  <th className="px-4 md:px-8 py-4 md:py-6">Venta Bruta</th>
                  <th className="px-4 md:px-8 py-4 md:py-6">Costo Inv (COGS)</th>
                  <th className="px-4 md:px-8 py-4 md:py-6">Utilidad Neta</th>
                  <th className="px-4 md:px-8 py-4 md:py-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50 text-xs md:text-sm">
                {sortedClosings.map(log => (
                  <tr key={log.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-4 md:px-8 py-3 md:py-5 font-black text-slate-800">{new Date(log.date).toLocaleString()}</td>
                    <td className="px-4 md:px-8 py-3 md:py-5 text-blue-600 font-black text-lg md:text-xl tracking-tighter">${Number(log.totalSold)?.toLocaleString()}</td>
                    <td className="px-4 md:px-8 py-3 md:py-5 text-slate-400 font-bold">-${Number(log.cogs)?.toLocaleString()}</td>
                    <td className="px-4 md:px-8 py-3 md:py-5 text-red-600 font-black text-lg md:text-xl tracking-tighter">${Number(log.netProfit)?.toLocaleString()}</td>
                    <td className="px-4 md:px-8 py-3 md:py-5 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button 
                          onClick={() => { setEditingItem({...log}); setEditType('Closing'); }}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors bg-blue-50"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(log.id, 'Closing')}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-xl transition-colors bg-red-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'Debts' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-amber-50 text-amber-700 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-4 md:px-8 py-4 md:py-6">Fecha</th>
                  <th className="px-4 md:px-8 py-4 md:py-6">Proveedor</th>
                  <th className="px-4 md:px-8 py-4 md:py-6">Importe Deuda</th>
                  <th className="px-4 md:px-8 py-4 md:py-6">Estado</th>
                  <th className="px-4 md:px-8 py-4 md:py-6 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50 text-xs md:text-sm">
                {sortedDebts.map(note => (
                  <tr 
                    key={note.id} 
                    onClick={() => handleOpenDetails(note)}
                    className={`hover:bg-slate-50 transition-colors group cursor-pointer ${note.status === 'Pending' ? 'bg-amber-50/20' : ''}`}
                  >
                    <td className="px-4 md:px-8 py-3 md:py-5 text-slate-400 font-bold">{new Date(note.date).toLocaleDateString()}</td>
                    <td className="px-4 md:px-8 py-3 md:py-5 font-black text-slate-800 text-base md:text-lg">{note.provider}</td>
                    <td className="px-4 md:px-8 py-3 md:py-5 font-black text-red-600 text-lg md:text-xl tracking-tighter">${Number(note.totalAmount).toLocaleString()}</td>
                    <td className="px-4 md:px-8 py-3 md:py-5">
                      <div className="flex items-center space-x-2">
                        {note.status === 'Paid' ? (
                          <span className="flex items-center space-x-1.5 md:space-x-2 text-emerald-600 font-black text-[8px] md:text-[10px] uppercase tracking-widest bg-emerald-50 px-2 md:px-3 py-1 md:py-1.5 rounded-lg md:rounded-xl border border-emerald-100">
                            <CheckCircle size={12} className="md:w-3.5 md:h-3.5" /> <span>Liquidado</span>
                          </span>
                        ) : (
                          <span className="flex items-center space-x-1.5 md:space-x-2 text-amber-600 font-black text-[8px] md:text-[10px] uppercase tracking-widest bg-amber-50 px-2 md:px-3 py-1 md:py-1.5 rounded-lg md:rounded-xl border border-amber-100">
                            <Clock size={12} className="md:w-3.5 md:h-3.5 animate-pulse" /> <span>Pendiente</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 md:px-8 py-3 md:py-5 text-right">
                      <div className="flex items-center justify-end space-x-4">
                        {note.status === 'Pending' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleMarkAsPaid(note.id); }}
                            className="bg-blue-600 text-white px-4 md:px-8 py-2 md:py-3 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs hover:bg-blue-700 transition-all active:scale-95 shadow-xl shadow-blue-200 uppercase tracking-widest"
                          >
                            Liquidar Ahora
                          </button>
                        )}
                        <div className="flex items-center space-x-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleOpenDetails(note); }}
                            className="p-2 text-amber-600 hover:bg-amber-100 rounded-xl transition-colors bg-amber-50"
                            title="Ver Detalle"
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setEditingItem({...note}); setEditType('Debt'); }}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors bg-blue-50"
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(note.id, 'Debt'); }}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-xl transition-colors bg-red-50"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
                {purchaseNotes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-20 md:py-32 text-blue-200 font-black italic text-lg md:text-xl">No hay registros de compras.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'Audit' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-slate-900 text-slate-400 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-4 md:px-8 py-4 md:py-6">Fecha Hora</th>
                  <th className="px-4 md:px-8 py-4 md:py-6">Producto</th>
                  <th className="px-4 md:px-8 py-4 md:py-6">Campo Alterado</th>
                  <th className="px-4 md:px-8 py-4 md:py-6">Anterior</th>
                  <th className="px-4 md:px-8 py-4 md:py-6 text-right">Nuevo Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50 text-xs md:text-sm">
                {sortedAudit.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 group">
                    <td className="px-4 md:px-8 py-3 md:py-5 text-slate-400 font-medium">{new Date(log.date).toLocaleString()}</td>
                    <td className="px-4 md:px-8 py-3 md:py-5 font-black text-slate-800">{log.productName}</td>
                    <td className="px-4 md:px-8 py-3 md:py-5">
                      <span className="px-3 md:px-4 py-1 bg-blue-50 text-blue-600 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest border border-blue-100">{log.field}</span>
                    </td>
                    <td className="px-4 md:px-8 py-3 md:py-5 text-red-400 font-bold">{log.oldValue}</td>
                    <td className="px-4 md:px-8 py-3 md:py-5 text-right">
                      <div className="flex items-center justify-end space-x-4">
                        <span className="text-blue-600 font-black text-lg md:text-xl tracking-tighter">{log.newValue}</span>
                        <div className="flex items-center space-x-2">
                          <button 
                            onClick={() => { setEditingItem({...log}); setEditType('Audit'); }}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors bg-blue-50"
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(log.id, 'Audit')}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-xl transition-colors bg-red-50"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="bg-blue-900 p-6 md:p-8 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl md:text-2xl font-black tracking-tight">Editar Registro</h3>
                <p className="text-blue-300 text-xs font-bold uppercase tracking-widest">{editType}</p>
              </div>
              <button onClick={() => { setEditingItem(null); setEditType(null); }} className="text-blue-300 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 md:p-8 space-y-6">
              <div className="grid grid-cols-1 gap-4">
                {(editType === 'Input' || editType === 'Output') && (
                  <>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Cantidad</label>
                      <input 
                        type="number" 
                        value={editingItem.quantity}
                        onChange={e => setEditingItem({...editingItem, quantity: Number(e.target.value)})}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                    {editType === 'Input' ? (
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Costo Total</label>
                        <input 
                          type="number" 
                          value={editingItem.totalCost}
                          onChange={e => setEditingItem({...editingItem, totalCost: Number(e.target.value)})}
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold focus:border-blue-500 outline-none transition-all"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Venta Total</label>
                        <input 
                          type="number" 
                          value={editingItem.totalSale}
                          onChange={e => setEditingItem({...editingItem, totalSale: Number(e.target.value)})}
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold focus:border-blue-500 outline-none transition-all"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Notas</label>
                      <textarea 
                        value={editingItem.notes}
                        onChange={e => setEditingItem({...editingItem, notes: e.target.value})}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold focus:border-blue-500 outline-none transition-all h-24 resize-none"
                      />
                    </div>
                  </>
                )}

                {editType === 'Closing' && (
                  <>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Venta Total</label>
                      <input 
                        type="number" 
                        value={editingItem.totalSold}
                        onChange={e => setEditingItem({...editingItem, totalSold: Number(e.target.value)})}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Utilidad Neta</label>
                      <input 
                        type="number" 
                        value={editingItem.netProfit}
                        onChange={e => setEditingItem({...editingItem, netProfit: Number(e.target.value)})}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                  </>
                )}

                {editType === 'Debt' && (
                  <>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Proveedor</label>
                      <input 
                        type="text" 
                        value={editingItem.provider}
                        onChange={e => setEditingItem({...editingItem, provider: e.target.value})}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Importe Total</label>
                      <input 
                        type="number" 
                        value={editingItem.totalAmount}
                        onChange={e => setEditingItem({...editingItem, totalAmount: Number(e.target.value)})}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                  </>
                )}

                {editType === 'Audit' && (
                  <>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Producto</label>
                      <input 
                        type="text" 
                        value={editingItem.productName}
                        onChange={e => setEditingItem({...editingItem, productName: e.target.value})}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Campo</label>
                      <input 
                        type="text" 
                        value={editingItem.field}
                        onChange={e => setEditingItem({...editingItem, field: e.target.value})}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Valor Anterior</label>
                      <input 
                        type="text" 
                        value={editingItem.oldValue}
                        onChange={e => setEditingItem({...editingItem, oldValue: e.target.value})}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nuevo Valor</label>
                      <input 
                        type="text" 
                        value={editingItem.newValue}
                        onChange={e => setEditingItem({...editingItem, newValue: e.target.value})}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                  </>
                )}
              </div>

              <button 
                type="submit"
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black flex items-center justify-center space-x-2 hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 active:scale-95"
              >
                <Save size={20} />
                <span>Guardar Cambios</span>
              </button>
            </form>
          </div>
        </div>
      )}
      {selectedNote && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="bg-amber-600 p-6 md:p-8 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl md:text-2xl font-black tracking-tight">{isEditingDetails ? 'Editando Compra' : 'Detalle de Compra'}</h3>
                <p className="text-amber-200 text-xs font-bold uppercase tracking-widest">{selectedNote.provider}</p>
              </div>
              <div className="flex items-center space-x-4">
                <button 
                  onClick={() => setIsEditingDetails(!isEditingDetails)}
                  className="bg-white/20 hover:bg-white/30 p-2 rounded-xl transition-all"
                  title={isEditingDetails ? "Cancelar Edición" : "Editar Cantidades"}
                >
                  {isEditingDetails ? <X size={20} /> : <Edit size={20} />}
                </button>
                <button onClick={() => setSelectedNote(null)} className="text-amber-200 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-6 md:p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fecha</label>
                  <p className="font-black text-slate-800">{new Date(selectedNote.date).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Estado</label>
                  <p className={`font-black ${selectedNote.status === 'Paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {selectedNote.status === 'Paid' ? 'LIQUIDADO' : 'PENDIENTE'}
                  </p>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Nota</label>
                  <p className={`font-black text-xl tracking-tighter ${isEditingDetails ? 'text-blue-600' : 'text-slate-800'}`}>
                    ${(isEditingDetails ? editedTotalAmount : Number(selectedNote.totalAmount)).toLocaleString()}
                  </p>
                </div>
                {selectedNote.status === 'Pending' && !isEditingDetails && (
                  <div className="flex items-end">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAsPaid(selectedNote.id);
                      }}
                      className="w-full bg-blue-600 text-white py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                    >
                      Liquidar Ahora
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <ClipboardList size={16} className="text-amber-600" />
                  <span>Productos en esta nota</span>
                </h4>
                
                <div className="border border-slate-100 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-400 font-black uppercase tracking-widest">
                      <tr>
                        <th className="px-4 py-3">Producto</th>
                        <th className="px-4 py-3 text-center">Cant</th>
                        <th className="px-4 py-3 text-right">Costo U.</th>
                        <th className="px-4 py-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(isEditingDetails ? editedDetails : parseDetails(selectedNote.detailsJson || '')).map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 font-bold text-slate-800">{item.productName}</td>
                          <td className="px-4 py-3 text-center font-black text-blue-600">
                            {isEditingDetails ? (
                              <input 
                                type="number"
                                value={item.quantity}
                                onChange={(e) => handleQuantityChange(idx, Number(e.target.value))}
                                className="w-16 bg-white border-2 border-blue-100 rounded-lg px-2 py-1 text-center outline-none focus:border-blue-500 transition-all"
                              />
                            ) : (
                              <span className="bg-blue-50 px-2 py-0.5 rounded-md">{item.quantity}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-500">
                            {isEditingDetails ? (
                              <input 
                                type="number"
                                value={item.unitCost}
                                onChange={(e) => handleUnitCostChange(idx, Number(e.target.value))}
                                className="w-20 bg-white border-2 border-blue-100 rounded-lg px-2 py-1 text-right outline-none focus:border-blue-500 transition-all"
                              />
                            ) : (
                              `$${Number(item.unitCost || 0).toFixed(2)}`
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-black text-slate-900">${Number(item.totalCost || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                      {(isEditingDetails ? editedDetails : parseDetails(selectedNote.detailsJson || '')).length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-slate-400 font-bold italic">
                            No se encontraron detalles para esta nota.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4">
              {isEditingDetails ? (
                <>
                  <button 
                    onClick={() => setIsEditingDetails(false)}
                    className="flex-1 bg-slate-200 text-slate-600 py-4 rounded-2xl font-black hover:bg-slate-300 transition-all uppercase tracking-widest text-xs"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSaveDetails}
                    className="flex-2 bg-blue-600 text-white py-4 rounded-2xl font-black hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                  >
                    <Save size={16} />
                    <span>Guardar Cambios</span>
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => setSelectedNote(null)}
                  className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 uppercase tracking-widest text-xs"
                >
                  Cerrar Detalle
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <Modal 
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onClose={() => setModal({ ...modal, isOpen: false })}
      />
    </div>
  );
};

export default HistoryView;