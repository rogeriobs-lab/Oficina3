import React, { useState, useEffect, useCallback } from 'react';
import {
  deleteClientAndAssociations,
  deleteVehicleAndAssociations,
  deleteServiceOrder,
  fetchAllClientsAllPages,
  fetchAllVehiclesAllPages,
  supabase,
} from '../lib/supabase';
import { normalizeForSearch } from '../lib/theme';
import {
  User,
  Car,
  Wrench,
  Search,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Info,
  Calendar,
  DollarSign,
  FileText,
} from 'lucide-react';

type TabType = 'client' | 'vehicle' | 'service';

interface ClientItem {
  id: string;
  name: string;
  phone: string | null;
}

interface VehicleItem {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number | null;
  client_id: string | null;
  client_name?: string;
}

interface ServiceOrderItem {
  id: string;
  order_date: string;
  total_cost: number;
  status: string;
  client_name?: string;
  vehicle_plate?: string;
  vehicle_info?: string;
}

export default function RecordDeletionManager() {
  const [activeTab, setActiveTab] = useState<TabType>('client');

  // Loading states
  const [loadingData, setLoadingData] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Search queries
  const [clientSearch, setClientSearch] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');

  // Loaded raw lists
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrderItem[]>([]);

  // Selected items for deletion
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');

  // Related stats for preview
  const [clientVehiclesCount, setClientVehiclesCount] = useState<number>(0);
  const [clientVehiclesList, setClientVehiclesList] = useState<string[]>([]);
  const [clientOrdersCount, setClientOrdersCount] = useState<number>(0);

  const [vehicleOrdersCount, setVehicleOrdersCount] = useState<number>(0);
  const [vehicleOrdersTotal, setVehicleOrdersTotal] = useState<number>(0);

  const [serviceItemsCount, setServiceItemsCount] = useState<number>(0);

  // Fetch initial lists
  const loadAllData = useCallback(async () => {
    setLoadingData(true);
    try {
      // Fetch Clients
      const clientData = await fetchAllClientsAllPages();
      setClients(clientData || []);

      // Fetch Vehicles
      const vehData = await fetchAllVehiclesAllPages();

      const mappedVehicles: VehicleItem[] = (vehData || []).map((v: any) => {
        let cName = 'Sem proprietário';
        if (v.clients) {
          const cObj = Array.isArray(v.clients) ? v.clients[0] : v.clients;
          if (cObj?.name && cObj.name.trim() !== '' && cObj.name !== '-') {
            cName = cObj.name;
          }
        }
        return {
          id: v.id,
          plate: v.plate,
          brand: v.brand,
          model: v.model,
          year: v.year,
          client_id: v.client_id,
          client_name: cName,
        };
      });
      setVehicles(mappedVehicles);

      // Fetch Service Orders
      const { data: orderData } = await supabase
        .from('service_orders')
        .select('id, order_date, total_cost, status, clients(name), vehicles(plate, brand, model)')
        .order('order_date', { ascending: false });

      const mappedOrders: ServiceOrderItem[] = (orderData || []).map((o: any) => {
        const cObj = Array.isArray(o.clients) ? o.clients[0] : o.clients;
        const vObj = Array.isArray(o.vehicles) ? o.vehicles[0] : o.vehicles;
        return {
          id: o.id,
          order_date: o.order_date,
          total_cost: Number(o.total_cost || 0),
          status: o.status || 'Pendente',
          client_name: cObj?.name || 'Cliente desconhecido',
          vehicle_plate: vObj?.plate || 'Sem placa',
          vehicle_info: vObj ? `${vObj.brand || ''} ${vObj.model || ''}`.trim() : '',
        };
      });
      setServiceOrders(mappedOrders);
    } catch (err) {
      console.error('Erro ao carregar registros para exclusão:', err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // When client selection changes, preview details
  useEffect(() => {
    if (!selectedClientId) {
      setClientVehiclesCount(0);
      setClientVehiclesList([]);
      setClientOrdersCount(0);
      return;
    }

    const fetchClientAssociations = async () => {
      // Vehicles
      const { data: vData } = await supabase
        .from('vehicles')
        .select('id, plate, brand, model')
        .eq('client_id', selectedClientId);

      const vList = vData || [];
      setClientVehiclesCount(vList.length);
      setClientVehiclesList(vList.map((v: any) => `${v.plate} (${v.brand} ${v.model})`));

      const vIds = vList.map((v: any) => v.id);

      // Service orders
      const { data: oDataByClient } = await supabase
        .from('service_orders')
        .select('id')
        .eq('client_id', selectedClientId);

      let vOrders: any[] = [];
      if (vIds.length > 0) {
        const { data: oDataByVeh } = await supabase
          .from('service_orders')
          .select('id')
          .in('vehicle_id', vIds);
        vOrders = oDataByVeh || [];
      }

      const allUniqueOrderIds = new Set([
        ...(oDataByClient || []).map((o: any) => o.id),
        ...vOrders.map((o: any) => o.id),
      ]);
      setClientOrdersCount(allUniqueOrderIds.size);
    };

    fetchClientAssociations();
  }, [selectedClientId]);

  // When vehicle selection changes, preview details
  useEffect(() => {
    if (!selectedVehicleId) {
      setVehicleOrdersCount(0);
      setVehicleOrdersTotal(0);
      return;
    }

    const fetchVehicleAssociations = async () => {
      const { data: oData } = await supabase
        .from('service_orders')
        .select('id, total_cost')
        .eq('vehicle_id', selectedVehicleId);

      const list = oData || [];
      setVehicleOrdersCount(list.length);
      const total = list.reduce((acc: number, curr: any) => acc + Number(curr.total_cost || 0), 0);
      setVehicleOrdersTotal(total);
    };

    fetchVehicleAssociations();
  }, [selectedVehicleId]);

  // When service order selection changes, preview details
  useEffect(() => {
    if (!selectedServiceId) {
      setServiceItemsCount(0);
      return;
    }

    const fetchOrderDetails = async () => {
      const { data: items } = await supabase
        .from('order_items')
        .select('id')
        .eq('order_id', selectedServiceId);

      setServiceItemsCount(items?.length || 0);
    };

    fetchOrderDetails();
  }, [selectedServiceId]);

  // Handlers for deletion
  const handleDeleteClient = async () => {
    const client = clients.find((c) => c.id === selectedClientId);
    if (!client) return;

    if (
      !confirm(
        `ATENÇÃO: Deseja realmente excluir o cliente "${client.name}"?\n\nIsso removerá também todos os ${clientVehiclesCount} veículo(s) e ${clientOrdersCount} serviço(s) vinculados a este cliente!`
      )
    ) {
      return;
    }

    setDeleting(true);
    setActionSuccess(null);
    setActionError(null);

    const res = await deleteClientAndAssociations(client.id);
    setDeleting(false);

    if (res.success) {
      setActionSuccess(res.message);
      setSelectedClientId('');
      loadAllData();
    } else {
      setActionError(res.message);
    }
  };

  const handleDeleteVehicle = async () => {
    const veh = vehicles.find((v) => v.id === selectedVehicleId);
    if (!veh) return;

    if (
      !confirm(
        `ATENÇÃO: Deseja realmente excluir o veículo "${veh.plate} - ${veh.brand} ${veh.model}"?\n\nIsso removerá também todas as ${vehicleOrdersCount} ordem(ns) de serviço vinculadas a este veículo!`
      )
    ) {
      return;
    }

    setDeleting(true);
    setActionSuccess(null);
    setActionError(null);

    const res = await deleteVehicleAndAssociations(veh.id);
    setDeleting(false);

    if (res.success) {
      setActionSuccess(res.message);
      setSelectedVehicleId('');
      loadAllData();
    } else {
      setActionError(res.message);
    }
  };

  const handleDeleteServiceOrder = async () => {
    const order = serviceOrders.find((s) => s.id === selectedServiceId);
    if (!order) return;

    if (
      !confirm(
        `ATENÇÃO: Deseja realmente excluir a Ordem de Serviço #${order.id.slice(-6).toUpperCase()} (${order.vehicle_plate})?`
      )
    ) {
      return;
    }

    setDeleting(true);
    setActionSuccess(null);
    setActionError(null);

    const res = await deleteServiceOrder(order.id);
    setDeleting(false);

    if (res.success) {
      setActionSuccess(res.message);
      setSelectedServiceId('');
      loadAllData();
    } else {
      setActionError(res.message);
    }
  };

  // Filtered lists for dropdowns
  const filteredClients = clients.filter((c) => {
    const query = normalizeForSearch(clientSearch);
    if (!query) return true;
    return normalizeForSearch(c.name).includes(query) || (c.phone && normalizeForSearch(c.phone).includes(query));
  });

  const filteredVehicles = vehicles.filter((v) => {
    const query = normalizeForSearch(vehicleSearch);
    if (!query) return true;
    return (
      normalizeForSearch(v.plate).includes(query) ||
      normalizeForSearch(v.brand).includes(query) ||
      normalizeForSearch(v.model).includes(query) ||
      (v.client_name && normalizeForSearch(v.client_name).includes(query))
    );
  });

  const filteredServices = serviceOrders.filter((s) => {
    const query = normalizeForSearch(serviceSearch);
    if (!query) return true;
    return (
      normalizeForSearch(s.id).includes(query) ||
      (s.client_name && normalizeForSearch(s.client_name).includes(query)) ||
      (s.vehicle_plate && normalizeForSearch(s.vehicle_plate).includes(query)) ||
      (s.vehicle_info && normalizeForSearch(s.vehicle_info).includes(query))
    );
  });

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const selectedService = serviceOrders.find((s) => s.id === selectedServiceId);

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-50 text-red-600 border border-red-100">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">
              Remoção Específica de Registros
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Exclua individualmente um cliente (com seus veículos e serviços), um veículo (com seus serviços) ou apenas um determinado serviço.
            </p>
          </div>
        </div>

        {loadingData && (
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-600 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-100 self-start sm:self-auto">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Atualizando lista de registros...</span>
          </div>
        )}
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Sub-tabs selector */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200/80">
        <button
          type="button"
          onClick={() => {
            setActiveTab('client');
            setActionSuccess(null);
            setActionError(null);
          }}
          className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'client'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <User className="w-4 h-4 text-sky-600" />
          <span>Remover Cliente</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('vehicle');
            setActionSuccess(null);
            setActionError(null);
          }}
          className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'vehicle'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Car className="w-4 h-4 text-amber-600" />
          <span>Remover Veículo</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('service');
            setActionSuccess(null);
            setActionError(null);
          }}
          className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'service'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Wrench className="w-4 h-4 text-emerald-600" />
          <span>Remover Serviço (O.S.)</span>
        </button>
      </div>

      {/* TAB 1: REMOVE CLIENT */}
      {activeTab === 'client' && (
        <div className="space-y-5 pt-1">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              1. Buscar e Selecionar o Cliente
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Filtrar cliente por nome ou telefone..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all outline-none"
              />
            </div>

            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
            >
              <option value="">-- Selecione o cliente para excluir --</option>
              {filteredClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedClient ? (
            <div className="p-5 bg-rose-50/70 border border-rose-200/90 rounded-2xl space-y-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-extrabold text-rose-950">
                    Confirmação de exclusão do cliente: {selectedClient.name}
                  </h4>
                  <p className="text-xs text-rose-800 leading-relaxed">
                    A exclusão deste cliente apagará automaticamente todos os registros associados no banco de dados para manter a consistência.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white p-4 rounded-xl border border-rose-200">
                <div className="space-y-1">
                  <span className="text-slate-500 font-semibold block text-[11px]">Veículos associados a serem apagados:</span>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Car className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{clientVehiclesCount} veículo(s)</span>
                  </div>
                  {clientVehiclesList.length > 0 && (
                    <p className="text-[11px] text-slate-600 truncate pt-0.5 font-medium">
                      Placas: {clientVehiclesList.join(', ')}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="text-slate-500 font-semibold block text-[11px]">Ordens de Serviço a serem apagadas:</span>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>{clientOrdersCount} serviço(s)/O.S.</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDeleteClient}
                disabled={deleting}
                className="w-full py-3 px-5 bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>{deleting ? 'Excluindo Cliente...' : 'Excluir Cliente e Todos os Veículos e Serviços Vinculados'}</span>
              </button>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500 flex items-center gap-2">
              <Info className="w-4 h-4 text-sky-500 shrink-0" />
              <span>Selecione um cliente acima para visualizar o impacto da exclusão e confirmar.</span>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: REMOVE VEHICLE */}
      {activeTab === 'vehicle' && (
        <div className="space-y-5 pt-1">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              1. Buscar e Selecionar o Veículo
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Filtrar por placa, modelo, marca ou proprietário..."
                value={vehicleSearch}
                onChange={(e) => setVehicleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all outline-none"
              />
            </div>

            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
            >
              <option value="">-- Selecione o veículo para excluir --</option>
              {filteredVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate} - {v.brand} {v.model} {v.year ? `(${v.year})` : ''} - Proprietário: {v.client_name}
                </option>
              ))}
            </select>
          </div>

          {selectedVehicle ? (
            <div className="p-5 bg-rose-50/70 border border-rose-200/90 rounded-2xl space-y-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-extrabold text-rose-950">
                    Confirmação de exclusão do veículo: {selectedVehicle.plate} ({selectedVehicle.brand} {selectedVehicle.model})
                  </h4>
                  <p className="text-xs text-rose-800 leading-relaxed">
                    Proprietário associado: <strong>{selectedVehicle.client_name}</strong>. Ao excluir este veículo, o cliente permanecerá no sistema, mas os serviços deste veículo serão removidos.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-white rounded-xl border border-rose-200 text-xs space-y-2">
                <span className="text-slate-500 font-semibold block text-[11px]">Ordens de Serviço associadas que serão apagadas:</span>
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>{vehicleOrdersCount} ordem(ns) de serviço</span>
                  </div>
                  <div className="font-bold text-slate-700">
                    Total em serviços: <span className="text-emerald-700">R$ {vehicleOrdersTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDeleteVehicle}
                disabled={deleting}
                className="w-full py-3 px-5 bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>{deleting ? 'Excluindo Veículo...' : 'Excluir Veículo e Serviços Vinculados'}</span>
              </button>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500 flex items-center gap-2">
              <Info className="w-4 h-4 text-sky-500 shrink-0" />
              <span>Selecione um veículo acima para visualizar o impacto da exclusão e confirmar.</span>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: REMOVE SERVICE ORDER */}
      {activeTab === 'service' && (
        <div className="space-y-5 pt-1">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              1. Buscar e Selecionar a Ordem de Serviço / Serviço
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Filtrar por ID da O.S., placa ou nome do cliente..."
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all outline-none"
              />
            </div>

            <select
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
            >
              <option value="">-- Selecione a Ordem de Serviço para excluir --</option>
              {filteredServices.map((s) => (
                <option key={s.id} value={s.id}>
                  O.S. #{s.id.slice(-6).toUpperCase()} - {s.order_date ? new Date(s.order_date).toLocaleDateString('pt-BR') : ''} - {s.vehicle_plate} ({s.client_name}) - R$ {s.total_cost.toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          {selectedService ? (
            <div className="p-5 bg-rose-50/70 border border-rose-200/90 rounded-2xl space-y-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-extrabold text-rose-950">
                    Confirmação de exclusão da O.S. #{selectedService.id.slice(-6).toUpperCase()}
                  </h4>
                  <p className="text-xs text-rose-800 leading-relaxed">
                    A exclusão desta ordem de serviço removerá apenas este lançamento e seus itens. O cliente e o veículo permanecerão intactos no cadastro.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white p-4 rounded-xl border border-rose-200">
                <div className="space-y-1">
                  <span className="text-slate-500 font-semibold block text-[11px]">Cliente / Veículo:</span>
                  <span className="font-bold text-slate-900 block truncate">{selectedService.client_name}</span>
                  <span className="text-slate-600 font-mono text-[11px] block">{selectedService.vehicle_plate} ({selectedService.vehicle_info})</span>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-500 font-semibold block text-[11px]">Data / Status:</span>
                  <span className="font-bold text-slate-900 block">
                    {selectedService.order_date ? new Date(selectedService.order_date).toLocaleDateString('pt-BR') : 'Data não informada'}
                  </span>
                  <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">
                    {selectedService.status}
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-500 font-semibold block text-[11px]">Valor Total / Itens:</span>
                  <span className="font-black text-emerald-700 block text-sm">
                    R$ {selectedService.total_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-slate-500 text-[11px] block">
                    {serviceItemsCount} item(ns) no serviço
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDeleteServiceOrder}
                disabled={deleting}
                className="w-full py-3 px-5 bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>{deleting ? 'Excluindo Serviço...' : 'Excluir Somente Esta Ordem de Serviço'}</span>
              </button>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500 flex items-center gap-2">
              <Info className="w-4 h-4 text-sky-500 shrink-0" />
              <span>Selecione uma ordem de serviço acima para visualizar os detalhes e confirmar a exclusão.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
