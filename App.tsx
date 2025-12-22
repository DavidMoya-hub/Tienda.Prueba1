
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Package, PlusCircle, History, 
  RefreshCcw, ClipboardCheck, Wallet, Store,
  Coins, List
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import ProductRegistration from './components/ProductRegistration';
import Restock from './components/Restock';
import DailyInventoryCount from './components/DailyInventoryCount';
import HistoryView from './components/HistoryView';
import EnvelopesManager from './components/EnvelopesManager';
import ProductsTable from './components/ProductsTable';
import { dataService } from './services/dataService';

const NavItem: React.FC<{ to: string, icon: React.ReactNode, label: string }> = ({ to, icon, label }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link 
      to={to} 
      className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
        isActive 
          ? 'bg-red-600 text-white shadow-lg shadow-red-200' 
          : 'text-blue-100 hover:bg-blue-700/50 hover:text-white'
      }`}
    >
      {icon}
      <span className="font-bold tracking-tight">{label}</span>
    </Link>
  );
};

const Sidebar: React.FC = () => (
  <aside className="w-64 bg-blue-900 border-r border-blue-800 flex flex-col h-screen sticky top-0 text-white shadow-2xl">
    <div className="p-8 border-b border-blue-800/50">
      <div className="flex items-center space-x-3">
        <div className="bg-red-600 p-2.5 rounded-2xl shadow-lg shadow-red-900/40">
          <Store className="text-white w-7 h-7" />
        </div>
        <h1 className="text-2xl font-black tracking-tighter text-white">tiendita</h1>
      </div>
    </div>
    <nav className="flex-1 p-5 space-y-2 overflow-y-auto custom-scrollbar">
      <NavItem to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" />
      <NavItem to="/products" icon={<List size={20} />} label="Productos" />
      <NavItem to="/count" icon={<ClipboardCheck size={20} />} label="Inventario Físico" />
      <NavItem to="/envelopes" icon={<Coins size={20} />} label="Sobres" />
      <NavItem to="/inventory" icon={<Package size={20} />} label="Inventario" />
      <NavItem to="/register" icon={<PlusCircle size={20} />} label="Nuevo Producto" />
      <NavItem to="/restock" icon={<RefreshCcw size={20} />} label="Resurtido" />
      <NavItem to="/history" icon={<History size={20} />} label="Historial" />
    </nav>
    <div className="p-5 border-t border-blue-800/50">
      <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest text-center">Version 2.0 SMART</p>
    </div>
  </aside>
);

const App: React.FC = () => {
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    dataService.fetchAll().then(() => setInitialLoaded(true));
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    await dataService.sync();
    setSyncing(false);
  };

  if (!initialLoaded) return (
    <div className="flex flex-col h-screen items-center justify-center bg-blue-900 font-black text-white space-y-4">
      <div className="bg-red-600 p-4 rounded-[2rem] animate-bounce shadow-2xl shadow-red-900">
        <Store size={48} />
      </div>
      <div className="text-3xl tracking-tighter">tiendita</div>
      <div className="text-blue-400 text-sm animate-pulse">Iniciando Bóveda Financiera...</div>
    </div>
  );

  return (
    <HashRouter>
      <div className="flex min-h-screen bg-slate-50/50">
        <Sidebar />
        <main className="flex-1">
          <header className="bg-white/80 backdrop-blur-md border-b border-blue-100 px-8 py-5 flex justify-between items-center sticky top-0 z-10 shadow-sm">
            <h2 className="text-xl font-black text-blue-900 tracking-tight">Panel de Control</h2>
            <button 
              onClick={handleSync} 
              disabled={syncing}
              className="flex items-center space-x-2 bg-red-50 text-red-600 px-5 py-2.5 rounded-xl hover:bg-red-100 transition-all font-bold border border-red-100 shadow-sm active:scale-95 disabled:opacity-50"
            >
              <RefreshCcw size={18} className={syncing ? 'animate-spin' : ''} />
              <span>{syncing ? 'Sincronizando...' : 'Sincronizar'}</span>
            </button>
          </header>
          <div className="p-8 max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/products" element={<ProductsTable />} />
              <Route path="/count" element={<DailyInventoryCount />} />
              <Route path="/envelopes" element={<EnvelopesManager />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/register" element={<ProductRegistration />} />
              <Route path="/restock" element={<Restock />} />
              <Route path="/history" element={<HistoryView />} />
            </Routes>
          </div>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;
