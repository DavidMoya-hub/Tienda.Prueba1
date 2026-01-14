import React, { useState, useMemo } from 'react';
import { Calendar, ArrowUpCircle, ArrowDownCircle, Search, ClipboardList, Wallet, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { dataService } from '../services/dataService';

const HistoryView: React.FC = () => {
  const [tab, setTab] = useState<'Inputs' | 'Outputs' | 'Audit' | 'Debts'>('Inputs');
  const inputs = dataService.getInputs();
  const closings = dataService.getClosings();
  const priceHistory = dataService.getPriceHistory();
  const purchaseNotes = dataService.getPurchaseNotes();

  const handleMarkAsPaid = async (noteId: string) => {
    if (confirm("¿Marcar esta nota como PAGADA? Se usará el capital del Sobre 4.")) {
      await dataService.updateNoteStatus(noteId, 'Paid');
    }
  };

  const pendingDebts = useMemo(() => {
    return purchaseNotes.filter(n => n.status === 'Pending');
  }, [purchaseNotes]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <h2 className="text-3xl font-black text-blue-900 tracking-tight">Bitácoras Maestro</h2>
        <div className="flex bg-blue-50/50 border-2 border-blue-100 p-2 rounded-[2rem] shadow-xl shadow-blue-900/5 overflow-x-auto custom-scrollbar">
          <button 
            onClick={() => setTab('Inputs')}
            className={`px-6 py-3 rounded-2xl font-black transition-all flex items-center space-x-2 whitespace-nowrap tracking-tight ${tab === 'Inputs' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-blue-400 hover:text-blue-600'}`}
          >
            <ArrowUpCircle size={20} />
            <span>Entradas</span>
          </button>
          <button 
            onClick={() => setTab('Outputs')}
            className={`px-6 py-3 rounded-2xl font-black transition-all flex items-center space-x-2 whitespace-nowrap tracking-tight ${tab === 'Outputs' ? 'bg-red-600 text-white shadow-lg shadow-red-200' : 'text-blue-400 hover:text-blue-600'}`}
          >
            <ArrowDownCircle size={20} />
            <span>Cierres</span>
          </button>
          <button 
            onClick={() => setTab('Debts')}
            className={`px-6 py-3 rounded-2xl font-black transition-all flex items-center space-x-2 whitespace-nowrap tracking-tight ${tab === 'Debts' ? 'bg-amber-600 text-white shadow-lg shadow-amber-200' : 'text-blue-400 hover:text-blue-600'}`}
          >
            <Wallet size={20} />
            <span>Deudas {pendingDebts.length > 0 && `(${pendingDebts.length})`}</span>
          </button>
          <button 
            onClick={() => setTab('Audit')}
            className={`px-6 py-3 rounded-2xl font-black transition-all flex items-center space-x-2 whitespace-nowrap tracking-tight ${tab === 'Audit' ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : 'text-blue-400 hover:text-blue-600'}`}
          >
            <ClipboardList size={20} />
            <span>Auditoría</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] border border-blue-100 overflow-hidden shadow-2xl shadow-blue-900/5">
        {tab === 'Inputs' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-blue-50/50 text-blue-900/40 text-[10px] font-black uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-8 py-6">Fecha</th>
                  <th className="px-8 py-6">Producto</th>
                  <th className="px-8 py-6">Proveedor</th>
                  <th className="px-8 py-6">Cant</th>
                  <th className="px-8 py-6">Costo</th>
                  <th className="px-8 py-6 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50 text-sm">
                {inputs.slice().reverse().map(log => (
                  <tr key={log.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-8 py-5 text-slate-400 font-bold">{new Date(log.date).toLocaleDateString()}</td>
                    <td className="px-8 py-5 font-black text-slate-800 text-base">{log.productName}</td>
                    <td className="px-8 py-5 text-blue-400 font-bold">{log.provider}</td>
                    <td className="px-8 py-5 font-black text-blue-900"><span className="bg-blue-50 px-3 py-1 rounded-lg">{log.quantity}</span></td>
                    <td className="px-8 py-5 text-slate-400 font-bold">${Number(log.unitCost)?.toFixed(2)}</td>
                    <td className="px-8 py-5 font-black text-red-600 text-right text-lg">${Number(log.totalCost)?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'Outputs' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-blue-50/50 text-blue-900/40 text-[10px] font-black uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-8 py-6">Fecha Corte</th>
                  <th className="px-8 py-6">Venta Bruta</th>
                  <th className="px-8 py-6">Costo Inv (COGS)</th>
                  <th className="px-8 py-6">Utilidad Neta</th>
                  <th className="px-8 py-6 text-right">Margen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50 text-sm">
                {closings.slice().reverse().map(log => (
                  <tr key={log.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-8 py-5 font-black text-slate-800">{new Date(log.date).toLocaleString()}</td>
                    <td className="px-8 py-5 text-blue-600 font-black text-xl tracking-tighter">${Number(log.totalSold)?.toLocaleString()}</td>
                    <td className="px-8 py-5 text-slate-400 font-bold">-${Number(log.cogs)?.toLocaleString()}</td>
                    <td className="px-8 py-5 text-red-600 font-black text-xl tracking-tighter">${Number(log.netProfit)?.toLocaleString()}</td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end space-x-3">
                        <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                          <div 
                            className="h-full bg-red-600" 
                            style={{ width: `${Math.min(100, (log.netProfit / (log.totalSold || 1)) * 100 * 1.5)}%` }}
                          ></div>
                        </div>
                        <span className="text-[10px] font-black text-red-600 tracking-widest">{((log.netProfit / (log.totalSold || 1)) * 100).toFixed(0)}%</span>
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
            <table className="w-full text-left">
              <thead className="bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-8 py-6">Fecha</th>
                  <th className="px-8 py-6">Proveedor</th>
                  <th className="px-8 py-6">Importe Deuda</th>
                  <th className="px-8 py-6">Estado</th>
                  <th className="px-8 py-6 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50 text-sm">
                {purchaseNotes.slice().reverse().map(note => (
                  <tr key={note.id} className={`hover:bg-slate-50 transition-colors ${note.status === 'Pending' ? 'bg-amber-50/20' : ''}`}>
                    <td className="px-8 py-5 text-slate-400 font-bold">{new Date(note.date).toLocaleDateString()}</td>
                    <td className="px-8 py-5 font-black text-slate-800 text-lg">{note.provider}</td>
                    <td className="px-8 py-5 font-black text-red-600 text-xl tracking-tighter">${Number(note.totalAmount).toLocaleString()}</td>
                    <td className="px-8 py-5">
                      <div className="flex items-center space-x-2">
                        {note.status === 'Paid' ? (
                          <span className="flex items-center space-x-2 text-emerald-600 font-black text-[10px] uppercase tracking-widest bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                            <CheckCircle size={14} /> <span>Liquidado</span>
                          </span>
                        ) : (
                          <span className="flex items-center space-x-2 text-amber-600 font-black text-[10px] uppercase tracking-widest bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100">
                            <Clock size={14} className="animate-pulse" /> <span>Pendiente</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      {note.status === 'Pending' && (
                        <button 
                          onClick={() => handleMarkAsPaid(note.id)}
                          className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-xs hover:bg-blue-700 transition-all active:scale-95 shadow-xl shadow-blue-200 uppercase tracking-widest"
                        >
                          Liquidar Ahora
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {purchaseNotes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-32 text-blue-200 font-black italic text-xl">No hay registros de compras.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'Audit' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-900 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-8 py-6">Fecha Hora</th>
                  <th className="px-8 py-6">Producto</th>
                  <th className="px-8 py-6">Campo Alterado</th>
                  <th className="px-8 py-6">Anterior</th>
                  <th className="px-8 py-6 text-right">Nuevo Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50 text-sm">
                {priceHistory.slice().reverse().map(log => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-8 py-5 text-slate-400 font-medium">{new Date(log.date).toLocaleString()}</td>
                    <td className="px-8 py-5 font-black text-slate-800">{log.productName}</td>
                    <td className="px-8 py-5">
                      <span className="px-4 py-1 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-blue-100">{log.field}</span>
                    </td>
                    <td className="px-8 py-5 text-red-400 font-bold">{log.oldValue}</td>
                    <td className="px-8 py-5 text-blue-600 font-black text-xl text-right tracking-tighter">{log.newValue}</td>
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