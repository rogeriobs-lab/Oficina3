import React, { useEffect, useState, useCallback } from 'react';
import { supabase, deleteServiceOrder } from '@/src/lib/supabase';
import { theme, formatDate, formatCurrency, normalizeForSearch } from '@/src/lib/theme';
import { computeOrderNumbers } from '@/src/lib/orderUtils';
import { LoadingState, ErrorState, EmptyState } from './States';
import { Plus, Search, ClipboardList, Gauge, Calendar, ChevronRight, ChevronLeft, X, Trash2, Loader2 } from 'lucide-react';

type OrderRow = {
  id: string;
  order_date: string;
  mileage: number | null;
  status: string;
  clients: { name: string };
  vehicles: { plate: string; brand: string; model: string; year: number | null };
  order_items: { price: number }[];
};

interface OrdersViewProps {
  onNavigate: (viewName: string, params?: any, currentViewSaveParams?: any) => void;
  params?: any;
}

export default function OrdersView({ onNavigate, params }: OrdersViewProps) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(params?.searchInput ?? params?.search ?? '');
  const [search, setSearch] = useState(params?.search ?? params?.searchInput ?? '');
  const [statusFilter, setStatusFilter] = useState<'todas' | 'aberta' | 'fechada'>(params?.statusFilter ?? 'todas');
  const [page, setPage] = useState(params?.page ?? 1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    if (params) {
      if (params.searchInput !== undefined) setSearchInput(params.searchInput);
      if (params.search !== undefined) setSearch(params.search);
      if (params.statusFilter !== undefined) setStatusFilter(params.statusFilter);
      if (params.page !== undefined) setPage(params.page);
    }
  }, [params]);

  // Debounce searchInput to search automatically
  useEffect(() => {
    const handler = setTimeout(() => {
      const trimmed = searchInput.trim();
      if (trimmed !== search) {
        setSearch(trimmed);
        setPage(1);
      }
    }, 100);
    return () => clearTimeout(handler);
  }, [searchInput, search]);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const from = (page - 1) * pageSize;
      const to = page * pageSize - 1;

      const sTerm = search.trim();
      const cleanTerm = sTerm.replace(/[,()]/g, '');
      const sAlpha = cleanTerm.replace(/[^A-Za-z0-9]/g, '');

      let matchingVehicleIds: string[] = [];
      let matchingClientIds: string[] = [];
      let isFiltering = false;

      if (cleanTerm) {
        isFiltering = true;

        const vPromises = [
          supabase.from('vehicles').select('id').ilike('plate', `%${cleanTerm}%`).limit(100),
          supabase.from('vehicles').select('id').ilike('brand', `%${cleanTerm}%`).limit(100),
          supabase.from('vehicles').select('id').ilike('model', `%${cleanTerm}%`).limit(100),
          supabase.from('vehicles').select('id').ilike('notes', `%${cleanTerm}%`).limit(100),
        ];

        if (sAlpha && sAlpha !== cleanTerm) {
          vPromises.push(supabase.from('vehicles').select('id').ilike('plate', `%${sAlpha}%`).limit(100));
        }

        const cPromises = [
          supabase.from('clients').select('id').ilike('name', `%${cleanTerm}%`).limit(100),
          supabase.from('clients').select('id').ilike('phone', `%${cleanTerm}%`).limit(100),
          supabase.from('clients').select('id').ilike('notes', `%${cleanTerm}%`).limit(100),
        ];

        const [vResponses, cResponses] = await Promise.all([
          Promise.all(vPromises),
          Promise.all(cPromises),
        ]);

        const vehIdsSet = new Set<string>();
        vResponses.forEach((res) => {
          if (!res.error && res.data) {
            res.data.forEach((v: any) => vehIdsSet.add(v.id));
          }
        });
        matchingVehicleIds = Array.from(vehIdsSet);

        const clientIdsSet = new Set<string>();
        cResponses.forEach((res) => {
          if (!res.error && res.data) {
            res.data.forEach((c: any) => clientIdsSet.add(c.id));
          }
        });
        matchingClientIds = Array.from(clientIdsSet);

        if (matchingVehicleIds.length === 0 && matchingClientIds.length === 0) {
          setOrders([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }
      }

      let rawData: any[] = [];
      let totalResCount = 0;

      // Try joined query first
      let query = supabase
        .from('service_orders')
        .select('id, order_date, mileage, status, client_id, vehicle_id, clients(name), vehicles(plate, brand, model, year)', { count: 'estimated' })
        .order('order_date', { ascending: false });

      if (statusFilter !== 'todas') {
        query = query.eq('status', statusFilter);
      }

      if (isFiltering) {
        if (matchingVehicleIds.length > 0 && matchingClientIds.length > 0) {
          query = query.or(`vehicle_id.in.(${matchingVehicleIds.join(',')}),client_id.in.(${matchingClientIds.join(',')})`);
        } else if (matchingVehicleIds.length > 0) {
          query = query.in('vehicle_id', matchingVehicleIds);
        } else if (matchingClientIds.length > 0) {
          query = query.in('client_id', matchingClientIds);
        }
      }

      const { data, error: primaryErr, count } = await query.range(from, to);

      if (!primaryErr && data) {
        rawData = data;
        totalResCount = count ?? 0;
      } else {
        console.warn('Primary query failed/timed out, using simplified fallback query:', primaryErr);
        // Fallback: simple query without joins to ensure fast execution
        let fallbackQ = supabase
          .from('service_orders')
          .select('id, order_date, mileage, status, client_id, vehicle_id', { count: 'estimated' })
          .order('order_date', { ascending: false });

        if (statusFilter !== 'todas') {
          fallbackQ = fallbackQ.eq('status', statusFilter);
        }

        if (isFiltering) {
          if (matchingVehicleIds.length > 0 && matchingClientIds.length > 0) {
            fallbackQ = fallbackQ.or(`vehicle_id.in.(${matchingVehicleIds.join(',')}),client_id.in.(${matchingClientIds.join(',')})`);
          } else if (matchingVehicleIds.length > 0) {
            fallbackQ = fallbackQ.in('vehicle_id', matchingVehicleIds);
          } else if (matchingClientIds.length > 0) {
            fallbackQ = fallbackQ.in('client_id', matchingClientIds);
          }
        }

        const { data: fbData, error: fbErr, count: fbCount } = await fallbackQ.range(from, to);
        if (fbErr) throw fbErr;
        rawData = fbData ?? [];
        totalResCount = fbCount ?? 0;

        // Fetch clients and vehicles manually for fallback
        if (rawData.length > 0) {
          const clientIds = Array.from(new Set(rawData.map((r: any) => r.client_id).filter(Boolean)));
          const vehicleIds = Array.from(new Set(rawData.map((r: any) => r.vehicle_id).filter(Boolean)));

          const [cRes, vRes] = await Promise.all([
            clientIds.length > 0 ? supabase.from('clients').select('id, name').in('id', clientIds) : { data: [] },
            vehicleIds.length > 0 ? supabase.from('vehicles').select('id, plate, brand, model, year').in('id', vehicleIds) : { data: [] },
          ]);

          const clientMap = new Map((cRes.data || []).map((c: any) => [c.id, c]));
          const vehicleMap = new Map((vRes.data || []).map((v: any) => [v.id, v]));

          rawData = rawData.map((r: any) => ({
            ...r,
            clients: clientMap.get(r.client_id) || { name: 'Não informado' },
            vehicles: vehicleMap.get(r.vehicle_id) || { plate: 'Sem placa', brand: '', model: '', year: null },
          }));
        }
      }

      // Now fetch prices for the loaded orders
      const orderIds = rawData.map((o: any) => o.id);
      const itemsMap = new Map<string, { price: number }[]>();

      if (orderIds.length > 0) {
        const { data: itemsData } = await supabase
          .from('order_items')
          .select('order_id, price')
          .in('order_id', orderIds);

        if (itemsData) {
          itemsData.forEach((item: any) => {
            if (!itemsMap.has(item.order_id)) itemsMap.set(item.order_id, []);
            itemsMap.get(item.order_id)!.push({ price: Number(item.price) || 0 });
          });
        }
      }

      const formattedOrders: OrderRow[] = rawData.map((o: any) => ({
        ...o,
        order_items: itemsMap.get(o.id) || [],
      }));

      setOrders(formattedOrders);

      if (totalResCount > 0) {
        setTotalCount(totalResCount);
      } else {
        let countQ = supabase.from('service_orders').select('id', { count: 'exact', head: true });
        if (statusFilter !== 'todas') countQ = countQ.eq('status', statusFilter);
        const { count: exactCount } = await countQ;
        setTotalCount(exactCount ?? formattedOrders.length);
      }
    } catch (err: any) {
      const msg = err?.message || err?.details || (typeof err === 'string' ? err : 'Erro ao carregar ordens de serviço');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleDeleteOrder = async (e: React.MouseEvent, order: OrderRow, orderNum: string) => {
    e.stopPropagation();
    if (
      !confirm(
        `ATENÇÃO: Deseja realmente excluir a Ordem de Serviço #${orderNum} (${order.vehicles?.plate || 'sem placa'})?`
      )
    ) {
      return;
    }
    setLoading(true);
    const res = await deleteServiceOrder(order.id);
    if (res.success) {
      loadOrders();
    } else {
      alert(res.message);
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const currentSearchTerm = searchInput.trim() || search.trim();
  const orderNumMap = computeOrderNumbers(orders);

  const filtered = orders.filter((o) => {
    const matchStatus = statusFilter === 'todas' || o.status === statusFilter;
    if (!matchStatus) return false;
    if (!currentSearchTerm) return true;

    const cleanS = normalizeForSearch(currentSearchTerm);
    const cleanSAlpha = cleanS.replace(/[^a-z0-9]/g, '');

    const clientNorm = normalizeForSearch(o.clients?.name);
    const plateNorm = normalizeForSearch(o.vehicles?.plate);
    const plateAlpha = plateNorm.replace(/[^a-z0-9]/g, '');
    const modelNorm = normalizeForSearch(o.vehicles?.model);
    const brandNorm = normalizeForSearch(o.vehicles?.brand);
    const idNorm = normalizeForSearch(o.id);
    const numNorm = normalizeForSearch(orderNumMap.get(o.id));

    const matchSearch =
      clientNorm.includes(cleanS) ||
      plateNorm.includes(cleanS) ||
      (cleanSAlpha.length > 0 && plateAlpha.includes(cleanSAlpha)) ||
      modelNorm.includes(cleanS) ||
      brandNorm.includes(cleanS) ||
      idNorm.includes(cleanS) ||
      numNorm.includes(cleanS);

    return matchSearch;
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  if (loading && orders.length === 0 && !currentSearchTerm) return <LoadingState />;
  if (error && orders.length === 0) return <ErrorState message={error} onRetry={loadOrders} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Serviços</h1>
          <p className="text-slate-500 mt-1">Histórico e controle de atendimentos e manutenções</p>
        </div>
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => onNavigate('order-new', undefined, { searchInput, search, statusFilter, page })}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-white text-xs sm:text-sm rounded-xl font-bold shadow-md hover:opacity-90 transition-all cursor-pointer"
            style={{ backgroundColor: theme.accent }}
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            Novo Serviço
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3.5">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquisar por placa, cliente ou modelo..."
              value={searchInput}
              onChange={(e) => {
                const val = e.target.value;
                setSearchInput(val);
                if (val === '' && search !== '') {
                  setSearch('');
                  setPage(1);
                }
              }}
              className="block w-full pl-11 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all outline-none"
            />
            {loading ? (
              <div className="absolute right-3 top-3.5 flex items-center gap-1">
                <Loader2 className="w-4 h-4 text-sky-500 animate-spin" />
              </div>
            ) : searchInput ? (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
                title="Limpar pesquisa"
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>
          <button
            type="submit"
            className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Buscar</span>
          </button>
        </form>

        {/* Filter Chips */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Filtrar por Status:</span>
            {(['todas', 'aberta', 'fechada'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  statusFilter === f
                    ? 'bg-slate-950 text-white border-slate-950 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {f === 'todas' ? 'Todos os Atendimentos' : f === 'aberta' ? 'Em Aberto' : 'Concluídos / Fechados'}
              </button>
            ))}
          </div>

          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            {filtered.length} serviço(s)
          </span>
        </div>
      </div>

      {/* Orders List */}
      {filtered.length === 0 ? (
        <EmptyState
          message={
            search || statusFilter !== 'todas'
              ? 'Nenhum serviço encontrado para os filtros selecionados'
              : 'Nenhum serviço cadastrado ainda. Clique em "Novo Serviço" para começar.'
          }
        />
      ) : (
        <div className="space-y-3.5">
          {(() => {
            const orderNumMap = computeOrderNumbers(orders);
            return filtered.map((order) => {
              const totalValue = (order.order_items ?? []).reduce((sum, item) => sum + Number(item.price), 0);
              const orderNum = orderNumMap.get(order.id) || order.id.slice(0, 8);
              const isOpen = order.status === 'aberta';

              return (
                <div
                  key={order.id}
                  onClick={() => onNavigate('order-details', { id: order.id }, { searchInput, search, statusFilter, page })}
                  className="group bg-white border border-slate-200/80 rounded-2xl p-5 hover:shadow-md hover:border-sky-300/80 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100/80 shrink-0 group-hover:scale-105 transition-transform">
                      <ClipboardList className="w-6 h-6" />
                    </div>

                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono text-xs font-bold text-sky-800 bg-sky-50 border border-sky-200/80 px-2.5 py-0.5 rounded-lg shadow-2xs">
                          #{orderNum}
                        </span>
                        <h3 className="font-bold text-base text-slate-900 group-hover:text-sky-700 transition-colors leading-tight truncate">
                          {order.clients?.name ?? 'Cliente não informado'}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                            isOpen
                              ? 'bg-amber-100/90 text-amber-900 border border-amber-200'
                              : 'bg-emerald-100/90 text-emerald-900 border border-emerald-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                          {isOpen ? 'Em Aberto' : 'Concluído'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-medium text-slate-600 flex-wrap">
                        <span>
                          {order.vehicles?.brand} {order.vehicles?.model}
                          {order.vehicles?.year ? ` (${order.vehicles.year})` : ''}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="font-mono font-bold uppercase text-[11px] bg-slate-900 text-white px-2 py-0.5 rounded-md tracking-wider">
                          {order.vehicles?.plate ?? '—'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-xs text-slate-400 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>Data: {formatDate(order.order_date)}</span>
                        </div>
                        {order.mileage != null && (
                          <div className="flex items-center gap-1.5">
                            <Gauge className="w-3.5 h-3.5 text-slate-400" />
                            <span>{order.mileage.toLocaleString('pt-BR')} km</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 border-slate-100 pt-3 md:pt-0 shrink-0">
                    <div className="md:text-right">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Valor Total</p>
                      <p className="text-xl font-black text-slate-950 mt-0.5">
                        {formatCurrency(totalValue)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteOrder(e, order, orderNum)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                      title="Excluir Ordem de Serviço"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-transform hidden md:block" />
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">
            Exibindo página <strong className="text-slate-800">{page}</strong> de <strong className="text-slate-800">{totalPages}</strong> ({totalCount} serviços no total)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>
            <span className="text-xs font-bold px-2 text-slate-600">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>Próxima</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
