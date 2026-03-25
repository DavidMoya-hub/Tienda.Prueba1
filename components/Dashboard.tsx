import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { Wallet, PiggyBank, ArrowRight, TrendingUp, ShoppingBag, DollarSign, RefreshCw, Store, PlusCircle } from 'lucide-react';
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
          ${Number(envelope.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const init = async () => {
      if (dataService.getProducts().length === 0) {
        await dataService.fetchAll();
      }
      setLoading(false);
    };
    init();
    return dataService.subscribe(() => setTick(t => t + 1));
  }, []);

  const closings = dataService.getClosings();
  const products = dataService.getProducts();
  const envelopes = dataService.getEnvelopes();
  const outputs = dataService.getOutputs();

  const { topVendidos, topGanancias, chartData } = useMemo(() => {
    const stats: Record<string, { name: string; qty: number; profit: number }> = {};
    const allProducts = dataService.getProducts(); // Catálogo para cruzar nombres y costos

    outputs.forEach(out => {
      let items: any[] = [];

      // 1. Intentar extraer JSON oculto de las salidas maestras
      try {
        const raw = (out as any)[""] || (out as any).soldProductsJson || (out as any).detailsJson;
        if (typeof raw === 'string' && raw.includes('productId')) {
          items = JSON.parse(raw);
        } else if (Array.isArray(raw)) {
          items = raw;
        }
      } catch (e) {}

      // 2. Si no es JSON, asumir que es salida individual antigua
      if (items.length === 0 && out.productId && out.productName !== 'Cierre Maestro') {
        items = [out];
      }

      // 3. Procesar y calcular
      items.forEach(item => {
        const id = String(item.productId || 'desconocido');
        if (id === 'desconocido' || id === 'MASTER') return; // Ignorar punteros

        // Cruce de datos con catálogo maestro
        const productDef = allProducts.find(p => p.id === id);
        const name = productDef ? productDef.name : (item.productName || item.name || 'Desconocido');
        const costPrice = productDef ? Number(productDef.costPrice || 0) : Number(item.unitCost || 0);

        const qty = Number(item.quantity || 0);
        const totalSale = Number(item.totalSale || item.price || 0); 
        
        // Ganancia = Venta Total de la partida - (Costo Unitario * Cantidad)
        const gananciaPartida = totalSale > 0 ? totalSale - (costPrice * qty) : 0;

        if (!stats[id]) stats[id] = { name, qty: 0, profit: 0 };
        
        stats[id].qty += qty;
        stats[id].profit += gananciaPartida;
      });
    });

    const arr = Object.values(stats);
    const topVendidos = [...arr].sort((a, b) => b.qty - a.qty).slice(0, 5);
    const topGanancias = [...arr].sort((a, b) => b.profit - a.profit).slice(0, 5);

    const utilidadReal = closings.reduce((acc, c) => acc + (Number(c.netProfit) || 0), 0);
    const valorInventario = products.reduce((acc, p) => acc + (Number(p.stock) * Number(p.costPrice)), 0);
    const capitalEnv = envelopes.find(e => e.id === 'ENV4');
    const dineroBoveda = capitalEnv ? Number(capitalEnv.balance) : 0;
    const capitalReal = valorInventario + dineroBoveda;

    const chartData = [
      { name: 'Capital Real', value: capitalReal },
      { name: 'Utilidad Real', value: utilidadReal }
    ];

    return { topVendidos, topGanancias, chartData };
  }, [closings, products, envelopes, outputs]);

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
        {envelopes.map((env: any, idx: number) => (
          <StatCard key={env.id} envelope={env} index={idx} />
        ))}
      </div>

      {/* Acciones Rápidas */}
      <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-blue-50 shadow-xl shadow-slate-200/50">
        <h3 className="text-lg md:text-xl font-black text-slate-800 mb-6 flex items-center space-x-2">
          <RefreshCw className="text-blue-600 md:w-6 md:h-6" size={20} />
          <span>Acciones Rápidas</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button 
            onClick={() => navigate('/restock')}
            className="flex items-center justify-between p-4 bg-indigo-50 rounded-2xl border border-indigo-100 hover:bg-indigo-100 transition-all group"
          >
            <div className="flex items-center space-x-3">
              <div className="bg-indigo-600 text-white p-2 rounded-xl">
                <RefreshCw size={20} />
              </div>
              <span className="font-black text-indigo-900 text-sm">Resurtido</span>
            </div>
            <ArrowRight size={18} className="text-indigo-400 group-hover:translate-x-1 transition-transform" />
          </button>
          
          <button 
            onClick={() => navigate('/count')}
            className="flex items-center justify-between p-4 bg-red-50 rounded-2xl border border-red-100 hover:bg-red-100 transition-all group"
          >
            <div className="flex items-center space-x-3">
              <div className="bg-red-600 text-white p-2 rounded-xl">
                <ShoppingBag size={20} />
              </div>
              <span className="font-black text-red-900 text-sm">Inv. Físico</span>
            </div>
            <ArrowRight size={18} className="text-red-400 group-hover:translate-x-1 transition-transform" />
          </button>

          <button 
            onClick={() => navigate('/register')}
            className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100 transition-all group"
          >
            <div className="flex items-center space-x-3">
              <div className="bg-slate-900 text-white p-2 rounded-xl">
                <PlusCircle size={20} />
              </div>
              <span className="font-black text-slate-900 text-sm">Nuevo Producto</span>
            </div>
            <ArrowRight size={18} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
          </button>

          <button 
            onClick={() => navigate('/envelopes')}
            className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100 hover:bg-emerald-100 transition-all group"
          >
            <div className="flex items-center space-x-3">
              <div className="bg-emerald-600 text-white p-2 rounded-xl">
                <Wallet size={20} />
              </div>
              <span className="font-black text-emerald-900 text-sm">Ver Sobres</span>
            </div>
            <ArrowRight size={18} className="text-emerald-400 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
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
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontWeight: 700, fontSize: 10}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontWeight: 700, fontSize: 10}} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{borderRadius: '1rem md:1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '0.75rem md:1rem'}}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {chartData.map((entry: any, index: number) => (
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
              <div className="space-y-3 mt-4">
                {topVendidos.length === 0 ? <p className="text-sm text-gray-400 text-center">No hay datos suficientes</p> : 
                  topVendidos.map((item, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors">
                      <span className="text-sm font-bold text-slate-700">{item.name}</span>
                      <span className="text-xs font-black text-blue-600 bg-blue-100 px-2 py-1 rounded-md">{item.qty} units</span>
                    </div>
                  ))
                }
              </div>
            </div>
            <div className="bg-white p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-blue-50 shadow-xl shadow-slate-200/50">
              <h3 className="text-base md:text-lg font-black text-slate-800 mb-4 md:mb-6 flex items-center space-x-2">
                <DollarSign className="text-red-600 md:w-5 md:h-5" size={18} />
                <span>Mayor Ganancia ($)</span>
              </h3>
              <div className="space-y-3 mt-4">
                {topGanancias.length === 0 ? <p className="text-sm text-gray-400 text-center">No hay datos suficientes</p> : 
                  topGanancias.map((item, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-red-50 hover:bg-red-100 rounded-xl transition-colors">
                      <span className="text-sm font-bold text-slate-700">{item.name}</span>
                      <span className="text-xs font-black text-red-600 bg-red-100 px-2 py-1 rounded-md">${item.profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  ))
                }
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
                    data={chartData}
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {chartData.map((entry: any, index: number) => (
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
                  <span className="text-lg md:text-2xl font-black">${(chartData.reduce((a:any, b:any) => a + b.value, 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 md:mt-8 space-y-3 md:space-y-4">
               {chartData.map((entry: any, index: number) => (
                 <div key={index} className="flex items-center justify-between p-3 md:p-4 bg-slate-800/50 rounded-xl md:rounded-2xl border border-slate-700/50">
                   <div className="flex items-center space-x-3">
                     <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full" style={{backgroundColor: PIE_COLORS[index]}}></div>
                     <span className="text-[10px] md:text-xs font-bold text-slate-300">{entry.name}</span>
                   </div>
                   <span className="font-black text-xs md:text-sm">${entry.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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