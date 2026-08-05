import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/src/lib/supabase';
import { theme, formatDate, formatCurrency } from '@/src/lib/theme';
import { computeOrderNumbers } from '@/src/lib/orderUtils';
import { LoadingState, ErrorState } from './States';
import {
  Users,
  Car,
  ClipboardList,
  Wrench,
  RefreshCw,
  ChevronRight,
  Plus,
  FileSpreadsheet,
  Calendar,
  Clock,
  Sparkles,
  ArrowUpRight,
  Activity,
  ShieldCheck,
} from 'lucide-react';
import workshopHeroImg from '../assets/images/workshop_hero_banner_1784844589037.jpg';

type Stats = {
  clientCount: number;
  vehicleCount: number;
  orderCount: number;
  openOrders: number;
};

type RecentOrder = {
  id: string;
  order_date: string;
  status: string;
  clients: { name: string };
  vehicles: { plate: string; brand: string; model: string };
  order_items: { price: number }[];
};

interface DashboardViewProps {
  onNavigate: (viewName: string, params?: any) => void;
}

export default function DashboardView({ onNavigate }: DashboardViewProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setError(null);

      // Helper for exact up-to-date counts
      const getCount = async (table: string, statusFilter?: string) => {
        try {
          let qExact = supabase.from(table as any).select('*', { count: 'exact', head: true });
          if (statusFilter) qExact = qExact.eq('status', statusFilter);
          const resExact = await qExact;
          if (resExact.count !== null && resExact.count !== undefined) {
            return resExact.count;
          }

          // Fallback to array length if count is null
          let qData = supabase.from(table as any).select('id');
          if (statusFilter) qData = qData.eq('status', statusFilter);
          const resData = await qData;
          return resData.data?.length ?? 0;
        } catch {
          return 0;
        }
      };

      const [cCount, vCount, oCount, openCount, recentOrdersRes] = await Promise.all([
        getCount('clients'),
        getCount('vehicles'),
        getCount('service_orders'),
        getCount('service_orders', 'aberta'),
        supabase
          .from('service_orders')
          .select('id, order_date, status, client_id, vehicle_id, clients(name), vehicles(plate, brand, model)')
          .order('order_date', { ascending: false })
          .limit(10),
      ]);

      setStats({
        clientCount: cCount,
        vehicleCount: vCount,
        orderCount: oCount,
        openOrders: openCount,
      });

      let rawRecent: any[] = recentOrdersRes.data ?? [];

      if (recentOrdersRes.error || rawRecent.length === 0) {
        if (recentOrdersRes.error) console.warn('Erro ao buscar ordens recentes com joins:', recentOrdersRes.error);
        const simpleRes = await supabase
          .from('service_orders')
          .select('id, order_date, status, client_id, vehicle_id')
          .order('order_date', { ascending: false })
          .limit(10);
        if (!simpleRes.error && simpleRes.data) {
          rawRecent = simpleRes.data;
        }
      }

      if (rawRecent.length > 0) {
        const orderIds = rawRecent.map((o: any) => o.id);
        const { data: itemsData } = await supabase
          .from('order_items')
          .select('order_id, price')
          .in('order_id', orderIds);

        const itemsMap = new Map<string, { price: number }[]>();
        (itemsData || []).forEach((item: any) => {
          if (!itemsMap.has(item.order_id)) itemsMap.set(item.order_id, []);
          itemsMap.get(item.order_id)!.push({ price: Number(item.price) || 0 });
        });

        const formattedRecent = rawRecent.map((o: any) => ({
          ...o,
          order_items: itemsMap.get(o.id) || [],
        }));

        setRecentOrders(formattedRecent as unknown as RecentOrder[]);
      } else {
        setRecentOrders([]);
      }
    } catch (err: any) {
      const msg = err?.message || err?.details || (typeof err === 'string' ? err : 'Erro ao consultar o banco de dados Supabase');
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  const todayFormatted = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Visual Workshop Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl border border-slate-800">
        <img
          src={workshopHeroImg}
          alt="Oficina Automotiva"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-35 filter brightness-90 saturate-125"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-900/40" />

        <div className="relative z-10 p-5 sm:p-8 md:p-10 flex flex-col gap-5 sm:gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white pt-1">
                Painel da Oficina
              </h1>
              <p className="text-slate-300 text-xs sm:text-sm font-medium capitalize flex items-center gap-2 pt-0.5">
                <Calendar className="w-3.5 h-3.5 text-sky-400" />
                {todayFormatted}
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900/80 hover:bg-slate-800 text-slate-200 text-xs font-bold rounded-xl border border-slate-700/80 backdrop-blur-md transition-all cursor-pointer hover:text-white shrink-0 self-start sm:self-auto disabled:opacity-50"
              title="Atualizar dados do painel"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Atualizando...' : 'Atualizar'}</span>
            </button>
          </div>

          {/* Quick Action Shortcuts */}
          <div className="flex items-center gap-1.5 sm:gap-3 pt-2 w-full overflow-x-auto pb-2 -mb-2 scrollbar-hide sm:overflow-visible">
            <button
              onClick={() => onNavigate('order-new')}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] sm:text-sm font-black rounded-xl transition-all shadow-lg shadow-amber-500/20 cursor-pointer hover:scale-[1.02] active:scale-95 shrink-0"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Novo Serviço</span>
            </button>

            <button
              onClick={() => onNavigate('clients')}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 sm:py-2.5 bg-slate-900/80 hover:bg-slate-800 text-slate-200 text-[11px] sm:text-sm font-bold rounded-xl border border-slate-700/80 backdrop-blur-md transition-all cursor-pointer hover:text-white shrink-0"
            >
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400" />
              <span>Clientes</span>
            </button>

            <button
              onClick={() => onNavigate('vehicles')}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 sm:py-2.5 bg-slate-900/80 hover:bg-slate-800 text-slate-200 text-[11px] sm:text-sm font-bold rounded-xl border border-slate-700/80 backdrop-blur-md transition-all cursor-pointer hover:text-white shrink-0"
            >
              <Car className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
              <span>Veículos</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {/* Clients Card */}
        <div
          onClick={() => onNavigate('clients')}
          className="group relative overflow-hidden bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-3 hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Clientes</span>
            <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 group-hover:scale-110 transition-transform">
              <Users className="w-4.5 h-4.5" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {stats?.clientCount ?? 0}
            </h3>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5 flex items-center gap-1">
              <span>Cadastrados no sistema</span>
            </p>
          </div>
        </div>

        {/* Vehicles Card */}
        <div
          onClick={() => onNavigate('vehicles')}
          className="group relative overflow-hidden bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-3 hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Veículos</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
              <Car className="w-4.5 h-4.5" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {stats?.vehicleCount ?? 0}
            </h3>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5 flex items-center gap-1">
              <span>Frota vinculada</span>
            </p>
          </div>
        </div>

        {/* Total Services Card */}
        <div
          onClick={() => onNavigate('orders')}
          className="group relative overflow-hidden bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-3 hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Serviços</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
              <ClipboardList className="w-4.5 h-4.5" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {stats?.orderCount ?? 0}
            </h3>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5 flex items-center gap-1">
              <span>Atendimentos registrados</span>
            </p>
          </div>
        </div>

        {/* Open Services Card */}
        <div
          onClick={() => onNavigate('orders')}
          className="group relative overflow-hidden bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-3 hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Em Aberto</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
              <Wrench className="w-4.5 h-4.5" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl sm:text-3xl font-black text-amber-600 tracking-tight">
              {stats?.openOrders ?? 0}
            </h3>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5 flex items-center gap-1">
              <span>Serviços pendentes</span>
            </p>
          </div>
        </div>
      </div>

      {/* Recent Orders Feed Section */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 sm:p-7 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-50 text-sky-700 rounded-xl border border-sky-100">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">Serviços Recentes</h2>
              <p className="text-xs text-slate-500">Últimos atendimentos cadastrados na oficina</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('orders')}
            className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-sky-600 hover:text-sky-700 hover:underline cursor-pointer"
          >
            <span>Ver todos</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        {recentOrders.length === 0 ? (
          <div className="text-center py-10 bg-slate-50/80 rounded-2xl border border-dashed border-slate-200 space-y-2">
            <ClipboardList className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-slate-600 font-bold text-sm">Nenhum serviço cadastrado ainda</p>
            <p className="text-slate-400 text-xs max-w-sm mx-auto">
              Abra um novo serviço para iniciar o controle de manutenções e peças da sua oficina.
            </p>
            <button
              onClick={() => onNavigate('order-new')}
              className="inline-flex items-center gap-2 mt-2 px-4 py-2 bg-amber-500 text-slate-950 text-xs font-black rounded-xl shadow-md cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Cadastrar Primeiro Serviço</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {(() => {
              const orderNumMap = computeOrderNumbers(recentOrders);
              return recentOrders.map((order) => {
                const totalValue = (order.order_items ?? []).reduce((sum, item) => sum + Number(item.price), 0);
                const orderNum = orderNumMap.get(order.id) || order.id.slice(0, 8);
                const isOpen = order.status === 'aberta';

                return (
                  <div
                    key={order.id}
                    onClick={() => onNavigate('order-details', { id: order.id })}
                    className="flex flex-col sm:flex-row sm:items-center justify-between py-3.5 sm:py-4 first:pt-0 last:pb-0 hover:bg-slate-50/80 -mx-3 px-3 sm:-mx-5 sm:px-5 rounded-xl transition-all cursor-pointer gap-3 group"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono text-xs font-bold text-sky-800 bg-sky-50 border border-sky-200/70 px-2.5 py-0.5 rounded-lg shadow-2xs">
                          #{orderNum}
                        </span>
                        <h4 className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-sky-700 transition-colors">
                          {order.clients?.name ?? 'Cliente sem nome'}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-600 font-medium flex-wrap">
                        <span>
                          {order.vehicles?.brand} {order.vehicles?.model}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="font-mono font-bold uppercase text-[11px] bg-slate-900 text-white px-2 py-0.5 rounded-md tracking-wider">
                          {order.vehicles?.plate ?? '—'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>Data de abertura: {formatDate(order.order_date)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 border-slate-100 pt-2 sm:pt-0">
                      <div className="text-left sm:text-right">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total</p>
                        <p className="text-base sm:text-lg font-black text-slate-900">
                          {formatCurrency(totalValue)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold ${
                            isOpen
                              ? 'bg-amber-100/90 text-amber-900 border border-amber-200'
                              : 'bg-emerald-100/90 text-emerald-900 border border-emerald-200'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isOpen ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'
                            }`}
                          />
                          {isOpen ? 'Em Aberto' : 'Concluído'}
                        </span>

                        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-transform hidden sm:block" />
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

