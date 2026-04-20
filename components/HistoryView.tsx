import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, ArrowUpCircle, ArrowDownCircle, Search, ClipboardList, Wallet, CheckCircle, Clock, AlertCircle, Edit, Trash2, X, Save, Eye, FileText, RefreshCw } from 'lucide-react';
import { dataService } from '../services/dataService';
import { InputTransaction, OutputTransaction, DailyClosing, AuditLog, PurchaseNote } from '../types';
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
  const [selectedDetail, setSelectedDetail] = useState<any>(null);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editedDetails, setEditedDetails] = useState<any[]>([]);
  const [editQuantities, setEditQuantities] = useState<Record<string, number>>({});
  
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
  const priceHistory = dataService.getAudits();
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
  
  const totalOutputsValue = useMemo(() => sortedOutputs.reduce((acc, curr) => acc + (Number(curr.totalSale) || 0), 0), [sortedOutputs]);
  const totalClosingsSales = useMemo(() => sortedClosings.reduce((acc, curr) => acc + (Number(curr.totalSold) || 0), 0), [sortedClosings]);
  const totalClosingsCogs = useMemo(() => sortedClosings.reduce((acc, curr) => acc + (Number(curr.cogs) || 0), 0), [sortedClosings]);
  const totalClosingsProfit = useMemo(() => sortedClosings.reduce((acc, curr) => acc + (Number(curr.netProfit) || 0), 0), [sortedClosings]);
  const totalClosingsDebts = useMemo(() => sortedClosings.reduce((acc, curr) => acc + (Number(curr.debtsPaid) || 0), 0), [sortedClosings]);
  const totalClosingsCash = useMemo(() => sortedClosings.reduce((acc, curr) => acc + (Number(curr.cashInBox || curr.totalSold) || 0), 0), [sortedClosings]);

  // --- LÓGICA DE EXTRACCIÓN DUAL PARA CIERRES ---
  const allOutputs = dataService.getOutputs();
  const allPurchaseNotes = dataService.getPurchaseNotes();
  const allProducts = dataService.getProducts();

  let closingProducts: { productName: string, quantity: number, totalSale: number, unitPrice: number }[] = [];
  let closingDebts: { id: string, supplier: string, total: number }[] = [];

  if (selectedDetail && (tab === 'Closings' || (selectedDetail as any).totalSold !== undefined)) {
    const closing = selectedDetail as DailyClosing;
    // --- A. EXTRAER DEUDAS PAGADAS DEL CIERRE ---
    try {
      const rawDebts = closing.paidDebtIds || (closing as any).paidDebts || '[]';
      if (typeof rawDebts === 'string' && rawDebts.includes('NOTE-')) {
        const debtIds = JSON.parse(rawDebts);
        closingDebts = debtIds.map((id: string) => {
          const note = allPurchaseNotes.find(n => n.id === id);
          return {
            id: id,
            supplier: note ? note.provider : 'Proveedor Desconocido',
            total: note ? note.totalAmount : 0
          };
        });
      }
    } catch (e) { console.warn("Error parseando deudas:", e); }

    // --- B. EXTRAER PRODUCTOS CRUZANDO CON OUTPUTS ---
    const matchingOutput = allOutputs.find(out => 
      out.date === closing.date || 
      String(out.notes).includes(closing.id)
    );

    if (matchingOutput) {
      try {
        const rawProds = matchingOutput.soldProductsJson || (matchingOutput as any).detailsJson || '[]';
        if (typeof rawProds === 'string' && rawProds.includes('productId')) {
          const parsedProds = JSON.parse(rawProds);
          closingProducts = parsedProds.map((item: any) => {
            const productDef = allProducts.find(p => p.id === item.productId);
            const qty = Number(item.quantity || 1);
            const total = Number(item.totalSale || item.totalCost || 0);
            return {
              productName: productDef ? productDef.name : 'Producto Eliminado',
              quantity: qty,
              totalSale: total,
              unitPrice: total / qty
            };
          });
        }
      } catch (e) { console.warn("Error parseando productos desde output:", e); }
    }
  }

  const totalClosingProducts = closingProducts.reduce((acc, p) => acc + (p.totalSale || 0), 0);
  const totalClosingDebts = closingDebts.reduce((acc, d) => acc + (d.total || 0), 0);

  useEffect(() => {
    if (selectedDetail) {
      console.log("RAYOS X - ITEM SELECCIONADO:", selectedDetail);
    }
  }, [selectedDetail]);

  const parseDetails = (json: string) => {
    try {
      return JSON.parse(json || '[]');
    } catch (e) {
      console.error("Error parsing detailsJson:", e);
      return [];
    }
  };

  const extractProducts = (item: any): any[] => {
    if (!item) return [];
    // Lista de todas las propiedades donde el backend pudo haber inyectado el JSON
    const possibleFields = [
      item.soldProductsJson, item.detailsJson, item.products, 
      item.productId, item.productName, item.notes
    ];

    for (const field of possibleFields) {
      if (typeof field === 'string' && field.trim().startsWith('[') && field.trim().endsWith(']')) {
        try {
          const parsed = JSON.parse(field);
          if (Array.isArray(parsed) && parsed.length > 0 && (parsed[0].productId || parsed[0].name || parsed[0].productName)) {
            return parsed; // JSON válido encontrado
          }
        } catch (e) { /* ignorar y seguir buscando */ }
      } else if (Array.isArray(field) && field.length > 0) {
        return field;
      }
    }
    return [];
  };

  const handleOpenDetails = (note: PurchaseNote) => {
    setSelectedNote(note);
    setEditedDetails(parseDetails(note.detailsJson));
    setIsEditingDetails(false);
  };

  const handleOpenItemDetails = (item: any) => {
    setSelectedDetail(item);
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
  
  const handleDeleteItem = async (noteId: string, productId: string) => {
    if (!confirm("¿Estás seguro de eliminar este producto de la nota? El stock se revertirá.")) return;
    try {
      const res = await dataService.deleteItemFromNote(noteId, productId);
      if (res && res.success) {
        setModal({
          isOpen: true,
          title: 'Éxito',
          message: 'Producto eliminado de la nota correctamente.',
          type: 'success'
        });
        
        if (res.destroyed) {
          setSelectedNote(null);
        } else {
          // Actualizar la nota seleccionada con los nuevos datos
          const updatedNote = dataService.getPurchaseNotes().find(n => n.id === noteId);
          if (updatedNote) {
            setSelectedNote(updatedNote);
            setEditedDetails(parseDetails(updatedNote.detailsJson));
          }
        }
      } else {
        throw new Error(res?.error || 'Error desconocido');
      }
    } catch (error) {
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'Error al eliminar producto: ' + error,
        type: 'error'
      });
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
        case 'Audit': await dataService.deleteAudit(id); break;
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
        case 'Audit': await dataService.saveAudit(editingItem); break;
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

  const handleToggleNoteStatus = async (item: any) => {
    const newStatus = item.status === 'Paid' ? 'Pending' : 'Paid';
    const actionText = newStatus === 'Paid' 
      ? `¿Marcar como PAGADO? Se descontarán $${item.totalAmount} del Sobre 4.` 
      : `¿Marcar como DEUDA? Se regresarán $${item.totalAmount} al Sobre 4.`;

    if (window.confirm(actionText)) {
      try {
        await dataService.updateNoteStatus(item.id, newStatus, 'Capital');
        // Actualizar el estado local para que el modal refleje el cambio instantáneamente
        setSelectedNote({ ...item, status: newStatus });
      } catch (error) {
        console.error("Error al cambiar estado:", error);
        alert("Hubo un error al actualizar la base de datos.");
      }
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
                  <tr 
                    key={log.id} 
                    onClick={() => handleOpenItemDetails(log)}
                    className="hover:bg-emerald-50/30 transition-colors group cursor-pointer"
                  >
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
                          onClick={(e) => { e.stopPropagation(); handleOpenItemDetails(log); }}
                          className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-colors bg-emerald-50"
                          title="Ver Detalle"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setEditingItem({...log}); setEditType('Output'); }}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors bg-blue-50"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(log.id, 'Output'); }}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-xl transition-colors bg-red-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-emerald-50/80 font-black text-emerald-900 border-t-2 border-emerald-200">
                <tr>
                  <td colSpan={4} className="px-4 md:px-8 py-4 text-right uppercase tracking-widest text-[10px]">Total Salidas</td>
                  <td className="px-4 md:px-8 py-4 text-right text-lg md:text-xl">${totalOutputsValue.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {tab === 'Closings' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
              <thead className="bg-blue-50/50 text-blue-900/40 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-4 md:px-8 py-4 md:py-6">Fecha Corte</th>
                  <th className="px-4 md:px-8 py-4 md:py-6">Venta Bruta</th>
                  <th className="px-4 md:px-8 py-4 md:py-6">Costo Inv (COGS)</th>
                  <th className="px-4 md:px-8 py-4 md:py-6">Utilidad Neta</th>
                  <th className="px-4 md:px-8 py-4 md:py-6">Deudas Pagadas</th>
                  <th className="px-4 md:px-8 py-4 md:py-6">Efectivo Caja</th>
                  <th className="px-4 md:px-8 py-4 md:py-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50 text-xs md:text-sm">
                {sortedClosings.map(log => (
                  <tr 
                    key={log.id} 
                    onClick={() => handleOpenItemDetails(log)}
                    className="hover:bg-blue-50/30 transition-colors group cursor-pointer"
                  >
                    <td className="px-4 md:px-8 py-3 md:py-5 font-black text-slate-800">{new Date(log.date).toLocaleString()}</td>
                    <td className="px-4 md:px-8 py-3 md:py-5 text-blue-600 font-black text-lg md:text-xl tracking-tighter">${Number(log.totalSold)?.toLocaleString()}</td>
                    <td className="px-4 md:px-8 py-3 md:py-5 text-slate-400 font-bold">-${Number(log.cogs)?.toLocaleString()}</td>
                    <td className="px-4 md:px-8 py-3 md:py-5 text-emerald-600 font-black text-lg md:text-xl tracking-tighter">${Number(log.netProfit)?.toLocaleString()}</td>
                    <td className="px-4 md:px-8 py-3 md:py-5 text-red-600 font-bold">${Number(log.debtsPaid || 0)?.toLocaleString()}</td>
                    <td className="px-4 md:px-8 py-3 md:py-5 text-blue-900 font-black text-lg md:text-xl tracking-tighter">${Number(log.cashInBox || log.totalSold)?.toLocaleString()}</td>
                    <td className="px-4 md:px-8 py-3 md:py-5 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleOpenItemDetails(log); }}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors bg-blue-50"
                          title="Ver Detalle"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setEditingItem({...log}); setEditType('Closing'); }}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors bg-blue-50"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(log.id, 'Closing'); }}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-xl transition-colors bg-red-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-blue-50/80 font-black text-blue-900 border-t-2 border-blue-200">
                <tr>
                  <td className="px-4 md:px-8 py-4 text-right uppercase tracking-widest text-[10px]">Totales</td>
                  <td className="px-4 md:px-8 py-4 text-blue-600 text-lg md:text-xl tracking-tighter">${totalClosingsSales.toLocaleString()}</td>
                  <td className="px-4 md:px-8 py-4 text-slate-400">-${totalClosingsCogs.toLocaleString()}</td>
                  <td className="px-4 md:px-8 py-4 text-emerald-600 text-lg md:text-xl tracking-tighter">${totalClosingsProfit.toLocaleString()}</td>
                  <td className="px-4 md:px-8 py-4 text-red-600">${totalClosingsDebts.toLocaleString()}</td>
                  <td className="px-4 md:px-8 py-4 text-blue-900 text-lg md:text-xl tracking-tighter">${totalClosingsCash.toLocaleString()}</td>
                  <td></td>
                </tr>
              </tfoot>
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
                    <div className="grid grid-cols-2 gap-4">
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
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Deudas Pagadas</label>
                        <input 
                          type="number" 
                          value={editingItem.debtsPaid}
                          onChange={e => setEditingItem({...editingItem, debtsPaid: Number(e.target.value)})}
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold focus:border-blue-500 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Efectivo Caja</label>
                        <input 
                          type="number" 
                          value={editingItem.cashInBox}
                          onChange={e => setEditingItem({...editingItem, cashInBox: Number(e.target.value)})}
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold focus:border-blue-500 outline-none transition-all"
                        />
                      </div>
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
      
      {selectedDetail && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className={`p-6 md:p-8 text-white flex justify-between items-center ${selectedDetail.totalSold !== undefined ? 'bg-red-600' : 'bg-emerald-600'}`}>
              <div>
                <h3 className="text-xl md:text-2xl font-black tracking-tight">
                  {selectedDetail.totalSold !== undefined ? 'Detalle de Corte Maestro' : 'Detalle de Salida'}
                </h3>
                <p className="text-white/70 text-xs font-bold uppercase tracking-widest">
                  {new Date(selectedDetail.date).toLocaleString()}
                </p>
              </div>
              <button onClick={() => setSelectedDetail(null)} className="text-white/70 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 md:p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                {selectedDetail.totalSold !== undefined ? (
                  <>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Venta Bruta</label>
                      <p className="font-black text-blue-600 text-lg">${Number(selectedDetail.totalSold).toLocaleString()}</p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Utilidad Neta</label>
                      <p className="font-black text-emerald-600 text-lg">${Number(selectedDetail.netProfit).toLocaleString()}</p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Efectivo en Caja</label>
                      <p className="font-black text-blue-900 text-lg">${Number(selectedDetail.cashInBox || selectedDetail.totalSold).toLocaleString()}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Producto Principal</label>
                      <p className="font-black text-slate-800">{selectedDetail.productName}</p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Venta Total</label>
                      <p className="font-black text-emerald-600 text-lg">${Number(selectedDetail.totalSale).toLocaleString()}</p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Turno</label>
                      <p className="font-black text-slate-800 uppercase">{selectedDetail.shift || 'N/A'}</p>
                    </div>
                  </>
                )}
              </div>

              {selectedDetail.totalSold !== undefined ? (
                <>
                  {/* SECCIÓN 1: PRODUCTOS VENDIDOS */}
                  <div className="mt-6 flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <h4 className="text-xs font-black text-slate-800 tracking-wider uppercase">Desglose de Productos</h4>
                  </div>
                  <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-100">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-400 font-black uppercase tracking-widest">
                        <tr>
                          <th className="px-4 py-3 text-[10px]">Producto</th>
                          <th className="px-4 py-3 text-[10px] text-center">Cant</th>
                          <th className="px-4 py-3 text-[10px] text-right">Precio</th>
                          <th className="px-4 py-3 text-[10px] text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {closingProducts.length > 0 ? (
                          closingProducts.map((prod, idx) => (
                            <tr key={idx} className="border-b border-slate-100 hover:bg-white">
                              <td className="p-3 text-sm font-bold text-slate-700">{prod.productName}</td>
                              <td className="p-3 text-sm font-medium text-slate-600 text-center">{prod.quantity}</td>
                              <td className="p-3 text-sm font-medium text-slate-600 text-right">${prod.unitPrice.toLocaleString()}</td>
                              <td className="p-3 text-sm font-black text-slate-800 text-right">${prod.totalSale.toLocaleString()}</td>
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan={4} className="p-4 text-center text-sm text-slate-400 italic">No se encontraron productos para este cierre.</td></tr>
                        )}
                        {closingProducts.length > 0 && (
                          <tr className="bg-slate-100/50 border-t-2 border-slate-200">
                            <td colSpan={3} className="p-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Productos</td>
                            <td className="p-3 text-sm font-black text-blue-600 text-right">${totalClosingProducts.toLocaleString()}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* SECCIÓN 2: DEUDAS PAGADAS (SOLO SI HAY DEUDAS) */}
                  {closingDebts.length > 0 && (
                    <>
                      <div className="mt-6 flex items-center gap-2 mb-3">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        <h4 className="text-xs font-black text-slate-800 tracking-wider uppercase">Deudas Liquidadas</h4>
                      </div>
                      <div className="bg-emerald-50 rounded-xl overflow-hidden border border-emerald-100">
                        <table className="w-full text-left">
                          <thead className="bg-emerald-100/50">
                            <tr>
                              <th className="p-3 text-[10px] font-bold text-emerald-800 uppercase tracking-wider">ID Deuda</th>
                              <th className="p-3 text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Proveedor</th>
                              <th className="p-3 text-[10px] font-bold text-emerald-800 uppercase tracking-wider text-right">Monto Pagado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {closingDebts.map((debt, idx) => (
                              <tr key={idx} className="border-b border-emerald-100/50 hover:bg-emerald-100/30">
                                <td className="p-3 text-sm font-medium text-slate-600">{debt.id}</td>
                                <td className="p-3 text-sm font-bold text-slate-700">{debt.supplier}</td>
                                <td className="p-3 text-sm font-black text-emerald-600 text-right">${debt.total.toLocaleString()}</td>
                              </tr>
                            ))}
                            <tr className="bg-emerald-100/30 border-t-2 border-emerald-200">
                              <td colSpan={2} className="p-3 text-right text-[10px] font-black text-emerald-800 uppercase tracking-widest">Total Deudas Liquidadas</td>
                              <td className="p-3 text-sm font-black text-emerald-700 text-right">${totalClosingDebts.toLocaleString()}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <ClipboardList size={16} className={selectedDetail.totalSold !== undefined ? 'text-red-600' : 'text-emerald-600'} />
                    <span>Desglose de Productos</span>
                  </h4>
                  
                  <div className="border border-slate-100 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-400 font-black uppercase tracking-widest">
                        <tr>
                          <th className="px-4 py-3">Producto</th>
                          <th className="px-4 py-3 text-center">Cant</th>
                          <th className="px-4 py-3 text-right">Precio</th>
                          <th className="px-4 py-3 text-right">Total</th>
                          <th className="px-4 py-3 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {(() => {
                          let outputProducts: any[] = [];

                          if (selectedDetail) {
                            try {
                              // 1. Buscar el JSON en la clave vacía [""] o las de respaldo
                              const rawData = selectedDetail[""] || selectedDetail.soldProductsJson || selectedDetail.detailsJson || '[]';
                              
                              // 2. Si es un JSON válido que contiene el productId
                              if (typeof rawData === 'string' && rawData.includes('productId')) {
                                const parsed = JSON.parse(rawData);
                                
                                // 3. Enriquecer el array mapeando el ID con el nombre real
                                outputProducts = parsed.map((item: any) => {
                                  const productDef = allProducts.find(p => p.id === item.productId);
                                  const qty = Number(item.quantity || 1);
                                  const total = Number(item.totalSale || item.totalCost || 0);
                                  
                                  return {
                                    productId: item.productId,
                                    productName: productDef ? productDef.name : 'Producto Eliminado/Desconocido',
                                    quantity: qty,
                                    totalSale: total,
                                    unitPrice: total / qty // Calculamos el precio unitario matemáticamente
                                  };
                                });
                              }
                            } catch (error) {
                              console.warn("Error parseando el JSON oculto:", error);
                            }
                          }

                          if (outputProducts.length > 0) {
                            return (
                              <>
                                {outputProducts.map((prod: any, idx: number) => {
                                  const currentQty = editQuantities[prod.productId] !== undefined ? editQuantities[prod.productId] : prod.quantity;
                                  const unitPrice = prod.unitPrice || (prod.totalSale / prod.quantity);
                                  const currentTotal = currentQty * unitPrice;
                                  const isEdited = currentQty !== prod.quantity;

                                  return (
                                    <tr key={idx} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors ${isEdited ? 'bg-amber-50/50' : ''}`}>
                                      <td className="px-4 py-3 font-bold text-slate-700">{prod.productName}</td>
                                      <td className="px-4 py-3 text-center">
                                        <input 
                                          type="number" 
                                          min="0"
                                          value={currentQty}
                                          onChange={(e) => setEditQuantities({...editQuantities, [prod.productId]: Number(e.target.value)})}
                                          className="w-16 text-center border border-slate-300 rounded-md p-1 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                        />
                                      </td>
                                      <td className="px-4 py-3 text-right text-slate-500">
                                        ${unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                      </td>
                                      <td className="px-4 py-3 text-right font-black text-slate-900">
                                        ${currentTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                        {isEdited && (
                                          <button 
                                            onClick={async () => {
                                              try {
                                                const res = await dataService.updateOutputQuantity(
                                                  selectedDetail.id, 
                                                  prod.productId, 
                                                  prod.quantity, 
                                                  currentQty, 
                                                  unitPrice
                                                );
                                                if (res && res.success) {
                                                  setEditQuantities(prev => { 
                                                    const copy = {...prev}; 
                                                    delete copy[prod.productId]; 
                                                    return copy; 
                                                  });
                                                  alert("Cantidad actualizada e inventario ajustado.");
                                                }
                                              } catch (err) {
                                                alert("Error al actualizar la cantidad.");
                                              }
                                            }}
                                            className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold py-1 px-2 rounded transition-colors"
                                          >
                                            Guardar
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                                <tr className="bg-slate-100/50 border-t-2 border-slate-200">
                                  <td colSpan={3} className="px-4 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Salida</td>
                                  <td className="px-4 py-3 text-right font-black text-emerald-600 text-sm">
                                    ${outputProducts.reduce((acc: number, p: any) => {
                                      const q = editQuantities[p.productId] !== undefined ? editQuantities[p.productId] : p.quantity;
                                      return acc + (q * p.unitPrice);
                                    }, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td></td>
                                </tr>
                              </>
                            );
                          }

                          // Fallback para salidas manuales antiguas sin JSON
                          if (selectedDetail && selectedDetail.totalSold === undefined) {
                            const prod = {
                              productId: selectedDetail.productId,
                              productName: selectedDetail.productName || 'Desconocido',
                              quantity: selectedDetail.quantity || 0,
                              unitPrice: Number(selectedDetail.salePrice || 0),
                              totalSale: Number(selectedDetail.totalSale || 0)
                            };
                            
                            const currentQty = editQuantities[prod.productId] !== undefined ? editQuantities[prod.productId] : prod.quantity;
                            const currentTotal = currentQty * prod.unitPrice;
                            const isEdited = currentQty !== prod.quantity;

                            return (
                              <tr className={`hover:bg-slate-50/50 transition-colors ${isEdited ? 'bg-amber-50/50' : ''}`}>
                                <td className="px-4 py-3 font-bold text-slate-700">{prod.productName}</td>
                                <td className="px-4 py-3 text-center">
                                  <input 
                                    type="number" 
                                    min="0"
                                    value={currentQty}
                                    onChange={(e) => setEditQuantities({...editQuantities, [prod.productId]: Number(e.target.value)})}
                                    className="w-16 text-center border border-slate-300 rounded-md p-1 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                  />
                                </td>
                                <td className="px-4 py-3 text-right text-slate-500">
                                  ${prod.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-4 py-3 text-right font-black text-slate-900">
                                  ${currentTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {isEdited && (
                                    <button 
                                      onClick={async () => {
                                        try {
                                          const res = await dataService.updateOutputQuantity(
                                            selectedDetail.id, 
                                            prod.productId, 
                                            prod.quantity, 
                                            currentQty, 
                                            prod.unitPrice
                                          );
                                          if (res && res.success) {
                                            setEditQuantities(prev => { 
                                              const copy = {...prev}; 
                                              delete copy[prod.productId]; 
                                              return copy; 
                                            });
                                            alert("Cantidad actualizada e inventario ajustado.");
                                          }
                                        } catch (err) {
                                          alert("Error al actualizar la cantidad.");
                                        }
                                      }}
                                      className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold py-1 px-2 rounded transition-colors"
                                    >
                                      Guardar
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          } else {
                            return (
                              <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-slate-400 font-bold italic">
                                  No se encontraron detalles desglosados para este registro.
                                </td>
                              </tr>
                            );
                          }
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {selectedDetail.notes && (
                <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                  <label className="block text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Notas del Registro</label>
                  <p className="text-sm text-slate-700 font-medium italic">"{selectedDetail.notes}"</p>
                </div>
              )}
            </div>
            
            <div className="p-6 bg-slate-50 border-t border-slate-100">
              <button 
                onClick={() => setSelectedDetail(null)}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 uppercase tracking-widest text-xs"
              >
                Cerrar Detalle
              </button>
            </div>
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
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">ESTADO</span>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-black ${selectedNote.status === 'Paid' ? 'text-emerald-600' : 'text-amber-500'}`}>
                      {selectedNote.status === 'Paid' ? 'LIQUIDADO' : 'PENDIENTE'}
                    </span>
                    <button
                      onClick={() => handleToggleNoteStatus(selectedNote)}
                      className="flex items-center justify-center p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
                      title="Cambiar estado de pago"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
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
                        <th className="px-4 py-3 text-right">Acción</th>
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
                          <td className="px-4 py-3 text-right">
                            <button 
                              onClick={() => handleDeleteItem(selectedNote.id, item.productId)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar de la nota"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
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