import { useState } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import LoginView from './components/LoginView';
import DashboardView from './components/DashboardView';
import ClientsView from './components/ClientsView';
import VehiclesView from './components/VehiclesView';
import OrdersView from './components/OrdersView';
import OrderDetailView from './components/OrderDetailView';
import OrderNewView from './components/OrderNewView';
import ImportView from './components/ImportView';
import SettingsView from './components/SettingsView';
import { theme } from './lib/theme';
import {
  Wrench,
  LayoutDashboard,
  Users,
  Car,
  ClipboardList,
  LogOut,
  Loader2,
  FileSpreadsheet,
  Settings,
} from 'lucide-react';

type ViewState = {
  name: string;
  params?: any;
};

function MainApp() {
  const { user, loading, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<ViewState>({ name: 'dashboard' });
  const [history, setHistory] = useState<ViewState[]>([]);
  const [savedViewParams, setSavedViewParams] = useState<Record<string, any>>({});

  const saveViewParams = (viewName: string, params: any) => {
    if (!params) return;
    setSavedViewParams((prev) => ({
      ...prev,
      [viewName]: params,
    }));
  };

  const navigateTo = (viewName: string, params?: any, currentViewSaveParams?: any) => {
    if (currentViewSaveParams) {
      saveViewParams(currentView.name, currentViewSaveParams);
    }

    if (params) {
      saveViewParams(viewName, params);
    }

    const targetParams = params ?? (viewName !== currentView.name ? savedViewParams[viewName] : undefined);

    setCurrentView((prev) => {
      const updatedPrev = currentViewSaveParams
        ? { ...prev, params: currentViewSaveParams }
        : prev;

      // Avoid pushing duplicate consecutive state to history
      if (updatedPrev.name !== viewName || JSON.stringify(updatedPrev.params) !== JSON.stringify(targetParams)) {
        setHistory((h) => [...h, updatedPrev]);
      }
      return { name: viewName, params: targetParams };
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    if (history.length > 0) {
      const previous = history[history.length - 1];
      setHistory((h) => h.slice(0, h.length - 1));
      setCurrentView(previous);
    } else {
      setCurrentView({ name: 'dashboard' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="w-12 h-12 animate-spin text-sky-600 mb-4" />
        <h3 className="text-slate-800 font-bold">Iniciando OficinaPro...</h3>
        <p className="text-slate-400 text-sm mt-1">Carregando ambiente de trabalho seguro</p>
      </div>
    );
  }

  // If user is not authenticated, render Login view
  if (!user) {
    return <LoginView />;
  }

  const renderActiveView = () => {
    switch (currentView.name) {
      case 'dashboard':
        return <DashboardView onNavigate={navigateTo} />;
      case 'clients':
        return (
          <ClientsView
            onNavigate={navigateTo}
            params={currentView.params ?? savedViewParams['clients']}
          />
        );
      case 'vehicles':
        return (
          <VehiclesView
            onNavigate={navigateTo}
            params={currentView.params ?? savedViewParams['vehicles']}
          />
        );
      case 'orders':
        return (
          <OrdersView
            onNavigate={navigateTo}
            params={currentView.params ?? savedViewParams['orders']}
          />
        );
      case 'import':
        return <ImportView />;
      case 'settings':
        return <SettingsView />;
      case 'order-details':
        return (
          <OrderDetailView
            orderId={currentView.params?.id}
            onBack={goBack}
            onNavigate={navigateTo}
          />
        );
      case 'order-new':
        return (
          <OrderNewView
            onBack={goBack}
            onNavigateToOrderDetails={(id) => navigateTo('order-details', { id })}
            preselectedVehicleId={currentView.params?.vehicleId}
          />
        );
      default:
        return <DashboardView onNavigate={navigateTo} />;
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Painel', shortLabel: 'Painel', icon: LayoutDashboard, color: theme.primary },
    { id: 'clients', label: 'Clientes', shortLabel: 'Clientes', icon: Users, color: theme.primary },
    { id: 'vehicles', label: 'Veículos', shortLabel: 'Veículos', icon: Car, color: theme.secondary },
    { id: 'orders', label: 'Serviços', shortLabel: 'Serviços', icon: ClipboardList, color: theme.accent },
    { id: 'settings', label: 'Configurações', shortLabel: 'Ajustes', icon: Settings, color: theme.primary },
  ];

  return (
    <div className="flex h-screen bg-slate-50/70 overflow-hidden font-sans">
      {/* SIDEBAR FOR DESKTOP */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-slate-950 text-slate-300 border-r border-slate-800/80 shrink-0 shadow-xl">
        {/* Brand Header */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-amber-500 text-white shadow-md shadow-sky-500/20">
              <Wrench className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <span className="text-lg font-black text-white tracking-tight leading-none block">OficinaPro</span>
              <span className="text-[10px] font-semibold text-slate-400 tracking-wide uppercase">Gestão Automotiva</span>
            </div>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500" title="Sistema Online" />
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <p className="px-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">Navegação Principal</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              currentView.name === item.id ||
              (item.id === 'orders' && ['order-details', 'order-new'].includes(currentView.name));

            return (
              <button
                key={item.id}
                onClick={() => navigateTo(item.id)}
                className={`flex items-center justify-between w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all cursor-pointer group ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-sky-400'}`} />
                  <span>{item.label}</span>
                </div>
                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
              </button>
            );
          })}
        </nav>

        {/* User Stats / Signout */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/50 space-y-3">
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="w-8 h-8 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-300 font-extrabold text-xs flex items-center justify-center shrink-0">
              {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">Mecânico / Operador</p>
              <p className="text-xs text-slate-200 font-bold truncate">{user.email}</p>
            </div>
          </div>

          <button
            onClick={signOut}
            className="flex items-center gap-2 w-full px-3.5 py-2.5 text-xs font-bold text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer border border-transparent hover:border-red-500/20"
          >
            <LogOut className="w-4 h-4" />
            Sair da Sessão
          </button>
        </div>
      </aside>

      {/* CORE FRAMEWORK CONTROLLER */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* MOBILE HEADER */}
        <header className="lg:hidden h-16 bg-slate-950 border-b border-slate-800 px-5 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sky-500 text-slate-950 font-black">
              <Wrench className="w-4 h-4" />
            </div>
            <span className="text-base font-black text-white tracking-tight">OficinaPro</span>
          </div>
          <button
            onClick={signOut}
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-red-400 transition-all cursor-pointer"
            title="Sair"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </header>

        {/* MAIN DISPLAY AREA */}
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:p-8 md:p-10 pb-24 lg:pb-10 max-w-7xl mx-auto w-full">
          <div className="animate-fade-in">{renderActiveView()}</div>
        </main>

        {/* BOTTOM NAV BAR FOR MOBILE */}
        <nav
          className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 flex items-center justify-around px-1 py-1 shadow-2xl z-40 notranslate"
          translate="no"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              currentView.name === item.id ||
              (item.id === 'orders' && ['order-details', 'order-new'].includes(currentView.name));

            return (
              <button
                key={item.id}
                onClick={() => navigateTo(item.id)}
                className={`flex flex-col items-center justify-center flex-1 min-w-0 h-12 px-0.5 rounded-xl transition-all cursor-pointer ${
                  isActive ? 'text-sky-400 font-extrabold scale-105' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="text-[10px] mt-0.5 truncate w-full text-center leading-none whitespace-nowrap">
                  {item.shortLabel || item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
