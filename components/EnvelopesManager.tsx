
import React, { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { Wallet, ArrowUpRight, Clock, Calendar, Coins, History, PlusCircle, Edit3, Trash2, X, Check, RefreshCw, Lock } from 'lucide-react';
import { Envelope, EnvelopeWithdrawal } from '../types';

const calculateDuration = (start: string | undefined, end: string) => {
  if (!start) return "N/A";
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime())) return "Sin datos";
  const diffTime = Math.abs(e.getTime() - s.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 30) return `${diffDays} días`;
  const months = Math.floor(diffDays / 30);
  const remainingDays = diffDays % 30;
  return `${months} meses y ${remainingDays} días`;
};

const formatDate = (dateStr: string | undefined) => {
  if (!dateStr) return new Date().toLocaleDateString('es-MX');
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date().toLocaleDateString('es-MX') : d.toLocaleDateString('es-MX');
};

const EnvelopesManager: React.FC = () => {
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [history, setHistory] = useState<EnvelopeWithdrawal[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showEditWithdrawalModal, setShowEditWithdrawalModal] = useState(false);
  const [editingEnv, setEditingEnv] = useState<Envelope | null>(null);
  const [editingWithdrawal, setEditingWithdrawal] = useState<EnvelopeWithdrawal | null>(null);
  const [withdrawalNotes, setWithdrawalNotes] = useState("");
  
  const [formData, setFormData] = useState<any>({
    id: '',
    name: '',
    balance: '0',
    description: '',
    lastResetDate: new Date().toISOString()
  });

  // Inicialización de datos con estado de React
  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
    await dataService.fetchAll();
    setEnvelopes([...dataService.getEnvelopes()]);
    setHistory([...dataService.getEnvelopeHistory()]);
  };

  const isCoreEnvelope = (id: string) => ['ENV1', 'ENV2', 'ENV3', 'ENV4'].includes(id);
  const isBalanceEditable = (id: string) => !['ENV1', 'ENV2', 'ENV3'].includes(id);

  const openModal = (env?: Envelope) => {
    if (env) {
      setEditingEnv(env);
      setFormData({ ...env, balance: String(env.balance) });
    } else {
      setEditingEnv(null);
      setFormData({
        id: 'ENV-' + Math.random().toString(36).substr(2, 5).toUpperCase(),
        name: '',
        balance: '0',
        description: '',
        lastResetDate: new Date().toISOString()
      });
    }
    setShowModal(true);
  };

  const handleSaveEnvelope = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const dataToSave = {
        ...formData,
        balance: parseFloat(formData.balance as string) || 0
      };
      await dataService.saveEnvelope(dataToSave as Envelope);
      await refreshData();
      setShowModal(false);
    } catch (err) {
      alert("Error al guardar el sobre.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteWithdrawal = async (id: string, amount: number) => {
    if (confirm(`¿Anular este retiro de $${amount.toLocaleString()}? El dinero se devolverá al sobre original.`)) {
      setIsProcessing(true);
      try {
        await dataService.deleteWithdrawal(id);
        await refreshData();
      } catch (e) {
        alert("Error al eliminar retiro.");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const openEditWithdrawal = (w: EnvelopeWithdrawal) => {
    setEditingWithdrawal({ ...w, amount: String(w.amount) } as any);
    setShowEditWithdrawalModal(true);
  };

  const handleUpdateWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWithdrawal) return;
    setIsProcessing(true);
    try {
      const dataToUpdate = {
        ...editingWithdrawal,
        amount: parseFloat((editingWithdrawal as any).amount) || 0
      };
      await dataService.updateWithdrawal(dataToUpdate as any);
      await refreshData();
      setShowEditWithdrawalModal(false);
    } catch (err) {
      alert("Error al actualizar retiro.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWithdraw = async (env: Envelope) => {
    if (env.balance <= 0) return alert("El sobre está vacío.");
    const duration = calculateDuration(env.lastResetDate, new Date().toISOString());
    if (confirm(`¿Retirar $${Number(env.balance).toLocaleString()} de "${env.name}"?`)) {
      setIsProcessing(true);
      const withdrawal: EnvelopeWithdrawal = {
        id: 'WDR-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
        envelopeId: env.id,
        envelopeName: env.name,
        amount: env.balance,
        startDate: env.lastResetDate || new Date().toISOString(),
        endDate: new Date().toISOString(),
        durationText: duration,
        notes: withdrawalNotes || "Retiro manual"
      };
      try {
        await dataService.withdrawEnvelope(withdrawal);
        await refreshData();
        setWithdrawalNotes("");
      } catch (e) {
        alert("Error al procesar el retiro.");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-500 max-w-[1400px] mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="bg-red-600 p-3 rounded-2xl shadow-xl shadow-red-100">
            <Coins className="text-white w-7 h-7 md:w-8 md:h-8" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-blue-900 tracking-tighter">Gestión de Sobres</h2>
            <p className="text-slate-500 font-bold uppercase text-[8px] md:text-[10px] tracking-widest italic">Persistencia de capital y utilidades automáticas.</p>
          </div>
        </div>
        <button onClick={() => openModal()} className="w-full sm:w-auto bg-blue-900 hover:bg-blue-800 text-white font-black px-6 py-3 md:py-4 rounded-2xl transition-all shadow-xl flex items-center justify-center space-x-2 active:scale-95 text-sm md:text-base">
          <PlusCircle size={20} />
          <span>Nuevo Sobre</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {envelopes.map((env) => (
          <div key={env.id} className="bg-white p-6 md:p-8 rounded-3xl md:rounded-[2.5rem] border-2 border-slate-50 shadow-2xl flex flex-col justify-between group hover:border-red-100 transition-all min-h-[380px] md:min-h-[420px]">
            <div className="space-y-6 md:space-y-8">
              <div className="flex justify-between items-start">
                <div className={`p-3 md:p-4 rounded-2xl transition-colors shadow-sm ${env.id === 'ENV4' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                  {isCoreEnvelope(env.id) ? <Lock className="w-5 h-5 md:w-6 md:h-6 opacity-40" /> : <Wallet className="w-5 h-5 md:w-6 md:h-6" />}
                </div>
                <div className="text-right">
                  <span className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest block">Último reinicio</span>
                  <span className="text-[10px] md:text-xs font-black text-blue-900 flex items-center justify-end gap-1">
                    <Calendar size={12} className="text-blue-400" /> {formatDate(env.lastResetDate)}
                  </span>
                </div>
              </div>
              <div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2">{env.name.toUpperCase()}</h3>
                <p className="text-4xl md:text-5xl font-black text-blue-900 tracking-tighter">${Number(env.balance || 0).toLocaleString()}</p>
                <p className="text-[9px] md:text-[10px] text-slate-400 mt-2 font-bold italic">{env.description}</p>
              </div>
              <div className="bg-slate-50 p-4 md:p-5 rounded-2xl md:rounded-[1.8rem] border border-slate-100 space-y-2">
                <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Tiempo acumulado</p>
                <p className="text-[10px] md:text-xs font-black text-blue-600 flex items-center gap-2"><Clock size={14} className="w-3.5 h-3.5 md:w-4 md:h-4" /> {calculateDuration(env.lastResetDate, new Date().toISOString())}</p>
              </div>
            </div>
            <div className="mt-6 md:mt-8 space-y-3">
              <button onClick={() => handleWithdraw(env)} disabled={isProcessing || Number(env.balance) <= 0} className={`w-full font-black py-3 md:py-4 rounded-2xl transition-all flex items-center justify-center space-x-2 shadow-xl active:scale-95 disabled:opacity-30 text-sm md:text-base ${env.id === 'ENV4' ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}>
                <span>Retirar Fondos</span>
                <ArrowUpRight size={18} />
              </button>
              <div className="flex items-center justify-center space-x-4">
                <button onClick={() => openModal(env)} className="text-slate-300 hover:text-blue-600 transition-colors p-2"><Edit3 size={18} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl md:rounded-[3rem] border border-slate-100 shadow-2xl overflow-hidden mt-12">
        <div className="p-6 md:p-10 bg-[#1e3a8a] flex items-center space-x-4 md:space-x-6 text-white">
          <div className="bg-red-600 p-3 md:p-4 rounded-2xl shadow-xl shadow-red-900/40"><History className="w-6 h-6 md:w-8 md:h-8" /></div>
          <div><h3 className="text-xl md:text-2xl font-black tracking-tighter">Historial de Retiros</h3><p className="text-blue-300 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em]">Auditoría de utilidades e inversiones</p></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-slate-50 text-blue-900/40 text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em]">
              <tr><th className="px-6 md:px-10 py-6 md:py-8">Fecha</th><th className="px-6 md:px-10 py-6 md:py-8">Sobre</th><th className="px-6 md:px-10 py-6 md:py-8 text-center">Importe</th><th className="px-6 md:px-10 py-6 md:py-8">Tiempo</th><th className="px-6 md:px-10 py-6 md:py-8 text-right">Acciones</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs md:text-sm">
              {history.slice().reverse().map((item) => (
                <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-6 md:px-10 py-4 md:py-6 font-black text-slate-800">{formatDate(item.endDate)}</td>
                  <td className="px-6 md:px-10 py-4 md:py-6"><span className="bg-blue-50 text-blue-600 px-3 md:px-4 py-1 md:py-1.5 rounded-lg md:rounded-xl font-black text-[8px] md:text-[10px] uppercase tracking-widest border border-blue-100">{item.envelopeName}</span></td>
                  <td className="px-6 md:px-10 py-4 md:py-6 text-center"><span className="text-lg md:text-2xl font-black text-red-600 tracking-tighter">${Number(item.amount).toLocaleString()}</span></td>
                  <td className="px-6 md:px-10 py-4 md:py-6 font-black text-slate-700">{item.durationText}</td>
                  <td className="px-6 md:px-10 py-4 md:py-6 text-right space-x-2">
                     <button onClick={() => openEditWithdrawal(item)} className="text-slate-300 hover:text-blue-600 p-2"><Edit3 size={16} /></button>
                     <button onClick={() => handleDeleteWithdrawal(item.id, Number(item.amount))} className="text-slate-300 hover:text-red-500 p-2"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
              {history.length === 0 && (<tr><td colSpan={5} className="text-center py-16 md:py-20 text-slate-300 font-bold italic">No hay retiros registrados.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-blue-950/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl md:rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-blue-900 p-6 md:p-8 flex justify-between items-center text-white">
              <h3 className="text-lg md:text-xl font-black tracking-tight">{editingEnv ? 'Editar Sobre' : 'Crear Sobre'}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-full"><X size={24} /></button>
            </div>
            <form onSubmit={handleSaveEnvelope} className="p-6 md:p-10 space-y-6 md:space-y-8">
              <div className="space-y-3 md:space-y-4">
                <label className="text-[10px] font-black text-blue-900 uppercase tracking-widest px-1">Nombre del Sobre</label>
                <input required disabled={!!(editingEnv && isCoreEnvelope(editingEnv.id))} value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full p-4 md:p-5 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-500 focus:outline-none transition-all font-black text-slate-800 disabled:opacity-50" />
              </div>
              <div className="space-y-3 md:space-y-4">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-black text-blue-900 uppercase tracking-widest">Saldo Actual ($)</label>
                </div>
                <input 
                  type="number" 
                  required 
                  value={formData.balance} 
                  onChange={(e) => setFormData({...formData, balance: e.target.value})} 
                  className="w-full p-4 md:p-5 border-2 border-transparent rounded-2xl focus:outline-none transition-all font-black text-xl md:text-2xl bg-blue-50/50 text-blue-600 focus:bg-white focus:border-blue-500" 
                />
              </div>
              <div className="space-y-3 md:space-y-4">
                <label className="text-[10px] font-black text-blue-900 uppercase tracking-widest px-1">Descripción</label>
                <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full p-4 md:p-5 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-500 focus:outline-none transition-all font-bold text-slate-600 h-20 md:h-24" />
              </div>
              <button type="submit" disabled={isProcessing} className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 md:py-5 rounded-2xl transition-all shadow-xl flex items-center justify-center space-x-3 text-base md:text-lg">{isProcessing ? <RefreshCw className="animate-spin" /> : <Check size={24} />}<span>Guardar Cambios</span></button>
            </form>
          </div>
        </div>
      )}

      {showEditWithdrawalModal && editingWithdrawal && (
        <div className="fixed inset-0 bg-blue-950/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl md:rounded-[3rem] shadow-2xl overflow-hidden">
            <div className="bg-[#1e3a8a] p-6 md:p-8 flex justify-between items-center text-white">
              <h3 className="text-lg md:text-xl font-black">Editar Retiro</h3>
              <button onClick={() => setShowEditWithdrawalModal(false)} className="p-2 hover:bg-white/10 rounded-full"><X size={24} /></button>
            </div>
            <form onSubmit={handleUpdateWithdrawal} className="p-6 md:p-10 space-y-6 md:space-y-8">
              <div className="space-y-3 md:space-y-4">
                <label className="text-[10px] font-black text-blue-900 uppercase tracking-widest">Monto del Retiro ($)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  required 
                  value={(editingWithdrawal as any).amount} 
                  onChange={(e) => setEditingWithdrawal({...editingWithdrawal, amount: e.target.value} as any)} 
                  className="w-full p-4 md:p-5 bg-blue-50/50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-500 transition-all font-black text-xl md:text-2xl text-red-600" 
                />
              </div>
              <div className="space-y-3 md:space-y-4">
                <label className="text-[10px] font-black text-blue-900 uppercase tracking-widest">Notas / Motivo</label>
                <textarea value={editingWithdrawal.notes} onChange={(e) => setEditingWithdrawal({...editingWithdrawal, notes: e.target.value})} className="w-full p-4 md:p-5 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-500 transition-all font-bold text-slate-600 h-20 md:h-24" />
              </div>
              <p className="text-[9px] md:text-[10px] text-amber-600 font-bold italic">* Al cambiar el monto, el saldo del sobre "{editingWithdrawal.envelopeName}" se ajustará automáticamente.</p>
              <button type="submit" disabled={isProcessing} className="w-full bg-blue-900 text-white font-black py-4 md:py-5 rounded-2xl shadow-xl flex items-center justify-center space-x-3 text-base md:text-lg">{isProcessing ? <RefreshCw className="animate-spin" /> : <Check size={24} />}<span>Actualizar Retiro</span></button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnvelopesManager;
