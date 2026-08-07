import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, fetchAllVehiclesAllPages, type Client, type Vehicle } from '@/src/lib/supabase';
import { theme, formatCurrency, normalizeForSearch } from '@/src/lib/theme';
import { LoadingState, ErrorState } from './States';
import {
  ArrowLeft,
  ChevronDown,
  Plus,
  Trash2,
  Wrench,
  Package,
  X,
  AlertCircle,
  Clock,
  Gauge,
  Search,
  Check,
  User,
  Car,
} from 'lucide-react';

type ItemDraft = {
  key: string;
  item_type: 'servico' | 'peca';
  description: string;
  price: string;
};

type VehicleOption = Vehicle & { clients: Pick<Client, 'name'> };

interface VehicleComboboxProps {
  vehicles: VehicleOption[];
  selectedVehicleId: string;
  onSelectVehicle: (vehicleId: string) => void;
  onMergeRemoteVehicles?: (remoteVehicles: VehicleOption[]) => void;
  error?: string | null;
}

function VehicleCombobox({ vehicles, selectedVehicleId, onSelectVehicle, onMergeRemoteVehicles, error }: VehicleComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [query, setQuery] = useState('');
  const [searchingServer, setSearchingServer] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpward(spaceBelow < 340);
    }
  }, [isOpen]);

  // Get current selected vehicle object and its full formatted label
  const selectedVehicle = vehicles.find((item) => item.id === selectedVehicleId);
  const getVehicleLabel = (v: VehicleOption) => {
    const clientName = Array.isArray(v.clients) ? v.clients[0]?.name : (v.clients as any)?.name;
    return `${v.plate} · ${v.brand} ${v.model}${clientName ? ` — ${clientName}` : ''}`;
  };

  const selectedLabel = selectedVehicle ? getVehicleLabel(selectedVehicle) : '';

  // Sync display text when selectedVehicleId changes
  useEffect(() => {
    if (!isOpen) {
      setQuery(selectedLabel);
    }
  }, [selectedVehicleId, selectedLabel, isOpen]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery(selectedLabel);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedLabel]);

  // Determine active search filter string
  const isSelectedString = Boolean(selectedVehicleId && query === selectedLabel);
  const activeSearch = isSelectedString ? '' : query.trim();

  // Perform live server query when activeSearch is typed
  useEffect(() => {
    if (!activeSearch || activeSearch.length < 1 || !onMergeRemoteVehicles) return;

    const term = activeSearch.trim();
    const cleanTerm = term.replace(/[^a-zA-Z0-9]/g, '');

    const timer = setTimeout(async () => {
      try {
        setSearchingServer(true);
        const resultsMap = new Map<string, VehicleOption>();

        const promises: Promise<any>[] = [
          supabase.from('vehicles').select('*, clients(name)').ilike('plate', `${term}%`).order('plate').limit(100),
          supabase.from('vehicles').select('*, clients(name)').ilike('brand', `${term}%`).order('plate').limit(100),
          supabase.from('vehicles').select('*, clients(name)').ilike('model', `${term}%`).order('plate').limit(100),
          supabase.from('vehicles').select('*, clients(name)').ilike('plate', `%${term}%`).order('plate').limit(100),
          supabase.from('vehicles').select('*, clients(name)').ilike('brand', `%${term}%`).order('plate').limit(100),
          supabase.from('vehicles').select('*, clients(name)').ilike('model', `%${term}%`).order('plate').limit(100),
        ];

        if (cleanTerm && cleanTerm !== term) {
          promises.push(
            supabase.from('vehicles').select('*, clients(name)').ilike('plate', `${cleanTerm}%`).order('plate').limit(100),
            supabase.from('vehicles').select('*, clients(name)').ilike('plate', `%${cleanTerm}%`).order('plate').limit(100)
          );
        }

        const responses = await Promise.all(promises);
        responses.forEach((res) => {
          if (!res.error && res.data) {
            res.data.forEach((v: VehicleOption) => resultsMap.set(v.id, v));
          }
        });

        const combined = Array.from(resultsMap.values());
        if (combined.length > 0) {
          onMergeRemoteVehicles(combined);
        }
      } catch {
        // silent catch
      } finally {
        setSearchingServer(false);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [activeSearch, onMergeRemoteVehicles]);

  // Score vehicle relevance (prefix-match priority)
  const getVehicleSearchScore = (v: VehicleOption, search: string): number => {
    if (!search) return 0;
    const normQuery = normalizeForSearch(search).trim();
    if (!normQuery) return 0;
    const cleanQuery = normQuery.replace(/[^a-z0-9]/g, '');

    const plateRaw = normalizeForSearch(v.plate);
    const plateClean = plateRaw.replace(/[^a-z0-9]/g, '');
    const brand = normalizeForSearch(v.brand);
    const model = normalizeForSearch(v.model);
    const rawClientName = Array.isArray(v.clients) ? v.clients[0]?.name : (v.clients as any)?.name || '';
    const clientName = normalizeForSearch(rawClientName);

    // 1. Plate starts with query
    if (plateRaw.startsWith(normQuery) || (cleanQuery && plateClean.startsWith(cleanQuery))) {
      return 1;
    }
    // 2. Brand starts with query
    if (brand.startsWith(normQuery)) {
      return 2;
    }
    // 3. Model starts with query
    if (model.startsWith(normQuery)) {
      return 3;
    }
    // 4. Client name starts with query or word in client name starts with query
    if (clientName.startsWith(normQuery) || clientName.split(/\s+/).some((w) => w.startsWith(normQuery))) {
      return 4;
    }
    // 5. Plate contains query
    if (plateRaw.includes(normQuery) || (cleanQuery && plateClean.includes(cleanQuery))) {
      return 5;
    }
    // 6. Brand/Model/Client contains query
    if (brand.includes(normQuery) || model.includes(normQuery) || clientName.includes(normQuery)) {
      return 6;
    }

    return 7;
  };

  // Filter vehicles matching plate, brand, model or client with prefix priority
  const filteredVehicles = vehicles
    .filter((v) => {
      if (!activeSearch) return true;
      return getVehicleSearchScore(v, activeSearch) < 7;
    })
    .sort((a, b) => {
      if (activeSearch) {
        const scoreA = getVehicleSearchScore(a, activeSearch);
        const scoreB = getVehicleSearchScore(b, activeSearch);
        if (scoreA !== scoreB) {
          return scoreA - scoreB;
        }
      }
      return (a.plate || '').localeCompare(b.plate || '', 'pt-BR', { sensitivity: 'base' });
    });

  const handleSelect = (v: VehicleOption) => {
    onSelectVehicle(v.id);
    setQuery(getVehicleLabel(v));
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectVehicle('');
    setQuery('');
    setIsOpen(true);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative space-y-1">
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Digite a placa (ex: XXX0000), modelo ou cliente..."
          value={query}
          onFocus={(e) => {
            setIsOpen(true);
            if (selectedVehicleId && query === selectedLabel) {
              e.target.select();
            }
          }}
          onClick={() => {
            setIsOpen(true);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            if (selectedVehicleId) {
              onSelectVehicle('');
            }
          }}
          className={`block w-full pl-10 pr-10 py-2.5 bg-gray-50 border rounded-xl text-gray-900 text-sm transition-all outline-none font-medium ${
            isOpen ? 'bg-white border-amber-500 ring-2 ring-amber-500/20 shadow-xs' : 'border-gray-200 hover:border-gray-300'
          } ${error ? 'border-red-400 bg-red-50/50' : ''}`}
        />
        {searchingServer ? (
          <div className="w-4 h-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin absolute right-3 pointer-events-none" />
        ) : query ? (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg absolute right-3 cursor-pointer"
            title="Limpar busca de veículo"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 pointer-events-none" />
        )}
      </div>

      {/* Dropdown list */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 z-[100] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-visible flex flex-col ${
            openUpward ? 'bottom-full mb-1.5 max-h-[380px]' : 'top-full mt-1.5 max-h-[420px]'
          }`}
        >
          <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 rounded-t-2xl">
            <span>
              {activeSearch ? `Filtro: "${activeSearch}"` : 'Selecione a Placa / Veículo'}
            </span>
          </div>

          <div className="overflow-y-auto max-h-[320px] divide-y divide-slate-100 p-1.5 pb-8">
            {filteredVehicles.length === 0 ? (
              <div className="p-4 text-center space-y-2">
                <p className="text-xs font-bold text-slate-700">Nenhum veículo encontrado com "{activeSearch}"</p>
                <p className="text-[11px] text-slate-400">
                  Nenhuma placa ou veículo atende à busca.
                </p>
              </div>
            ) : (
              <>
                {filteredVehicles.map((v) => {
                  const clientName = Array.isArray(v.clients) ? v.clients[0]?.name : (v.clients as any)?.name;
                  const isSelected = v.id === selectedVehicleId;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelect(v)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected ? 'bg-amber-50 text-amber-950 font-bold' : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono font-black text-xs px-2 py-0.5 bg-slate-900 text-amber-400 rounded border border-slate-800 tracking-wider shrink-0 shadow-xs">
                          {v.plate}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {v.brand} {v.model} {v.year ? `(${v.year})` : ''}
                          </p>
                          <p className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                            <User className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{clientName || 'Sem cliente'}</span>
                          </p>
                        </div>
                      </div>

                      {isSelected && <Check className="w-4 h-4 text-amber-600 shrink-0" />}
                    </button>
                  );
                })}

                {activeSearch && (
                  <div className="p-2.5 my-2 bg-slate-50 border border-slate-200 rounded-xl text-center">
                    <p className="text-[11px] text-slate-600 font-medium">
                      Exibindo <strong className="text-slate-900">{filteredVehicles.length}</strong> de <strong className="text-slate-900">{vehicles.length}</strong> veículos para "<span className="font-bold text-slate-700">{activeSearch}</span>".
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface OrderNewViewProps {
  onBack: () => void;
  onNavigateToOrderDetails: (id: string) => void;
  preselectedVehicleId?: string;
}

export default function OrderNewView({ onBack, onNavigateToOrderDetails, preselectedVehicleId }: OrderNewViewProps) {
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [mileage, setMileage] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([]);

  const handleMergeRemoteVehicles = useCallback((remoteList: VehicleOption[]) => {
    setVehicles((prev) => {
      const existingIds = new Set(prev.map((v) => v.id));
      const newItems = remoteList.filter((v) => !existingIds.has(v.id));
      if (newItems.length === 0) return prev;
      return [...prev, ...newItems];
    });
  }, []);

  const loadVehicles = useCallback(async () => {
    try {
      setLoading(true);
      const allVehicles: VehicleOption[] = await fetchAllVehiclesAllPages();

      setVehicles(allVehicles);
      if (allVehicles.length > 0 && preselectedVehicleId && allVehicles.some((v) => v.id === preselectedVehicleId)) {
        setSelectedVehicleId(preselectedVehicleId);
      } else {
        setSelectedVehicleId('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar veículos');
    } finally {
      setLoading(false);
    }
  }, [preselectedVehicleId]);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  const addItem = (type: 'servico' | 'peca') => {
    setItems((prev) => [
      ...prev,
      { key: Math.random().toString(36).substring(2, 11), item_type: type, description: '', price: '' },
    ]);
  };

  const updateItem = (key: string, field: 'description' | 'price', value: string) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, [field]: value } : i)));
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  };

  const totalServicos = items
    .filter((i) => i.item_type === 'servico')
    .reduce((s, i) => s + (parseFloat(i.price.replace(',', '.')) || 0), 0);
  const totalPecas = items
    .filter((i) => i.item_type === 'peca')
    .reduce((s, i) => s + (parseFloat(i.price.replace(',', '.')) || 0), 0);
  const total = totalServicos + totalPecas;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleId) {
      setFormError('Selecione o veículo');
      return;
    }
    if (!orderDate) {
      setFormError('Informe a data');
      return;
    }
    if (items.some((i) => !i.description.trim())) {
      setFormError('Preencha a descrição de todos os itens criados');
      return;
    }
    setSaving(true);
    setFormError(null);

    try {
      const vehicle = vehicles.find((v) => v.id === selectedVehicleId);
      if (!vehicle) throw new Error('Veículo não encontrado');

      const { data: orderData, error: orderError } = await supabase
        .from('service_orders')
        .insert({
          vehicle_id: selectedVehicleId,
          client_id: vehicle.client_id,
          order_date: orderDate,
          mileage: mileage ? parseInt(mileage, 10) : null,
          status: 'aberta',
        })
        .select('id')
        .single();

      if (orderError) throw orderError;

      if (items.length > 0) {
        const { error: itemsError } = await supabase.from('order_items').insert(
          items.map((i) => ({
            order_id: orderData.id,
            item_type: i.item_type,
            description: i.description.trim(),
            price: parseFloat(i.price.replace(',', '.')) || 0,
          }))
        );
        if (itemsError) throw itemsError;
      }

      onNavigateToOrderDetails(orderData.id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar ordem');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-100 rounded-xl transition-all cursor-pointer text-slate-500"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 leading-tight">Novo Serviço</h1>
          <p className="text-sm text-slate-500 mt-0.5">Abertura de novo atendimento</p>
        </div>
      </div>

      {vehicles.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center space-y-4 max-w-md mx-auto shadow-xs">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-50 text-amber-600 mx-auto">
            <AlertCircle className="w-6 h-6 animate-pulse" />
          </div>
          <h3 className="font-bold text-slate-800">Nenhum veículo cadastrado</h3>
          <p className="text-sm text-slate-500">
            Você precisa ter pelo menos um veículo cadastrado para registrar um novo serviço.
          </p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-all cursor-pointer"
          >
            Voltar
          </button>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {formError && (
            <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-100">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{formError}</p>
            </div>
          )}

          {/* General Data Card */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs space-y-4">
            <h2 className="text-base font-extrabold text-slate-900 border-b border-gray-50 pb-2">Dados Gerais</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1 md:col-span-1.5">
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Veículo * <span className="text-xs font-normal text-slate-400">(digite a placa para buscar)</span>
                </label>
                <VehicleCombobox
                  vehicles={vehicles}
                  selectedVehicleId={selectedVehicleId}
                  onSelectVehicle={(id) => {
                    setSelectedVehicleId(id);
                    if (formError) setFormError(null);
                  }}
                  onMergeRemoteVehicles={handleMergeRemoteVehicles}
                  error={formError && !selectedVehicleId ? formError : null}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Data de Abertura *
                </label>
                <input
                  type="date"
                  required
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:bg-white focus:border-amber-500 transition-all outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Quilometragem (Km)
                </label>
                <input
                  type="number"
                  placeholder="Ex: 45000"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                  className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:bg-white focus:border-amber-500 transition-all outline-none"
                />
              </div>
            </div>
          </div>

          {/* Services & Parts Builder Card */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-gray-50 pb-3">
              <h2 className="text-base font-extrabold text-slate-900">Serviços e Peças Estimados</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => addItem('servico')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 text-xs font-bold rounded-lg border border-sky-100 transition-all cursor-pointer"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  + Serviço
                </button>
                <button
                  type="button"
                  onClick={() => addItem('peca')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold rounded-lg border border-emerald-100 transition-all cursor-pointer"
                >
                  <Package className="w-3.5 h-3.5" />
                  + Peça
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-8 bg-slate-50/50 rounded-xl border border-dashed border-gray-200">
                <p className="text-slate-400 text-sm">
                  Nenhum item adicionado à estimativa inicial. Use os botões acima para adicionar serviços ou peças.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div
                    key={item.key}
                    className={`flex flex-col sm:flex-row gap-3 p-4 rounded-xl border ${
                      item.item_type === 'servico'
                        ? 'bg-sky-50/20 border-sky-100'
                        : 'bg-emerald-50/20 border-emerald-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                      <span className="text-xs font-bold text-slate-400">#{index + 1}</span>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          item.item_type === 'servico'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {item.item_type === 'servico' ? <Wrench className="w-3 h-3" /> : <Package className="w-3 h-3" />}
                        {item.item_type === 'servico' ? 'Serviço' : 'Peça'}
                      </span>
                    </div>

                    <div className="flex-1">
                      <input
                        type="text"
                        required
                        placeholder="Descrição do serviço ou peça..."
                        value={item.description}
                        onChange={(e) => updateItem(item.key, 'description', e.target.value)}
                        className="block w-full px-3.5 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm focus:border-slate-400 transition-all outline-none"
                      />
                    </div>

                    <div className="w-full sm:w-32 shrink-0">
                      <input
                        type="text"
                        placeholder="Valor (R$)"
                        value={item.price}
                        onChange={(e) => updateItem(item.key, 'price', e.target.value)}
                        className="block w-full px-3.5 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm focus:border-slate-400 transition-all outline-none font-medium"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.key)}
                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all self-end sm:self-auto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Running Totals & Save Actions */}
          {items.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs space-y-3 max-w-sm ml-auto">
              <div className="flex justify-between text-sm text-slate-500 font-medium">
                <span>Serviços</span>
                <span>{formatCurrency(totalServicos)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-500 font-medium pb-2 border-b border-gray-100">
                <span>Peças</span>
                <span>{formatCurrency(totalPecas)}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-slate-900">
                <span>Total Estimado</span>
                <span className="text-emerald-600">{formatCurrency(total)}</span>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 text-white rounded-xl font-bold shadow-md hover:opacity-90 transition-all cursor-pointer flex items-center justify-center"
              style={{ backgroundColor: theme.accent }}
            >
              {saving ? 'Cadastrando...' : 'Cadastrar Serviço'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
