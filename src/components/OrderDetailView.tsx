import React, { useEffect, useState, useCallback } from 'react';
import { supabase, type OrderItem } from '@/src/lib/supabase';
import { theme, formatDate, formatCurrency, formatPhone, isInvalidPhone } from '@/src/lib/theme';
import { getSingleOrderNumber } from '@/src/lib/orderUtils';
import { formatItemDescription, parseItemDescription } from '@/src/lib/serviceItemUtils';
import { LoadingState, ErrorState } from './States';
import { exportOrderToPdf } from '@/src/lib/exportPdf';
import {
  ArrowLeft,
  User,
  Car,
  Calendar,
  Gauge,
  Wrench,
  Package,
  Plus,
  X,
  Check,
  Trash2,
  Pencil,
  FileDown,
  AlertCircle,
  HelpCircle,
  Send,
  Share2,
  Copy,
  CheckCheck,
  Phone,
  MessageSquare,
} from 'lucide-react';

type OrderDetail = {
  id: string;
  order_date: string;
  mileage: number | null;
  status: string;
  vehicle_id?: string;
  clients: { name: string; phone: string | null; notes?: string | null };
  vehicles: { id?: string; plate: string; brand: string; model: string; year: number | null; notes?: string | null };
  order_items: OrderItem[];
};

interface OrderDetailViewProps {
  orderId: string;
  onBack: () => void;
  onNavigate?: (view: string, params?: any) => void;
}

export default function OrderDetailView({ orderId, onBack, onNavigate }: OrderDetailViewProps) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [addType, setAddType] = useState<'servico' | 'peca'>('servico');
  const [addTitle, setAddTitle] = useState('');
  const [addPrice, setAddPrice] = useState('');
  const [addDetails, setAddDetails] = useState<string[]>([]);
  const [addError, setAddError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [forwardPhone, setForwardPhone] = useState('');
  const [forwardError, setForwardError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const loadOrder = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('service_orders')
        .select('id, order_date, mileage, status, vehicle_id, clients(name, phone, notes), vehicles(id, plate, brand, model, year, notes), order_items(*)')
        .eq('id', orderId)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Serviço não encontrado');
      const orderObj = data as unknown as OrderDetail;
      setOrder(orderObj);

      const num = await getSingleOrderNumber(
        orderObj.id,
        orderObj.vehicle_id || orderObj.vehicles?.id,
        orderObj.vehicles?.plate
      );
      setOrderNumber(num);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar serviço');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addTitle.trim()) {
      setAddError(addType === 'servico' ? 'Informe o nome do serviço' : 'Informe a descrição da peça');
      return;
    }
    setSaving(true);
    setAddError(null);
    try {
      const priceVal = parseFloat(addPrice.replace(',', '.')) || 0;
      const finalDescription = addType === 'servico'
        ? formatItemDescription(addTitle, addDetails)
        : addTitle.trim();

      if (editingItemId) {
        const { error } = await supabase
          .from('order_items')
          .update({
            item_type: addType,
            description: finalDescription,
            price: priceVal,
          })
          .eq('id', editingItemId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('order_items').insert({
          order_id: orderId,
          item_type: addType,
          description: finalDescription,
          price: priceVal,
        });
        if (error) throw error;
      }

      setAddTitle('');
      setAddPrice('');
      setAddDetails([]);
      setEditingItemId(null);
      setAddModalVisible(false);
      loadOrder();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Erro ao salvar item');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!window.confirm('Tem certeza que deseja remover este item?')) return;
    setDeleting(itemId);
    try {
      const { error } = await supabase.from('order_items').delete().eq('id', itemId);
      if (error) throw error;
      loadOrder();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleStatus = async () => {
    if (!order) return;
    const newStatus = order.status === 'aberta' ? 'fechada' : 'aberta';
    setToggling(true);
    try {
      const { error } = await supabase
        .from('service_orders')
        .update({ status: newStatus })
        .eq('id', orderId);
      if (error) throw error;
      loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar status');
    } finally {
      setToggling(false);
    }
  };

  const openAddModal = (type: 'servico' | 'peca') => {
    setEditingItemId(null);
    setAddType(type);
    setAddTitle('');
    setAddPrice('');
    setAddDetails([]);
    setAddError(null);
    setAddModalVisible(true);
  };

  const openEditModal = (item: OrderItem) => {
    setEditingItemId(item.id);
    setAddType(item.item_type);
    const { title, details } = parseItemDescription(item.description);
    setAddTitle(title);
    setAddPrice(item.price ? String(item.price).replace('.', ',') : '');
    setAddDetails(details);
    setAddError(null);
    setAddModalVisible(true);
  };

  const addDetailToModal = () => {
    setAddDetails((prev) => [...prev, '']);
  };

  const updateDetailInModal = (index: number, val: string) => {
    setAddDetails((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const removeDetailFromModal = (index: number) => {
    setAddDetails((prev) => prev.filter((_, i) => i !== index));
  };

  const buildWhatsAppMessage = useCallback(() => {
    if (!order) return '';
    const rawNum = orderNumber ? orderNumber.toUpperCase() : order.id.slice(0, 8).toUpperCase();
    const numDisplay = rawNum.startsWith('#') ? rawNum : `#${rawNum}`;
    const servs = order.order_items.filter((i) => i.item_type === 'servico');
    const pcs = order.order_items.filter((i) => i.item_type === 'peca');
    const subtotalPecas = pcs.reduce((acc, item) => acc + Number(item.price), 0);
    const tot = order.order_items.reduce((acc, item) => acc + Number(item.price), 0);

    let message = `*ORDEM DE SERVIÇO Nº ${numDisplay}*\n\n`;
    message += `*Cliente:* ${order.clients?.name || 'Cliente'}\n`;
    
    // Tratamento limpo para os dados do veículo evitando repetições
    const brand = (order.vehicles?.brand || '').trim();
    const model = (order.vehicles?.model || '').trim();
    const plate = (order.vehicles?.plate || '').trim();

    let vehicleText = '';
    if (brand && model) {
      vehicleText = `${brand} ${model}`;
    } else {
      vehicleText = brand || model || 'Não informado';
    }
    if (plate) {
      vehicleText += ` (${plate})`;
    }
    
    message += `*Veículo:* ${vehicleText}\n`;
    
    if (order.mileage !== null && order.mileage !== undefined && order.mileage !== 0) {
      message += `*KM:* ${Number(order.mileage).toLocaleString('pt-BR')} km\n`;
    } else if (order.mileage === 0) {
      message += `*KM:* 0 km\n`;
    }
    
    message += `*Data:* ${formatDate(order.order_date)}\n\n`;

    if (servs.length > 0) {
      message += `*Serviços:*\n`;
      servs.forEach((s) => {
        const { title, details } = parseItemDescription(s.description);
        const priceStr = formatCurrency(Number(s.price));
        message += `• *${title}* — *${priceStr}*\n`;
        if (details.length > 0) {
          details.forEach((d) => {
            message += `  • ${d}\n`;
          });
        }
      });
      message += `\n`;
    }

    if (pcs.length > 0) {
      message += `*Peças:*\n`;
      pcs.forEach((p) => {
        const priceStr = formatCurrency(Number(p.price));
        message += `  • ${p.description} — *${priceStr}*\n`;
      });
      message += `──────────────────────\n`;
      const subtotalPecasStr = formatCurrency(subtotalPecas);
      message += `*Subtotal Peças: ${subtotalPecasStr}*\n\n`;
    }

    message += `══════════════════════\n`;
    message += `*VALOR TOTAL: ${formatCurrency(tot)}*\n`;
    message += `══════════════════════`;
    return message;
  }, [order, orderNumber]);

  const handleShareClientWhatsApp = () => {
    if (!order) return;
    const hasValid = !isInvalidPhone(order.clients?.phone);
    if (!hasValid || !order.clients?.phone) {
      setForwardPhone('');
      setForwardError('O cliente não possui telefone cadastrado. Digite o número desejado abaixo para enviar:');
      setForwardModalOpen(true);
      return;
    }
    const rawPhone = order.clients.phone.replace(/\D/g, '');
    const formattedPhone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;
    const message = buildWhatsAppMessage();
    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  const handleForwardToCustomPhone = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!order) return;
    const cleanDigits = forwardPhone.replace(/\D/g, '');
    if (cleanDigits.length < 10) {
      setForwardError('Informe um telefone válido com DDD (mínimo 10 dígitos)');
      return;
    }
    const formattedPhone = cleanDigits.startsWith('55') ? cleanDigits : `55${cleanDigits}`;
    const message = buildWhatsAppMessage();
    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
    setForwardModalOpen(false);
  };

  const handleForwardChooseContact = () => {
    if (!order) return;
    const message = buildWhatsAppMessage();
    const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
    setForwardModalOpen(false);
  };

  const handleCopyMessage = async () => {
    const msg = buildWhatsAppMessage();
    if (!msg) return;
    try {
      await navigator.clipboard.writeText(msg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  if (loading && !order) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!order) return <ErrorState message="Serviço não encontrado" />;

  const servicos = order.order_items.filter((i) => i.item_type === 'servico');
  const pecas = order.order_items.filter((i) => i.item_type === 'peca');
  const totalServicos = servicos.reduce((s, i) => s + Number(i.price), 0);
  const totalPecas = pecas.reduce((s, i) => s + Number(i.price), 0);
  const total = totalServicos + totalPecas;
  const isOpen = order.status === 'aberta';

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 border-b border-gray-100 pb-4">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            onClick={onBack}
            className="p-1.5 sm:p-2 hover:bg-slate-100 rounded-xl transition-all cursor-pointer text-slate-500 shrink-0"
            title="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-tight">Serviço</h1>
              <span className="font-mono text-xs sm:text-sm font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 sm:px-2.5 py-0.5 rounded-lg">
                #{orderNumber || order.id.slice(0, 8)}
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-bold leading-5 ${
                  isOpen ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {isOpen ? 'Aberta' : 'Fechada'}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 font-mono">ID: {order.id}</p>
          </div>
        </div>

        {/* Header Actions - Compact and Responsive */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {!isOpen && (
            <>
              <button
                onClick={() => exportOrderToPdf(order, orderNumber)}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white hover:bg-slate-50 text-sky-700 text-xs sm:text-sm font-bold rounded-xl border border-sky-200 shadow-2xs transition-all cursor-pointer"
                title="Gerar e salvar orçamento em PDF"
              >
                <FileDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-600 shrink-0" />
                <span>PDF</span>
              </button>

              <button
                onClick={handleShareClientWhatsApp}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
                title={order.clients?.phone ? `Enviar para o cliente (${formatPhone(order.clients.phone)})` : 'Enviar WhatsApp para cliente'}
              >
                <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>WhatsApp</span>
              </button>

              <button
                onClick={() => {
                  setForwardPhone('');
                  setForwardError(null);
                  setForwardModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs sm:text-sm font-bold rounded-xl border border-emerald-200 shadow-2xs transition-all cursor-pointer"
                title="Encaminhar discriminação para outro telefone ou contato"
              >
                <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-700 shrink-0" />
                <span>Encaminhar</span>
              </button>
            </>
          )}

          <button
            onClick={handleToggleStatus}
            disabled={toggling}
            className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-xl shadow-2xs transition-all cursor-pointer ${
              isOpen
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-white hover:bg-slate-50 text-slate-700 border border-gray-200'
            }`}
          >
            {isOpen ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> : <Wrench className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />}
            <span>{toggling ? 'Atualizando...' : isOpen ? 'Concluir' : 'Reabrir'}</span>
          </button>

          <button
            onClick={() => setShowHelpModal(true)}
            title="Instruções de envio ao cliente"
            className="inline-flex items-center justify-center p-1.5 sm:p-2 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl border border-sky-200 transition-all cursor-pointer font-bold shrink-0 shadow-2xs"
          >
            <HelpCircle className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>
        </div>
      </div>

      {/* Instructions Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl space-y-4 border border-gray-100 relative">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2 text-sky-800 font-extrabold text-sm">
                <HelpCircle className="w-5 h-5 text-sky-600" />
                <span>Como encaminhar PDF e resumo</span>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <p className="font-bold text-slate-800">1. Gerar o arquivo PDF:</p>
                <p className="text-slate-600">
                  Clique no botão <strong>"PDF"</strong> e selecione a opção <strong>"Salvar como PDF"</strong> no seu computador ou celular.
                </p>
              </div>

              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 space-y-1">
                <p className="font-bold text-emerald-900">2. Enviar por WhatsApp:</p>
                <p className="text-emerald-800">
                  Clique em <strong>"WhatsApp"</strong> para enviar diretamente ao telefone cadastrado do cliente, ou clique em <strong>"Encaminhar"</strong> para digitar outro número ou selecionar qualquer contato/grupo.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <p className="font-bold text-slate-800">3. Anexar o PDF no WhatsApp:</p>
                <p className="text-slate-600">
                  Na conversa do WhatsApp, clique no ícone de clipe (<strong>📎 Anexo</strong>) &gt; <strong>Documento</strong> e selecione o PDF gerado.
                </p>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-xs"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Client Box */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-400 font-semibold text-xs uppercase tracking-wider mb-2">
              <User className="w-4 h-4" />
              <span>Cliente</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900">{order.clients?.name ?? '—'}</h3>
              <p className="text-sm text-slate-500 mt-1 font-medium">{formatPhone(order.clients?.phone)}</p>
              {order.clients?.notes && (
                <p className="text-xs text-slate-600 bg-amber-50/80 p-2 rounded-lg border border-amber-200/80 mt-2 whitespace-pre-wrap font-medium">
                  <span className="font-bold text-amber-900">Observações:</span> {order.clients.notes}
                </p>
              )}
            </div>
          </div>
          {onNavigate && order.clients?.name && (
            <button
              onClick={() => onNavigate('orders', { searchInput: order.clients.name, search: order.clients.name, page: 1 })}
              className="text-xs font-extrabold text-sky-700 hover:text-sky-900 hover:underline inline-flex items-center gap-1 transition-all cursor-pointer pt-2"
            >
              <span>Ver todos os serviços do cliente →</span>
            </button>
          )}
        </div>

        {/* Vehicle Box */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-400 font-semibold text-xs uppercase tracking-wider mb-2">
              <Car className="w-4 h-4" />
              <span>Veículo</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900">
                {order.vehicles?.brand} {order.vehicles?.model}
                {order.vehicles?.year ? ` (${order.vehicles.year})` : ''}
              </h3>
              <span className="inline-block mt-1 text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono border border-slate-200">
                {order.vehicles?.plate ?? '—'}
              </span>
              {order.vehicles?.notes && (
                <p className="text-xs text-slate-600 bg-amber-50/80 p-2 rounded-lg border border-amber-200/80 mt-2 whitespace-pre-wrap font-medium">
                  <span className="font-bold text-amber-900">Observações:</span> {order.vehicles.notes}
                </p>
              )}
            </div>
          </div>
          {onNavigate && order.vehicles?.plate && (
            <button
              onClick={() => onNavigate('orders', { searchInput: order.vehicles.plate, search: order.vehicles.plate, page: 1 })}
              className="text-xs font-extrabold text-sky-700 hover:text-sky-900 hover:underline inline-flex items-center gap-1 transition-all cursor-pointer pt-2"
            >
              <span>Ver todos os serviços desta placa →</span>
            </button>
          )}
        </div>

        {/* Date / Mileage Box */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-slate-400 font-semibold text-xs uppercase tracking-wider">
            <Calendar className="w-4 h-4" />
            <span>Data & Quilometragem</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold">Data de Abertura</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">{formatDate(order.order_date)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold">Quilometragem</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">
                {order.mileage != null ? `${order.mileage.toLocaleString('pt-BR')} km` : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Services List Card */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-xs overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-sky-600" />
            <h2 className="text-base font-extrabold text-slate-900">Serviços Executados (Mão de Obra)</h2>
          </div>
          {isOpen && (
            <button
              onClick={() => openAddModal('servico')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 text-xs font-bold rounded-lg transition-all cursor-pointer border border-sky-100"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar Serviço
            </button>
          )}
        </div>

        {servicos.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-slate-400">Nenhum serviço adicionado a este atendimento.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {servicos.map((item) => {
              const { title, details } = parseItemDescription(item.description);
              return (
                <div key={item.id} className="p-4 sm:p-5 hover:bg-slate-50/30 transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900">{title}</span>
                      {details.length > 0 && (
                        <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-100 px-1.5 py-0.5 rounded">
                          {details.length} {details.length === 1 ? 'item detalhado' : 'itens detalhados'}
                        </span>
                      )}
                    </div>
                    {details.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-slate-600 bg-slate-50/80 p-3 rounded-xl border border-slate-200/60 font-normal">
                        {details.map((detail, dIdx) => (
                          <li key={dIdx} className="flex items-start gap-2">
                            <span className="text-sky-500 font-bold leading-none mt-0.5">•</span>
                            <span className="leading-relaxed">{detail}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <span className="text-sm font-black text-slate-900">
                      {formatCurrency(Number(item.price))}
                    </span>
                    {isOpen && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(item)}
                          className="text-slate-400 hover:text-sky-700 p-1.5 rounded-lg hover:bg-sky-50 transition-all cursor-pointer"
                          title="Editar serviço e detalhes"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          disabled={deleting === item.id}
                          className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-all cursor-pointer"
                          title="Excluir serviço"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="bg-slate-50/50 flex items-center justify-between p-4 px-5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Subtotal Serviços</span>
              <span className="text-sm font-extrabold text-slate-800">{formatCurrency(totalServicos)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Parts List Card */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-xs overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-extrabold text-slate-900">Peças Substituídas</h2>
          </div>
          {isOpen && (
            <button
              onClick={() => openAddModal('peca')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold rounded-lg transition-all cursor-pointer border border-emerald-100"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar Peça
            </button>
          )}
        </div>

        {pecas.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-slate-400">Nenhuma peça adicionada a este atendimento.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pecas.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 sm:p-5 hover:bg-slate-50/30 transition-all">
                <span className="text-sm font-medium text-slate-800">{item.description}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black text-slate-900">
                    {formatCurrency(Number(item.price))}
                  </span>
                  {isOpen && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(item)}
                        className="text-slate-400 hover:text-emerald-700 p-1.5 rounded-lg hover:bg-emerald-50 transition-all cursor-pointer"
                        title="Editar peça"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        disabled={deleting === item.id}
                        className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-all cursor-pointer"
                        title="Excluir peça"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div className="bg-slate-50/50 flex items-center justify-between p-4 px-5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Subtotal Peças</span>
              <span className="text-sm font-extrabold text-slate-800">{formatCurrency(totalPecas)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Grand Total Display */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Total Geral do Serviço</h3>
          <p className="text-3xl font-black text-white mt-1">{formatCurrency(total)}</p>
        </div>
        <div className="text-xs text-slate-400 max-w-xs font-medium leading-relaxed">
          {isOpen
            ? 'Este serviço está aberto. Você ainda pode adicionar, editar ou excluir serviços e peças conforme o diagnóstico e orçamento.'
            : 'Este serviço está concluído. Para fazer modificações, você precisará reabri-lo primeiro usando os botões superiores.'}
        </div>
      </div>

      {/* Add / Edit Item Modal */}
      {addModalVisible && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl border border-gray-100 overflow-hidden animate-scale-up max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                {addType === 'servico' ? (
                  <Wrench className="w-5 h-5 text-sky-600" />
                ) : (
                  <Package className="w-5 h-5 text-emerald-600" />
                )}
                <h2 className="text-lg font-bold text-slate-900">
                  {editingItemId
                    ? addType === 'servico'
                      ? 'Editar Serviço'
                      : 'Editar Peça'
                    : addType === 'servico'
                    ? 'Adicionar Serviço'
                    : 'Adicionar Peça'}
                </h2>
              </div>
              <button
                onClick={() => setAddModalVisible(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-6 space-y-4 overflow-y-auto flex-1">
              {addError && (
                <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-100">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 font-medium">{addError}</p>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {addType === 'servico' ? 'Nome do Serviço (Mão de Obra) *' : 'Descrição da Peça *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={addType === 'servico' ? 'Ex: Mão de Obra, Revisão Geral...' : 'Ex: Filtro de ar cabine'}
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:bg-white focus:border-sky-500 transition-all outline-none font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Valor Total (R$)
                </label>
                <input
                  type="text"
                  placeholder="0,00"
                  value={addPrice}
                  onChange={(e) => setAddPrice(e.target.value)}
                  className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:bg-white focus:border-sky-500 transition-all outline-none font-bold"
                />
              </div>

              {/* Detalhamento dos Itens do Serviço (sem preço) */}
              {addType === 'servico' && (
                <div className="pt-3 border-t border-gray-100 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-bold text-sky-900">
                        Detalhamento do Serviço (sem preço)
                      </label>
                      <p className="text-[11px] text-slate-500">
                        Cadastre os itens, peças checadas ou tarefas inclusas nesta mão de obra.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addDetailToModal}
                      className="inline-flex items-center gap-1 text-xs font-bold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 px-2.5 py-1.5 rounded-lg border border-sky-200 transition-all cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      + Adicionar item
                    </button>
                  </div>

                  {addDetails.length > 0 ? (
                    <div className="space-y-2 pt-1 max-h-48 overflow-y-auto pr-1">
                      {addDetails.map((detail, dIdx) => (
                        <div key={dIdx} className="flex items-center gap-2">
                          <span className="text-sky-500 font-bold text-xs pl-1">•</span>
                          <input
                            type="text"
                            placeholder={`Item ${dIdx + 1} deste serviço (ex: Troca de pastilhas, sangria de freio...)`}
                            value={detail}
                            onChange={(e) => updateDetailInModal(dIdx, e.target.value)}
                            className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-sky-400 rounded-lg text-slate-800 text-xs transition-all outline-none font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => removeDetailFromModal(dIdx)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all cursor-pointer"
                            title="Remover detalhe"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-sky-50/50 rounded-xl border border-dashed border-sky-200 text-center">
                      <p className="text-xs text-sky-800 font-medium">
                        Nenhum detalhe adicionado ainda. Clique no botão acima para detalhar as atividades deste serviço.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setAddModalVisible(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 text-white rounded-xl text-sm font-bold shadow-md hover:opacity-90 transition-all cursor-pointer flex items-center justify-center"
                  style={{ backgroundColor: theme.accent }}
                >
                  {saving
                    ? 'Salvando...'
                    : editingItemId
                    ? 'Salvar Alterações'
                    : addType === 'servico'
                    ? 'Cadastrar Serviço'
                    : 'Cadastrar Peça'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Encaminhar via WhatsApp */}
      {forwardModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl space-y-4 border border-gray-100 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5 text-slate-900 font-extrabold">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight">Encaminhar por WhatsApp</h2>
                  <p className="text-xs text-slate-500 font-normal">
                    Serviço #{orderNumber || order.id.slice(0, 8)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setForwardModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {forwardError && (
              <div className="flex items-start gap-2.5 p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs font-medium">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{forwardError}</span>
              </div>
            )}

            <form onSubmit={handleForwardToCustomPhone} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Número de Telefone (DDD + Número)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="(00) 00000-0000"
                    value={forwardPhone}
                    onChange={(e) => {
                      setForwardPhone(formatPhone(e.target.value, true));
                      if (forwardError) setForwardError(null);
                    }}
                    className="block w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm font-semibold focus:bg-white focus:border-emerald-500 transition-all outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Digite o número de quem receberá o detalhamento (ex: outro telefone do cliente, sócio, seguradora).
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Enviar para este Número
                </button>
                <button
                  type="button"
                  onClick={handleForwardChooseContact}
                  className="w-full py-2 px-4 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  title="Abre o WhatsApp para você escolher qualquer contato ou grupo na sua lista"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                  Escolher Contato no WhatsApp (sem número prévio)
                </button>
              </div>
            </form>

            {/* Prévia da Mensagem e Copiar */}
            <div className="pt-3 border-t border-gray-100 space-y-2">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-xs font-bold text-sky-700 hover:text-sky-900 transition-colors cursor-pointer"
                >
                  {showPreview ? '▲ Ocultar prévia do texto' : '▼ Ver prévia do texto a enviar'}
                </button>
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Texto</span>
                    </>
                  )}
                </button>
              </div>

              {showPreview && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-[11px] font-mono text-slate-700 whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                  {buildWhatsAppMessage()}
                </div>
              )}
            </div>

            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={() => setForwardModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
