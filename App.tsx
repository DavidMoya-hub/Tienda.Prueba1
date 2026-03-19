
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Package, PlusCircle, History, 
  RefreshCcw, ClipboardCheck, Wallet, Store,
  Coins, List, Menu, X, Calculator
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import ProductRegistration from './components/ProductRegistration';
import Restock from './components/Restock';
import DailyInventoryCount from './components/DailyInventoryCount';
import HistoryView from './components/HistoryView';
import EnvelopesManager from './components/EnvelopesManager';
import DailyClosingView from './components/DailyClosingView';
import ProductsTable from './components/ProductsTable';
import { dataService } from './services/dataService';

const NavItem: React.FC<{ to: string, icon: React.ReactNode, label: string, onClick?: () => void }> = ({ to, icon, label, onClick }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link 
      to={to} 
      onClick={onClick}
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

const Sidebar: React.FC<{ isOpen: boolean, onClose: () => void }> = ({ isOpen, onClose }) => (
  <>
    {/* Overlay for mobile */}
    <div 
      className={`fixed inset-0 bg-blue-900/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      onClick={onClose}
    />
    
    <aside className={`fixed lg:sticky top-0 left-0 z-50 w-64 bg-blue-900 border-r border-blue-800 flex flex-col h-screen text-white shadow-2xl transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
      <div className="p-8 border-b border-blue-800/50 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="bg-red-600 p-2.5 rounded-2xl shadow-lg shadow-red-900/40">
            <Store className="text-white w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-white">tiendita</h1>
        </div>
        <button onClick={onClose} className="lg:hidden text-blue-100 hover:text-white">
          <X size={24} />
        </button>
      </div>
      <nav className="flex-1 p-5 space-y-2 overflow-y-auto custom-scrollbar">
        <NavItem to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" onClick={onClose} />
        <NavItem to="/products" icon={<List size={20} />} label="Productos" onClick={onClose} />
        <NavItem to="/closing" icon={<Calculator size={20} />} label="Corte de Caja" onClick={onClose} />
        <NavItem to="/count" icon={<ClipboardCheck size={20} />} label="Inventario Físico" onClick={onClose} />
        <NavItem to="/envelopes" icon={<Coins size={20} />} label="Sobres" onClick={onClose} />
        <NavItem to="/inventory" icon={<Package size={20} />} label="Inventario" onClick={onClose} />
        <NavItem to="/register" icon={<PlusCircle size={20} />} label="Nuevo Producto" onClick={onClose} />
        <NavItem to="/restock" icon={<RefreshCcw size={20} />} label="Resurtido" onClick={onClose} />
        <NavItem to="/history" icon={<History size={20} />} label="Historial" onClick={onClose} />
      </nav>
      <div className="p-5 border-t border-blue-800/50">
        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest text-center">Version 2.0 SMART</p>
      </div>
    </aside>
  </>
);

const App: React.FC = () => {
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    dataService.fetchAll()
      .then(() => setInitialLoaded(true))
      .catch(err => {
        setError(err instanceof Error ? err.message : String(err));
        setInitialLoaded(true);
      });
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

  if (error) return (
    <div className="flex flex-col h-screen items-center justify-center bg-blue-900 font-black text-white p-8 text-center space-y-6">
      <div className="bg-red-600 p-6 rounded-[2.5rem] shadow-2xl shadow-red-900">
        <X size={64} />
      </div>
      <div className="space-y-2">
        <div className="text-3xl tracking-tighter uppercase">Error de Servidor</div>
        <div className="text-blue-300 text-sm font-medium max-w-md mx-auto">{error}</div>
      </div>
      <button 
        onClick={() => window.location.reload()}
        className="bg-white text-blue-900 px-8 py-4 rounded-2xl font-black hover:bg-blue-50 transition-all active:scale-95 shadow-xl"
      >
        REINTENTAR CONEXIÓN
      </button>
    </div>
  );

  return (
    <HashRouter>
      <div className="flex min-h-screen bg-slate-50/50">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <main className="flex-1 min-w-0">
          <header className="bg-white/80 backdrop-blur-md border-b border-blue-100 px-4 md:px-8 py-4 md:py-5 flex justify-between items-center sticky top-0 z-30 shadow-sm">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-2 text-blue-900 hover:bg-blue-50 rounded-xl transition-colors"
              >
                <Menu size={24} />
              </button>
              <h2 className="text-lg md:text-xl font-black text-blue-900 tracking-tight">Panel de Control</h2>
            </div>
            <button 
              onClick={handleSync} 
              disabled={syncing}
              className="flex items-center space-x-2 bg-red-50 text-red-600 px-3 md:px-5 py-2 md:py-2.5 rounded-xl hover:bg-red-100 transition-all font-bold border border-red-100 shadow-sm active:scale-95 disabled:opacity-50"
            >
              <RefreshCcw size={18} className={syncing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{syncing ? 'Sincronizando...' : 'Sincronizar'}</span>
              <span className="sm:hidden">{syncing ? '' : ''}</span>
            </button>
          </header>
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/closing" element={<DailyClosingView />} />
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
