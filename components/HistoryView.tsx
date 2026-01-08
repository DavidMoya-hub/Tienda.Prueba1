
import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, ArrowUpCircle, ArrowDownCircle, Search, ClipboardList, Wallet, CheckCircle, Clock, Trash2, RefreshCw } from 'lucide-react';
import { dataService } from '../services/dataService';
import { InputTransaction, DailyClosing, PriceHistory, PurchaseNote } from '../types';

const HistoryView: React.FC = () => {
  const [tab, setTab] = useState<'Inputs' | 'Outputs' | 'Audit' | 'Debts'>('Inputs');
  const [inputs, setInputs] = useState<InputTransaction[]>([]);
  const [closings, setClosings] = useState<DailyClosing[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [purchaseNotes, setPurchaseNotes] = useState<PurchaseNote[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const refreshHistory = async () => {
    await dataService.fetchAll();
    setInputs([...dataService.getInputs()]);
    setClosings([...dataService.getClosings()]);
    setPriceHistory([...dataService.getPriceHistory()]);
    setPurchaseNotes([...dataService.getPurchaseNotes()]);
  };

  useEffect(() => {
    refreshHistory();
  }, []);

  const handleMarkAsPaid = async (noteId: string) => {
    if (confirm("¿Marcar esta nota como PAGADA?")) {
      await dataService.updateNoteStatus(noteId, 'Paid');
      await refreshHistory();
    }
  };

  const handleDeleteInput = async (id: string, name: string, qty: number) => {
    if (confirm(`¿Eliminar entrada de "${name}"? Se restarán ${qty} unidades del stock actual.`)) {
      setIsProcessing(true);
      await dataService.deleteInput(id);
      await refreshHistory();
      setIsProcessing(false);
    }
  };

  const handleDeleteNote = async (id: string, provider: string) => {
    if (confirm(`¿Eliminar nota de "${provider}"? Esto no afectará el stock, solo el registro financiero.`)) {
      setIsProcessing(true);
      await dataService.deletePurchaseNote(id);
      await refreshHistory();
      setIsProcessing(false);
    }
  };

  const pendingDebts = useMemo(() => purchaseNotes.filter(n => n.status === 'Pending'), [purchaseNotes]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <h2 className="text-3xl font-black text-blue-900 tracking-tight">Bitácoras Maestro</h2>
        <div className="flex bg-blue-50/50 border-2 border-blue-100 p-2 rounded-[2rem] shadow-xl overflow-x-auto">
          <button onClick={() => setTab('Inputs')} className={`px-6 py-3 rounded-2xl font-black transition-all flex items-center space-x-2 ${tab === 'Inputs' ? 'bg-blue-600 text-white' : 'text-blue-400'}`}>
            <ArrowUpCircle size={20} /> <span>Entradas</span>
          </button>
          <button onClick={() => setTab('Outputs')} className={`px-6 py-3 rounded-2xl font-black transition-all flex items-center space-x-2 ${tab === 'Outputs' ? 'bg-red-600 text-white' : 'text-blue-400'}`}>
            <ArrowDownCircle size={20} /> <span>Cierres</span>
          </button>
          <button onClick={() => setTab('Debts')} className={`px-6 py-3 rounded-2xl font-black transition-all flex items-center space-x-2 ${tab === 'Debts' ? 'bg-amber-600 text-white' : 'text-blue-400'}`}>
            <Wallet size={20} /> <span>Deudas ({pendingDebts.length})</span>
          </button>
          <button onClick={() => setTab('Audit')} className={`px-6 py-3 rounded-2xl font-black transition-all flex items-center space-x-2 ${tab === 'Audit' ? 'bg-slate-900 text-white' : 'text-blue-400'}`}>
            <ClipboardList size={20} /> <span>Auditoría</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] border border-blue-100 overflow-hidden shadow-2xl">
        {isProcessing && (
          <div className="p-20 text-center"><RefreshCw className="animate-spin mx-auto text-blue-600" size={48} /></div>
        )}
        
        {!isProcessing && tab === 'Inputs' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-blue-50/50 text-blue-900/40 text-[10px] font-black uppercase tracking-widest">
                <tr><th className="px-8 py-6">Fecha</th><th className="px-8 py-6">Producto</th><th className="px-8 py-6">Cant</th><th className="px-8 py-6">Total</th><th className="px-8 py-6 text-right">Acción</th></tr>
              </thead>
              <tbody className="divide-y divide-blue-50 text-sm">
                {inputs.slice().reverse().map(log => (
                  <tr key={log.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-8 py-5 text-slate-400 font-bold">{new Date(log.date).toLocaleDateString()}</td>
                    <td className="px-8 py-5 font-black text-slate-800">{log.productName}</td>
                    <td className="px-8 py-5 font-black text-blue-900"><span className="bg-blue-50 px-3 py-1 rounded-lg">+{log.quantity}</span></td>
                    <td className="px-8 py-5 font-black text-red-600">${Number(log.totalCost).toFixed(2)}</td>
                    <td className="px-8 py-5 text-right"><button onClick={() => handleDeleteInput(log.id, log.productName, log.quantity)} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isProcessing && tab === 'Debts' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-widest">
                <tr><th className="px-8 py-6">Fecha</th><th className="px-8 py-6">Proveedor</th><th className="px-8 py-6">Importe</th><th className="px-8 py-6">Estado</th><th className="px-8 py-6 text-right">Acciones</th></tr>
              </thead>
              <tbody className="divide-y divide-blue-50 text-sm">
                {purchaseNotes.slice().reverse().map(note => (
                  <tr key={note.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-8 py-5 text-slate-400 font-bold">{new Date(note.date).toLocaleDateString()}</td>
                    <td className="px-8 py-5 font-black text-slate-800">{note.provider}</td>
                    <td className="px-8 py-5 font-black text-red-600">${Number(note.totalAmount).toLocaleString()}</td>
                    <td className="px-8 py-5">
                       {note.status === 'Paid' ? <span className="text-emerald-600 font-black text-[10px] uppercase bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">PAGADO</span> : <span className="text-amber-600 font-black text-[10px] uppercase bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100">PENDIENTE</span>}
                    </td>
                    <td className="px-8 py-5 text-right space-x-3">
                      {note.status === 'Pending' && <button onClick={() => handleMarkAsPaid(note.id)} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-xs font-black">Liquidar</button>}
                      <button onClick={() => handleDeleteNote(note.id, note.provider)} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryView;
