import React, { useState } from 'react';
import { dataService } from '../services/dataService';
import { Wallet, ArrowUpRight, Clock, Calendar, Coins, History } from 'lucide-react';
import { Envelope, EnvelopeWithdrawal } from '../types';

const calculateDuration = (start: string, end: string) => {
  const s = new Date(start);
  const e = new Date(end);
  const diffTime = Math.abs(e.getTime() - s.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 30) return `${diffDays} días`;
  const months = Math.floor(diffDays / 30);
  const remainingDays = diffDays % 30;
  return `${months} meses y ${remainingDays} días`;
};

const EnvelopesManager: React.FC = () => {
  const envelopes = dataService.getEnvelopes();
  const history = dataService.getEnvelopeHistory();
  const [isProcessing, setIsProcessing] = useState(false);
  const [withdrawalNotes, setWithdrawalNotes] = useState("");

  const handleWithdraw = async (env: Envelope) => {
    if (env.balance <= 0) return alert("El sobre está vacío.");
    
    const duration = calculateDuration(env.lastResetDate, new Date().toISOString());
    const confirmMsg = `¿Deseas retirar $${env.balance.toLocaleString()} del "${env.name}"?\n\nTomó ${duration} conseguir esta cantidad.`;
    
    if (confirm(confirmMsg)) {
      setIsProcessing(true);
      const withdrawal: EnvelopeWithdrawal = {
        id: 'WDR-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
        envelopeId: env.id,
        envelopeName: env.name,
        amount: env.balance,
        startDate: env.lastResetDate,
        endDate: new Date().toISOString(),
        durationText: duration,
        notes: withdrawalNotes || "Retiro programado"
      };

      try {
        await dataService.withdrawEnvelope(withdrawal);
        setWithdrawalNotes("");
        alert("Retiro registrado y balance reiniciado.");
      } catch (e) {
        alert("Error al procesar el retiro.");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-blue-900 tracking-tighter flex items-center gap-3">
            <Coins className="text-red-600" size={36} />
            Gestión de Sobres
          </h2>
          <p className="text-slate-500 font-medium italic">Distribución de utilidades y fondo de capital.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {envelopes.map((env) => (
          <div key={env.id} className="bg-white p-8 rounded-[2.5rem] border-2 border-blue-50 shadow-xl shadow-blue-900/5 flex flex-col justify-between group hover:border-red-100 transition-all">
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div className="bg-blue-50 text-blue-600 p-4 rounded-2xl group-hover:bg-red-50 group-hover:text-red-600 transition-colors">
                  <Wallet size={24} />
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Acumulando desde</span>
                  <span className="text-xs font-bold text-blue-900 flex items-center justify-end gap-1">
                    <Calendar size={12} /> {new Date(env.lastResetDate).toLocaleDateString()}
                  </span>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">{env.name}</h3>
                <p className="text-4xl font-black text-blue-900 tracking-tighter">${env.balance.toLocaleString()}</p>
                <p className="text-xs text-slate-500 mt-2 italic">{env.description}</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tiempo transcurrido</p>
                <p className="text-sm font-bold text-blue-600 flex items-center gap-2">
                  <Clock size={16} /> {calculateDuration(env.lastResetDate, new Date().toISOString())}
                </p>
              </div>
            </div>

            <button 
              onClick={() => handleWithdraw(env)}
              disabled={isProcessing || env.balance <= 0}
              className="mt-8 w-full bg-blue-900 text-white font-black py-4 rounded-2xl hover:bg-red-600 transition-all flex items-center justify-center space-x-2 shadow-lg shadow-blue-900/20 active:scale-95 disabled:opacity-20"
            >
              <span>Retirar Fondos</span>
              <ArrowUpRight size={18} />
            </button>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[3rem] border border-blue-100 shadow-2xl overflow-hidden">
        <div className="p-8 bg-blue-900 border-b border-blue-800 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-red-600 p-3 rounded-2xl">
              <History className="text-white" size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-tight">Historial de Retiros</h3>
              <p className="text-blue-400 text-xs font-bold uppercase tracking-widest">Auditoría de utilidades e inversiones</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-blue-50/50 text-blue-900/40 text-[10px] font-black uppercase tracking-[0.2em]">
              <tr>
                <th className="px-8 py-6">Fecha Retiro</th>
                <th className="px-8 py-6">Sobre</th>
                <th className="px-8 py-6">Importe</th>
                <th className="px-8 py-6">Tiempo Acumulación</th>
                <th className="px-8 py-6">Rango de Fechas</th>
                <th className="px-8 py-6 text-right">ID Operación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-50 text-sm">
              {history.slice().reverse().map((item) => (
                <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-800">{new Date(item.endDate).toLocaleDateString()}</span>
                      <span className="text-[10px] font-bold text-slate-400">{new Date(item.endDate).toLocaleTimeString()}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg font-black text-[10px] uppercase tracking-widest border border-blue-100">
                      {item.envelopeName}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-xl font-black text-red-600 tracking-tighter">${item.amount.toLocaleString()}</span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2 font-bold text-slate-700">
                      <Clock size={16} className="text-blue-400" />
                      {item.durationText}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-slate-400 font-medium text-xs">
                    {new Date(item.startDate).toLocaleDateString()} → {new Date(item.endDate).toLocaleDateString()}
                  </td>
                  <td className="px-8 py-5 text-right font-mono text-[10px] text-slate-300">
                    {item.id}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-24 text-center text-blue-200 font-black italic text-xl">No hay registros de retiros previos.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EnvelopesManager;