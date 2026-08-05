import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, consolidateDuplicateVehicles, deleteVehicleAndAssociations, fetchAllClientsAllPages, type Vehicle, type Client } from '@/src/lib/supabase';
import { theme } from '@/src/lib/theme';
import { LoadingState, ErrorState, EmptyState } from './States';
import { Plus, Search, Car, User, StickyNote, Pencil, Trash2, X, AlertCircle, ChevronLeft, ChevronRight, ClipboardList, ChevronDown, Check, Loader2, Layers } from 'lucide-react';

type VehicleRow = Vehicle & { clients?: { name: string } | Array<{ name: string }> | null };

interface ClientComboboxProps {
  clients: Client[];
  selectedClientId: string;
  onSelectClient: (clientId: string) => void;
  onMergeRemoteClients?: (remoteClients: Client[]) => void;
  error?: string | null;
}

function ClientCombobox({ clients, selectedClientId, onSelectClient, onMergeRemoteClients, error }: ClientComboboxProps) {
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

  const isValidName = (name: string | null | undefined): boolean => {
    if (!name) return false;
    const clean = name.trim();
    return (
      clean !== '' &&
      clean !== '-' &&
      clean !== ' - ' &&
      clean !== '--' &&
      clean.toLowerCase() !== 'sem nome' &&
      clean.toLowerCase() !== 'sem proprietário'
    );
  };

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const getClientLabel = (c: Client) => `${c.name}${c.phone ? ` (${c.phone})` : ''}`;
  const selectedLabel = selectedClient && isValidName(selectedClient.name) ? getClientLabel(selectedClient) : '';

  useEffect(() => {
    if (!isOpen) {
      setQuery(selectedLabel);
    }
  }, [selectedClientId, selectedLabel, isOpen]);

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

  const isSelectedString = Boolean(selectedClientId && query === selectedLabel);
  const activeSearch = isSelectedString ? '' : query.trim();

  // Helper to normalize strings for search (accents, lowercase)
  const normalizeStr = (str?: string | null) =>
    (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  // Helper to score client relevance (prefix-match priority)
  const getClientScore = (c: Client, search: string): number => {
    if (!search) return 0;
    const normQuery = normalizeStr(search);
    if (!normQuery) return 0;

    const normName = normalizeStr(c.name);

    // 1. Name starts with query (Highest priority)
    if (normName.startsWith(normQuery)) {
      return 1;
    }

    // 2. A word in name starts with query
    const words = normName.split(/\s+/).filter(Boolean);
    if (words.some((w) => w.startsWith(normQuery))) {
      return 2;
    }

    // 3. Name contains query anywhere
    if (normName.includes(normQuery)) {
      return 3;
    }

    // 4. Phone match
    const cPhoneDigits = (c.phone || '').replace(/\D/g, '');
    const queryDigits = search.replace(/\D/g, '');
    if (
      (queryDigits.length >= 3 && cPhoneDigits.includes(queryDigits)) ||
      normalizeStr(c.phone).includes(normQuery)
    ) {
      return 4;
    }

    // 5. Notes match
    if (c.notes && normalizeStr(c.notes).includes(normQuery)) {
      return 5;
    }

    return 6;
  };

  // Live remote search with fast 100ms response
  useEffect(() => {
    if (!activeSearch || activeSearch.length < 1 || !onMergeRemoteClients) return;

    const term = activeSearch.trim();
    const cleanPhone = term.replace(/\D/g, '');
    const words = term.split(/\s+/).filter(Boolean);

    const timer = setTimeout(async () => {
      try {
        setSearchingServer(true);
        const resultsMap = new Map<string, Client>();

        const promises: Promise<any>[] = [
          supabase.from('clients').select('id, name, phone, notes').ilike('name', `${term}%`).order('name').limit(100),
          supabase.from('clients').select('id, name, phone, notes').ilike('name', `%${term}%`).order('name').limit(100),
          supabase.from('clients').select('id, name, phone, notes').ilike('phone', `%${term}%`).order('name').limit(100),
        ];

        if (cleanPhone && cleanPhone.length >= 3 && cleanPhone !== term) {
          promises.push(
            supabase.from('clients').select('id, name, phone, notes').ilike('phone', `%${cleanPhone}%`).order('name').limit(100)
          );
        }

        if (words.length > 1) {
          let qWords = supabase.from('clients').select('id, name, phone, notes').order('name').limit(100);
          words.forEach((w) => {
            qWords = qWords.ilike('name', `%${w}%`);
          });
          promises.push(qWords);
        }

        const responses = await Promise.all(promises);
        responses.forEach((res) => {
          if (!res.error && res.data) {
            res.data.forEach((c: Client) => resultsMap.set(c.id, c));
          }
        });

        const combined = Array.from(resultsMap.values());
        if (combined.length > 0) {
          onMergeRemoteClients(combined);
        }
      } catch (e) {
        console.error('Error fetching remote clients:', e);
      } finally {
        setSearchingServer(false);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [activeSearch, onMergeRemoteClients]);

  const filteredClients = clients
    .filter((c) => {
      if (!isValidName(c.name)) return false;
      if (!activeSearch) return true;
      return getClientScore(c, activeSearch) < 6;
    })
    .sort((a, b) => {
      if (activeSearch) {
        const scoreA = getClientScore(a, activeSearch);
        const scoreB = getClientScore(b, activeSearch);
        if (scoreA !== scoreB) {
          return scoreA - scoreB;
        }
      }
      return (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' });
    });

  const handleSelect = (c: Client) => {
    onSelectClient(c.id);
    setQuery(getClientLabel(c));
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectClient('');
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
          placeholder="Digite o nome ou telefone do proprietário..."
          value={query}
          onFocus={(e) => {
            setIsOpen(true);
            if (selectedClientId && query === selectedLabel) {
              e.target.select();
            }
          }}
          onClick={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            if (selectedClientId) {
              onSelectClient('');
            }
          }}
          className={`block w-full pl-10 pr-10 py-2.5 bg-gray-50 border rounded-xl text-gray-900 text-sm transition-all outline-none font-medium ${
            isOpen ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs' : 'border-gray-200 hover:border-gray-300'
          } ${error ? 'border-red-400 bg-red-50/50' : ''}`}
        />
        {searchingServer ? (
          <div className="w-4 h-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin absolute right-3 pointer-events-none" />
        ) : query ? (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg absolute right-3 cursor-pointer"
            title="Limpar cliente"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 pointer-events-none" />
        )}
      </div>

      {isOpen && (
        <div
          className={`absolute left-0 right-0 z-[100] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-visible flex flex-col ${
            openUpward ? 'bottom-full mb-1.5 max-h-[380px]' : 'top-full mt-1.5 max-h-[420px]'
          }`}
        >
          <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 rounded-t-2xl">
            <span>
              {activeSearch ? `Filtro: "${activeSearch}"` : 'Selecione o Cliente Proprietário'}
            </span>
          </div>

          <div className="overflow-y-auto max-h-[320px] divide-y divide-slate-100 p-1.5 pb-8">
            {filteredClients.length === 0 ? (
              <div className="p-4 text-center space-y-2">
                <p className="text-xs font-bold text-slate-700">Nenhum cliente encontrado com "{activeSearch}"</p>
                <p className="text-[11px] text-slate-400">
                  Nenhum proprietário atende aos critérios da busca.
                </p>
              </div>
            ) : (
              <>
                {filteredClients.map((c) => {
                  const isSelected = c.id === selectedClientId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelect(c)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected ? 'bg-emerald-50 text-emerald-950 font-bold' : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-slate-500">
                          <User className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{c.name}</p>
                          {c.phone && (
                            <p className="text-[11px] text-slate-500 truncate">{c.phone}</p>
                          )}
                        </div>
                      </div>

                      {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                    </button>
                  );
                })}

                {/* Explicit indicator showing that all records have been loaded to the end */}
                {!activeSearch && filteredClients.length > 0 && (
                  <div className="py-3 px-4 text-center bg-slate-50/90 border-t border-slate-200 rounded-b-xl my-2">
                    <p className="text-xs font-extrabold text-slate-700 flex items-center justify-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 stroke-[3]" />
                      <span>Fim da lista — Todos os {filteredClients.length} clientes exibidos (de A a Z)</span>
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium mt-1">
                      "{filteredClients[filteredClients.length - 1]?.name}" é o último cliente do seu banco de dados em ordem alfabética.
                    </p>
                  </div>
                )}

                {activeSearch && (
                  <div className="p-2.5 my-2 bg-slate-50 border border-slate-200 rounded-xl text-center">
                    <p className="text-[11px] text-slate-600 font-medium">
                      Exibindo <strong className="text-slate-900">{filteredClients.length}</strong> de <strong className="text-slate-900">{clients.length}</strong> clientes para "<span className="font-bold text-slate-700">{activeSearch}</span>".
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

interface VehiclesViewProps {
  onNavigate?: (view: string, params?: any, currentViewSaveParams?: any) => void;
  params?: any;
}

export default function VehiclesView({ onNavigate, params }: VehiclesViewProps) {
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchInput, setSearchInput] = useState(params?.searchInput ?? params?.search ?? '');
  const [search, setSearch] = useState(params?.search ?? params?.searchInput ?? '');
  const [editingVehicle, setEditingVehicle] = useState<VehicleRow | null>(null);
  const [page, setPage] = useState(params?.page ?? 1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    if (params) {
      if (params.searchInput !== undefined) setSearchInput(params.searchInput);
      if (params.search !== undefined) setSearch(params.search);
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

  const [formPlate, setFormPlate] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formYear, setFormYear] = useState('');
  const [formClientId, setFormClientId] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [clientSearchText, setClientSearchText] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [isSearchingClients, setIsSearchingClients] = useState(false);
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleMergeRemoteClients = useCallback((remoteList: Client[]) => {
    setClients((prev) => {
      const existingIds = new Set(prev.map((c) => c.id));
      const newItems = remoteList.filter((c) => !existingIds.has(c.id));
      if (newItems.length === 0) return prev;
      return [...prev, ...newItems];
    });
  }, []);

  const handleConsolidateVehicles = async () => {
    setIsConsolidating(true);
    setNotice(null);
    try {
      const res = await consolidateDuplicateVehicles();
      if (res.mergedCount > 0) {
        setNotice(res.message);
      } else {
        setNotice('Nenhuma placa duplicada encontrada no banco de dados.');
      }
      await loadData();
    } catch (err) {
      console.error('Erro ao consolidar veículos:', err);
    } finally {
      setIsConsolidating(false);
    }
  };

  const searchClientsDB = async (searchTerm: string) => {
    const rawTerm = searchTerm.trim();
    if (!rawTerm) return;
    setIsSearchingClients(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, phone')
        .or(`name.ilike.%${rawTerm}%,phone.ilike.%${rawTerm}%`)
        .order('name')
        .limit(100);

      if (error) {
        console.error('Erro ao buscar clientes no banco:', error);
      } else if (data) {
        setClients((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const newClients = data.filter((c) => !existingIds.has(c.id));
          return [...prev, ...newClients];
        });
      }
    } catch (err) {
      console.error('Exceção ao buscar clientes:', err);
    } finally {
      setIsSearchingClients(false);
    }
  };

  const isValidOwnerName = (name: string | null | undefined): boolean => {
    if (!name) return false;
    const clean = name.trim();
    return (
      clean !== '' &&
      clean !== '-' &&
      clean !== ' - ' &&
      clean !== '--' &&
      clean.toLowerCase() !== 'sem nome' &&
      clean.toLowerCase() !== 'sem proprietário'
    );
  };

  const getVehicleOwnerName = useCallback(
    (vehicle: VehicleRow) => {
      let name: string | undefined;
      if (vehicle.clients) {
        if (Array.isArray(vehicle.clients) && vehicle.clients.length > 0) {
          name = (vehicle.clients[0] as any)?.name;
        } else if (typeof vehicle.clients === 'object' && 'name' in vehicle.clients) {
          name = (vehicle.clients as any).name;
        }
      }
      if (!isValidOwnerName(name) && vehicle.client_id) {
        const found = clients.find((c) => c.id === vehicle.client_id);
        if (found?.name && isValidOwnerName(found.name)) {
          name = found.name;
        }
      }
      if (!isValidOwnerName(name)) {
        return 'Sem proprietário';
      }
      return name!;
    },
    [clients]
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const from = (page - 1) * pageSize;
      const to = page * pageSize - 1;

      let vehiclesRes: { data: any; error: any; count?: number | null };

      if (search.trim()) {
        const term = search.trim();
        const cleanPlate = term.replace(/[^a-zA-Z0-9]/g, '');

        const promises: Promise<any>[] = [
          supabase.from('vehicles').select('*, clients(name)', { count: 'exact' }).ilike('plate', `%${term}%`).order('plate').range(from, to),
          supabase.from('vehicles').select('*, clients(name)', { count: 'exact' }).ilike('brand', `%${term}%`).order('plate').range(from, to),
          supabase.from('vehicles').select('*, clients(name)', { count: 'exact' }).ilike('model', `%${term}%`).order('plate').range(from, to),
          supabase.from('vehicles').select('*, clients(name)', { count: 'exact' }).ilike('notes', `%${term}%`).order('plate').range(from, to),
        ];

        if (cleanPlate && cleanPlate !== term) {
          promises.push(
            supabase.from('vehicles').select('*, clients(name)', { count: 'exact' }).ilike('plate', `%${cleanPlate}%`).order('plate').range(from, to)
          );
        }

        // Also search clients table for owner matches
        const clientMatchesRes = await supabase
          .from('clients')
          .select('id')
          .or(`name.ilike.%${term}%,phone.ilike.%${term}%,notes.ilike.%${term}%`)
          .limit(100);

        if (clientMatchesRes.data && clientMatchesRes.data.length > 0) {
          const clientIds = clientMatchesRes.data.map((c) => c.id);
          promises.push(
            supabase.from('vehicles').select('*, clients(name)', { count: 'exact' }).in('client_id', clientIds).order('plate').range(from, to)
          );
        }

        const responses = await Promise.all(promises);
        const vMap = new Map<string, VehicleRow>();
        let maxCount = 0;

        responses.forEach((res) => {
          if (!res.error && res.data) {
            res.data.forEach((v: VehicleRow) => vMap.set(v.id, v));
            if (res.count && res.count > maxCount) maxCount = res.count;
          }
        });

        const vList = Array.from(vMap.values());
        vList.sort((a, b) => (a.plate || '').localeCompare(b.plate || '', 'pt-BR', { sensitivity: 'base' }));

        vehiclesRes = { data: vList, error: null, count: maxCount || vList.length };
      } else {
        vehiclesRes = await supabase
          .from('vehicles')
          .select('*, clients(name)', { count: 'estimated' })
          .order('created_at', { ascending: false })
          .range(from, to);
      }

      // Fetch all clients across all pages without PostgREST offset limits
      const loadedClients = await fetchAllClientsAllPages();

      if (vehiclesRes.error) throw vehiclesRes.error;

      setClients(loadedClients);

      const rawVehicles = (vehiclesRes.data ?? []) as VehicleRow[];
      const uniqueVehicles: VehicleRow[] = [];
      const seenIds = new Set<string>();
      const seenPlates = new Set<string>();

      for (const v of rawVehicles) {
        if (!v || seenIds.has(v.id)) continue;
        const cleanP = (v.plate || '').replace(/[^A-Z0-9]/g, '').toUpperCase();
        if (cleanP && seenPlates.has(cleanP)) continue;

        seenIds.add(v.id);
        if (cleanP) seenPlates.add(cleanP);
        uniqueVehicles.push(v);
      }

      // Check if any vehicle is missing a valid owner name, and attempt to resolve from service_orders
      const missingVehicles = uniqueVehicles.filter((v) => {
        let name: string | undefined;
        if (v.clients) {
          if (Array.isArray(v.clients) && v.clients.length > 0) {
            name = (v.clients[0] as any)?.name;
          } else if (typeof v.clients === 'object' && 'name' in v.clients) {
            name = (v.clients as any).name;
          }
        }
        if (!isValidOwnerName(name) && v.client_id) {
          const found = loadedClients.find((c) => c.id === v.client_id);
          if (found?.name && isValidOwnerName(found.name)) name = found.name;
        }
        return !isValidOwnerName(name);
      });

      if (missingVehicles.length > 0) {
        const missingIds = missingVehicles.map((v) => v.id);
        const { data: orderData } = await supabase
          .from('service_orders')
          .select('vehicle_id, client_id, clients(id, name)')
          .in('vehicle_id', missingIds)
          .not('client_id', 'is', null);

        if (orderData && orderData.length > 0) {
          const orderMap = new Map<string, { client_id: string; name: string }>();
          for (const item of orderData) {
            if (item.vehicle_id && item.client_id) {
              const cObj = Array.isArray(item.clients) ? item.clients[0] : item.clients;
              const name = (cObj as any)?.name;
              if (isValidOwnerName(name)) {
                orderMap.set(item.vehicle_id, { client_id: item.client_id, name });
              }
            }
          }

          for (const v of missingVehicles) {
            const found = orderMap.get(v.id);
            if (found) {
              v.client_id = found.client_id;
              v.clients = { name: found.name };
              supabase.from('vehicles').update({ client_id: found.client_id }).eq('id', v.id).then();
            }
          }
        }
      }

      setVehicles(uniqueVehicles);
      setTotalCount(uniqueVehicles.length < rawVehicles.length ? uniqueVehicles.length : (vehiclesRes.count ?? rawVehicles.length));
    } catch (err: any) {
      const msg = err?.message || err?.details || (typeof err === 'string' ? err : 'Erro ao carregar veículos');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' });
  };

  const openAddModal = () => {
    setEditingVehicle(null);
    setFormPlate('');
    setFormBrand('');
    setFormModel('');
    setFormYear('');
    const firstValidClient = clients.find((c) => isValidOwnerName(c.name));
    setFormClientId(firstValidClient?.id ?? '');
    setFormNotes('');
    setFormError(null);
    setClientSearchText('');
    setIsClientDropdownOpen(false);
    setModalVisible(true);
    scrollToTop();
  };

  const openEditModal = (vehicle: VehicleRow) => {
    setEditingVehicle(vehicle);
    setFormPlate(vehicle.plate);
    setFormBrand(vehicle.brand);
    setFormModel(vehicle.model);
    setFormYear(vehicle.year ? String(vehicle.year) : '');
    setFormClientId(vehicle.client_id || '');

    if (vehicle.client_id && !clients.some((c) => c.id === vehicle.client_id)) {
      let clientName = '';
      if (vehicle.clients) {
        if (Array.isArray(vehicle.clients) && vehicle.clients.length > 0) {
          clientName = (vehicle.clients[0] as any)?.name || '';
        } else if (typeof vehicle.clients === 'object' && 'name' in vehicle.clients) {
          clientName = (vehicle.clients as any).name || '';
        }
      }
      if (clientName) {
        setClients((prev) => [...prev, { id: vehicle.client_id!, name: clientName, phone: null, notes: null }]);
      }
    }

    setFormNotes(vehicle.notes ?? '');
    setFormError(null);
    setClientSearchText('');
    setIsClientDropdownOpen(false);
    setModalVisible(true);
    scrollToTop();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPlate.trim()) {
      setFormError('Informe a placa do veículo');
      return;
    }
    if (!formClientId) {
      setFormError('É obrigatório selecionar um proprietário para o veículo.');
      return;
    }
    const selectedClient = clients.find((c) => c.id === formClientId);
    if (!selectedClient || !isValidOwnerName(selectedClient.name)) {
      setFormError('É obrigatório selecionar um proprietário válido. Não é permitido cadastrar veículos sem proprietário.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const cleanTargetPlate = formPlate.replace(/[^A-Z0-9]/g, '').toUpperCase();

      // Check for duplicate plate directly querying database
      const { data: existingPlates, error: checkError } = await supabase
        .from('vehicles')
        .select('id, plate, clients(name)')
        .ilike('plate', `%${cleanTargetPlate}%`);

      if (checkError) throw checkError;

      if (existingPlates && existingPlates.length > 0) {
        const duplicate = existingPlates.find((v: any) => {
          const cleanP = (v.plate || '').replace(/[^A-Z0-9]/g, '').toUpperCase();
          if (cleanP !== cleanTargetPlate) return false;
          if (editingVehicle && v.id === editingVehicle.id) return false;
          return true;
        });

        if (duplicate) {
          const clientRel = (duplicate as any).clients;
          const ownerName = Array.isArray(clientRel) ? clientRel[0]?.name : clientRel?.name;
          setFormError(
            `A placa "${formPlate.trim().toUpperCase()}" já está cadastrada no sistema${
              ownerName ? ` (Proprietário: ${ownerName})` : ''
            }. Não é possível cadastrar a mesma placa duplicada.`
          );
          setSaving(false);
          return;
        }
      }

      const payload = {
        plate: formPlate.trim().toUpperCase(),
        brand: formBrand.trim() || 'Não informada',
        model: formModel.trim() || 'Não informado',
        year: formYear ? parseInt(formYear, 10) : null,
        client_id: formClientId,
        notes: formNotes.trim() || null,
      };
      if (editingVehicle) {
        const { error } = await supabase.from('vehicles').update(payload).eq('id', editingVehicle.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('vehicles').insert(payload);
        if (error) throw error;
      }
      setModalVisible(false);
      loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };


  const closeModal = () => {
    setModalVisible(false);
    setFormPlate('');
    setFormBrand('');
    setFormModel('');
    setFormYear('');
    setFormClientId('');
    setFormNotes('');
    setFormError(null);
    setEditingVehicle(null);
    setClientSearchText('');
    setIsClientDropdownOpen(false);
  };

  const handleDeleteVehicleCard = async (vehicle: VehicleRow) => {
    if (
      !confirm(
        `ATENÇÃO: Deseja realmente excluir o veículo "${vehicle.plate} - ${vehicle.brand} ${vehicle.model}"?\n\nTodas as ordens de serviço vinculadas a este veículo/placa também serão totalmente removidas.`
      )
    ) {
      return;
    }
    setLoading(true);
    const res = await deleteVehicleAndAssociations(vehicle.id);
    if (res.success) {
      loadData();
    } else {
      alert(res.message);
      setLoading(false);
    }
  };

  const normalizeStr = (str?: string | null) =>
    (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const selectedClient = clients.find((c) => c.id === formClientId);

  const filteredClients = clients.filter((c) => {
    if (!clientSearchText.trim()) return true;
    const query = normalizeStr(clientSearchText);
    const words = query.split(/\s+/).filter(Boolean);

    const cName = normalizeStr(c.name);
    const cPhoneDigits = (c.phone || '').replace(/\D/g, '');
    const queryDigits = clientSearchText.replace(/\D/g, '');

    const nameMatch = words.length > 0 && words.every((w) => cName.includes(w));
    const phoneMatch =
      (queryDigits.length >= 3 && cPhoneDigits.includes(queryDigits)) ||
      normalizeStr(c.phone).includes(query);

    return nameMatch || phoneMatch;
  });

  const getVehicleSearchScore = (v: VehicleRow, searchStr: string): number => {
    if (!searchStr) return 0;
    const normQuery = searchStr.toLowerCase().trim();
    if (!normQuery) return 0;
    const cleanQuery = normQuery.replace(/[^a-z0-9]/g, '');

    const plateRaw = (v.plate || '').toLowerCase();
    const plateClean = plateRaw.replace(/[^a-z0-9]/g, '');
    const brand = (v.brand || '').toLowerCase();
    const model = (v.model || '').toLowerCase();
    const clientName = getVehicleOwnerName(v).toLowerCase();

    if (plateRaw.startsWith(normQuery) || (cleanQuery && plateClean.startsWith(cleanQuery))) return 1;
    if (brand.startsWith(normQuery)) return 2;
    if (model.startsWith(normQuery)) return 3;
    if (clientName.startsWith(normQuery) || clientName.split(/\s+/).some((w) => w.startsWith(normQuery))) return 4;
    if (plateRaw.includes(normQuery) || (cleanQuery && plateClean.includes(cleanQuery))) return 5;
    if (brand.includes(normQuery) || model.includes(normQuery) || clientName.includes(normQuery)) return 6;

    return 7;
  };

  const currentSearchTerm = searchInput.trim() || search.trim();

  const filtered = currentSearchTerm
    ? vehicles
        .filter((v) => getVehicleSearchScore(v, currentSearchTerm) < 7)
        .sort((a, b) => {
          const scoreA = getVehicleSearchScore(a, currentSearchTerm);
          const scoreB = getVehicleSearchScore(b, currentSearchTerm);
          if (scoreA !== scoreB) return scoreA - scoreB;
          return (a.plate || '').localeCompare(b.plate || '', 'pt-BR', { sensitivity: 'base' });
        })
    : vehicles;

  if (loading && vehicles.length === 0 && !currentSearchTerm) return <LoadingState />;
  if (error && vehicles.length === 0) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div className="space-y-6 relative">
      {/* Add / Edit Modal - Positioned at top for instant visibility */}
      {modalVisible && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-start justify-center z-50 p-4 pt-6 sm:pt-12 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-visible animate-scale-up my-auto sm:my-0 relative">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-900">
                {editingVehicle ? 'Editar Veículo' : 'Novo Veículo'}
              </h2>
              <button
                onClick={closeModal}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {clients.length === 0 ? (
              <div className="p-6 text-center space-y-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-50 text-amber-600 mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-800">Nenhum cliente cadastrado</h3>
                <p className="text-sm text-slate-500">
                  Para cadastrar um veículo, você precisa cadastrar o proprietário (cliente) primeiro.
                </p>
                <button
                  onClick={closeModal}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-all cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={handleSave} className="p-6 space-y-4">
                {formError && (
                  <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-100">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700 font-medium">{formError}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Placa *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: BRA2E19"
                      value={formPlate}
                      maxLength={8}
                      onChange={(e) => setFormPlate(e.target.value.toUpperCase())}
                      className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:bg-white focus:border-emerald-500 transition-all outline-none font-mono"
                      autoFocus
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Ano
                    </label>
                    <input
                      type="number"
                      placeholder="Ex: 2021"
                      value={formYear}
                      onChange={(e) => setFormYear(e.target.value)}
                      className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:bg-white focus:border-emerald-500 transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Marca *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Toyota"
                      value={formBrand}
                      onChange={(e) => setFormBrand(e.target.value)}
                      className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:bg-white focus:border-emerald-500 transition-all outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Modelo *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Corolla"
                      value={formModel}
                      onChange={(e) => setFormModel(e.target.value)}
                      className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:bg-white focus:border-emerald-500 transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Cliente Proprietário *</span>
                    {clients.length > 0 && (
                      <span className="text-xs font-normal text-slate-400">
                        {clients.length} cadastrado(s)
                      </span>
                    )}
                  </label>
                  <ClientCombobox
                    clients={clients}
                    selectedClientId={formClientId}
                    onSelectClient={(id) => {
                      setFormClientId(id);
                      if (formError) setFormError(null);
                    }}
                    onMergeRemoteClients={handleMergeRemoteClients}
                    error={formError && !formClientId ? formError : null}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Observações
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Notas, observações sobre o carro..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:bg-white focus:border-emerald-500 transition-all outline-none resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2.5 text-white rounded-xl text-sm font-bold shadow-md hover:opacity-90 transition-all cursor-pointer flex items-center justify-center"
                    style={{ backgroundColor: theme.secondary }}
                  >
                    {saving ? 'Salvando...' : editingVehicle ? 'Salvar' : 'Cadastrar'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Veículos</h1>
          <p className="text-slate-500 mt-1">Frota de veículos dos clientes</p>
        </div>
        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-white text-xs sm:text-sm rounded-xl font-bold shadow-md hover:opacity-90 transition-all cursor-pointer"
            style={{ backgroundColor: theme.secondary }}
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            Novo Veículo
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-900 text-sm font-semibold animate-fade-in shadow-xs">
          <div className="flex items-center gap-2.5">
            <Check className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <button
            onClick={() => setNotice(null)}
            className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-700 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}


      {/* Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
          className="flex gap-2 flex-1 w-full"
        >
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquisar por placa, marca ou modelo..."
              value={searchInput}
              onChange={(e) => {
                const val = e.target.value;
                setSearchInput(val);
                if (val === '' && search !== '') {
                  setSearch('');
                  setPage(1);
                }
              }}
              className="block w-full pl-11 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition-all outline-none"
            />
            {loading ? (
              <div className="absolute right-3 top-3.5 flex items-center gap-1">
                <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
              </div>
            ) : searchInput ? (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setSearch('');
                  setPage(1);
                }}
                className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
                title="Limpar pesquisa"
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>
          <button
            type="submit"
            className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-xs shrink-0"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Buscar</span>
          </button>
        </form>
        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl shrink-0 self-end sm:self-auto">
          {filtered.length} veículo(s)
        </span>
      </div>

      {/* Cards List */}
      {filtered.length === 0 ? (
        <EmptyState message={search ? 'Nenhum veículo encontrado com os dados digitados' : 'Nenhum veículo cadastrado. Clique em "Novo Veículo" para começar.'} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filtered.map((vehicle) => (
              <div
                key={vehicle.id}
                className="group relative bg-white border border-slate-200/80 rounded-2xl p-5 hover:shadow-md hover:border-amber-400/80 transition-all flex flex-col justify-between gap-4"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    {/* Plate Badge styled like Mercosul plate */}
                    <div className="inline-flex flex-col border border-slate-900 rounded-lg bg-white min-w-[105px] text-center overflow-hidden shadow-xs shrink-0 font-mono border-2">
                      <div className="bg-blue-700 text-[8px] font-black text-white px-2 py-0.5 tracking-widest uppercase flex items-center justify-between">
                        <span>BRASIL</span>
                        <span className="text-amber-300 font-extrabold text-[7px]">BR</span>
                      </div>
                      <span className="text-base font-black text-slate-950 px-3 py-0.5 tracking-wider font-mono">
                        {vehicle.plate}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(vehicle)}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                        title="Editar veículo"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteVehicleCard(vehicle)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                        title="Excluir veículo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div>
                      <h3 className="font-black text-base text-slate-900 group-hover:text-amber-700 transition-colors leading-snug">
                        {vehicle.brand} {vehicle.model}
                      </h3>
                      {vehicle.year && (
                        <p className="text-xs text-slate-400 font-bold mt-0.5">Ano Fabricação / Modelo: {vehicle.year}</p>
                      )}
                    </div>

                    <div
                      className={`flex items-center gap-2 text-xs font-semibold p-2.5 rounded-xl border ${
                        getVehicleOwnerName(vehicle) !== 'Sem proprietário'
                          ? 'text-slate-700 bg-slate-50 border-slate-100'
                          : 'text-amber-700 bg-amber-50 border-amber-200/80'
                      }`}
                    >
                      <User
                        className={`w-4 h-4 shrink-0 ${
                          getVehicleOwnerName(vehicle) !== 'Sem proprietário' ? 'text-sky-600' : 'text-amber-600'
                        }`}
                      />
                      <span className="truncate">{getVehicleOwnerName(vehicle)}</span>
                    </div>

                    {vehicle.notes && (
                      <div className="flex items-start gap-2.5 text-xs text-slate-700 bg-amber-50/80 p-3 rounded-xl border border-amber-200/80">
                        <StickyNote className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <span className="font-bold text-amber-900 block text-[11px] uppercase tracking-wider mb-0.5">
                            OBSERVAÇÕES:
                          </span>
                          <p className="whitespace-pre-wrap break-words leading-relaxed font-medium text-slate-800">
                            {vehicle.notes}
                          </p>
                        </div>
                      </div>
                    )}

                    {onNavigate && (
                      <button
                        onClick={() => onNavigate('orders', { searchInput: vehicle.plate, search: vehicle.plate, page: 1 }, { searchInput, search, page })}
                        className="w-full mt-2 py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <ClipboardList className="w-3.5 h-3.5 text-amber-700" />
                        <span>Ver Serviços desta Placa</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Bar */}
          {Math.ceil(totalCount / pageSize) > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <p className="text-xs text-slate-500 font-medium">
                Página <strong className="text-slate-800">{page}</strong> de <strong className="text-slate-800">{Math.ceil(totalCount / pageSize)}</strong> ({totalCount} veículos no total)
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
                  {page} / {Math.ceil(totalCount / pageSize)}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(Math.ceil(totalCount / pageSize), p + 1))}
                  disabled={page >= Math.ceil(totalCount / pageSize)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span>Próxima</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}


    </div>
  );
}
