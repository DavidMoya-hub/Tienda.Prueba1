import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { Wallet, PiggyBank, ArrowRight, TrendingUp, ShoppingBag, DollarSign, RefreshCw, Store } from 'lucide-react';
import { dataService } from '../services/dataService';

const PIE_COLORS = ['#dc2626', '#2563eb']; // Red-600 and Blue-600

const StatCard: React.FC<{ envelope: any, index: number }> = ({ envelope, index }) => {
  const navigate = useNavigate();
  const isCapital = envelope.id === 'ENV4';

  return (
    <div className={`p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] border-2 shadow-2xl transition-all hover:scale-[1.02] flex flex-col justify-between h-full ${
      isCapital 
        ? 'bg-blue-900 border-blue-800 text-white shadow-blue-900/20' 
        : 'bg-white border-blue-50 text-slate-900 shadow-slate-200/50'
    }`}>
      <div>
        <div className="flex justify-between items-start mb-4 md:mb-6">
          <div className={`p-2.5 md:p-4 rounded-xl md:rounded-2xl ${isCapital ? 'bg-red-600 shadow-lg shadow-red-900/40' : 'bg-blue-50 text-blue-600'}`}>
            {isCapital ? <PiggyBank size={20} className="md:w-7 md:h-7" /> : <Wallet size={20} className="md:w-7 md:h-7" />}
          </div>
          {!isCapital && (
            <span className="bg-emerald-100 text-emerald-600 px-2 py-0.5 md:px-3 md:py-1 rounded-lg text-[8px] md:text-[10px] font-black uppercase tracking-widest">
              Activo
            </span>
          )}
        </div>
        <h3 className={`text-[9px] md:text-sm font-black uppercase tracking-widest mb-1 ${isCapital ? 'text-blue-300' : 'text-slate-400'}`}>
          {envelope.name}
        </h3>
        <p className={`text-xl md:text-4xl font-black tracking-tighter mb-2`}>
          ${Number(envelope.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
        <p className={`text-[9px] md:text-xs font-medium ${isCapital ? 'text-blue-200' : 'text-slate-500'} italic`}>
          {envelope.description}
        </p>
      </div>
      
      {isCapital && (
        <button 
          onClick={() => navigate('/restock')}
          className="mt-6 md:mt-8 flex items-center justify-center space-x-2 w-full bg-red-600 hover:bg-red-700 text-white font-black py-3 md:py-4 rounded-xl md:rounded-2xl transition-all group text-sm md:text-base"
        >
          <span>Resurtir Inventario</span>
          <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
        </button>
      )}
    </div>
  );
};

const Dashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dataService.getDashboardData().then(res => {
      setData(res);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <RefreshCw className="animate-spin text-blue-600" size={48} />
    </div>
  );

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-4xl font-black text-blue-900 tracking-tighter flex items-center gap-2 md:gap-3">
            <Store className="text-red-600 w-8 h-8 md:w-9 md:h-9" />
            tiendita <span className="text-slate-300">Insights</span>
          </h2>
          <p className="text-xs md:text-sm text-slate-500 font-medium">Resumen financiero y rendimiento de stock.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {data?.envelopes.map((env: any, idx: number) => (
          <StatCard key={env.id} envelope={env} index={idx} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6 md:space-y-8">
          <div className="bg-white p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-blue-50 shadow-xl shadow-slate-200/50">
            <h3 className="text-lg md:text-xl font-black text-slate-800 mb-6 md:mb-8 flex items-center space-x-2">
              <TrendingUp className="text-red-600 md:w-6 md:h-6" size={20} />
              <span>Capital vs. Utilidad Acumulada</span>
            </h3>
            <div className="h-64 md:h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.profitVsCapital}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontWeight: 700, fontSize: 10}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontWeight: 700, fontSize: 10}} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{borderRadius: '1rem md:1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '0.75rem md:1rem'}}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {data?.profitVsCapital.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#dc2626' : '#2563eb'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <div className="bg-white p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-blue-50 shadow-xl shadow-slate-200/50">
              <h3 className="text-base md:text-lg font-black text-slate-800 mb-4 md:mb-6 flex items-center space-x-2">
                <ShoppingBag className="text-blue-600 md:w-5 md:h-5" size={18} />
                <span>Más Vendidos (Volumen)</span>
              </h3>
              <div className="space-y-3 md:space-y-4">
                {data?.topVolume.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 md:p-4 bg-slate-50 rounded-xl md:rounded-2xl border border-slate-100">
                    <span className="font-bold text-slate-700 text-xs md:text-sm">{item.name}</span>
                    <span className="bg-blue-100 text-blue-700 px-2 md:px-3 py-0.5 md:py-1 rounded-lg font-black text-[10px] md:text-xs">{item.volume} units</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-blue-50 shadow-xl shadow-slate-200/50">
              <h3 className="text-base md:text-lg font-black text-slate-800 mb-4 md:mb-6 flex items-center space-x-2">
                <DollarSign className="text-red-600 md:w-5 md:h-5" size={18} />
                <span>Mayor Ganancia ($)</span>
              </h3>
              <div className="space-y-3 md:space-y-4">
                {data?.topProfit.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 md:p-4 bg-red-50 rounded-xl md:rounded-2xl border border-red-100">
                    <span className="font-bold text-slate-700 text-xs md:text-sm">{item.name}</span>
                    <span className="bg-red-100 text-red-700 px-2 md:px-3 py-0.5 md:py-1 rounded-lg font-black text-[10px] md:text-xs">${item.profit.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 bg-slate-900 text-white p-6 md:p-10 rounded-2xl md:rounded-[2.5rem] shadow-2xl flex flex-col justify-between border-4 border-slate-800">
          <div>
            <h3 className="text-xl md:text-2xl font-black text-red-500 mb-2 tracking-tight">Estructura de Capital</h3>
            <p className="text-slate-400 text-xs md:text-sm mb-6 md:mb-8 font-medium italic">Distribución actual de fondos en bóveda.</p>
            
            <div className="h-48 md:h-64 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.profitVsCapital}
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {data?.profitVsCapital.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip 
                     contentStyle={{borderRadius: '1rem', background: '#1e293b', border: 'none', color: '#fff'}}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <span className="text-[8px] md:text-[10px] font-black uppercase text-slate-500 tracking-widest block">Total</span>
                  <span className="text-lg md:text-2xl font-black">${(data?.profitVsCapital.reduce((a:any, b:any) => a + b.value, 0)).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 md:mt-8 space-y-3 md:space-y-4">
               {data?.profitVsCapital.map((entry: any, index: number) => (
                 <div key={index} className="flex items-center justify-between p-3 md:p-4 bg-slate-800/50 rounded-xl md:rounded-2xl border border-slate-700/50">
                   <div className="flex items-center space-x-3">
                     <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full" style={{backgroundColor: PIE_COLORS[index]}}></div>
                     <span className="text-[10px] md:text-xs font-bold text-slate-300">{entry.name}</span>
                   </div>
                   <span className="font-black text-xs md:text-sm">${entry.value.toLocaleString()}</span>
                 </div>
               ))}
            </div>
          </div>

          <div className="mt-8 md:mt-12 p-4 md:p-6 bg-red-600/10 rounded-2xl md:rounded-3xl border border-red-500/20 text-center">
            <p className="text-red-500 font-black uppercase text-[8px] md:text-[10px] tracking-widest mb-1">Misión del Día</p>
            <p className="text-xs md:text-sm font-medium text-slate-300">"Cuida el Sobre 4 como el corazón de tu tiendita."</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;