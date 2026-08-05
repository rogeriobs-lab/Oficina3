import React, { useEffect, useState, useCallback } from 'react';
import { supabase, type OrderItem } from '@/src/lib/supabase';
import { theme, formatDate, formatCurrency, formatPhone } from '@/src/lib/theme';
import { getSingleOrderNumber } from '@/src/lib/orderUtils';
import { LoadingState, ErrorState } from './States';
import { exportOrderToPdf, getOrderPdfFile } from '@/src/lib/exportPdf';
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
  FileDown,
  AlertCircle,
  HelpCircle,
  Send,
  Share2,
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
  const [addType, setAddType] = useState<'servico' | 'peca'>('servico');
  const [addDescription, setAddDescription] = useState('');
  const [addPrice, setAddPrice] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);

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

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addDescription.trim()) {
      setAddError('Informe a descrição');
      return;
    }
    setSaving(true);
    setAddError(null);
    try {
      const priceVal = parseFloat(addPrice.replace(',', '.')) || 0;
      const { error } = await supabase.from('order_items').insert({
        order_id: orderId,
        item_type: addType,
        description: addDescription.trim(),
        price: priceVal,
      });
      if (error) throw error;
      setAddDescription('');
      setAddPrice('');
      setAddModalVisible(false);
      loadOrder();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Erro ao adicionar item');
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
    setAddType(type);
    setAddDescription('');
    setAddPrice('');
    setAddError(null);
    setAddModalVisible(true);
  };

  const handleShareWhatsApp = async () => {
    if (!order) return;
    const numDisplay = orderNumber ? orderNumber.toUpperCase() : order.id.slice(0, 8).toUpperCase();
    const pdfInfo = getOrderPdfFile(order, orderNumber);

    // Baixa o arquivo PDF formatado para o dispositivo do usuário
    const downloadUrl = URL.createObjectURL(pdfInfo.blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = downloadUrl;
    downloadLink.download = pdfInfo.filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);

    const rawPhone = order.clients?.phone ? order.clients.phone.replace(/\D/g, '') : '';
    const servs = order.order_items.filter((i) => i.item_type === 'servico');
    const pcs = order.order_items.filter((i) => i.item_type === 'peca');
    const tot = order.order_items.reduce((acc, item) => acc + Number(item.price), 0);

    let message = `*SERVIÇO Nº ${numDisplay}*\n`;
    message += `*Cliente:* ${order.clients?.name || 'Cliente'}\n`;
    message += `*Veículo:* ${order.vehicles?.brand || ''} ${order.vehicles?.model || ''} (${order.vehicles?.plate || ''})\n`;
    if (order.mileage !== null && order.mileage !== undefined && order.mileage !== 0) {
      message += `*Quilometragem:* ${Number(order.mileage).toLocaleString('pt-BR')} km\n`;
    } else if (order.mileage === 0) {
      message += `*Quilometragem:* 0 km\n`;
    }
    message += `*Data:* ${formatDate(order.order_date)}\n\n`;

    if (servs.length > 0) {
      message += `*Serviços:*\n`;
      servs.forEach((s) => {
        message += `• ${s.description}: ${formatCurrency(Number(s.price))}\n`;
      });
      message += `\n`;
    }

    if (pcs.length > 0) {
      message += `*Peças:*\n`;
      pcs.forEach((p) => {
        message += `• ${p.description}: ${formatCurrency(Number(p.price))}\n`;
      });
      message += `\n`;
    }

    message += `*VALOR TOTAL: ${formatCurrency(tot)}*\n\n`;
    message += `📄 *PDF com Formatação Oficial:* Baixamos o arquivo *${pdfInfo.filename}* no seu dispositivo. Anexe-o nesta conversa para enviar o documento completo e formatado ao cliente!`;

    // Se estiver em mobile / navegador que suporta compartilhar arquivo via Web Share API
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfInfo.file] })) {
      try {
        await navigator.share({
          title: `Serviço #${numDisplay}`,
          text: message,
          files: [pdfInfo.file],
        });
        return;
      } catch (err) {
        // Se usuário cancelar o share nativo, continua com o link do WhatsApp
      }
    }

    const formattedPhone = rawPhone ? (rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`) : '';
    const waUrl = formattedPhone
      ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(waUrl, '_blank');
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
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-xl transition-all cursor-pointer text-slate-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold text-slate-900 leading-tight">Serviço</h1>
              <span className="font-mono text-sm font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-lg">
                #{orderNumber || order.id.slice(0, 8)}
              </span>
              <span
                className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-bold leading-5 ${
                  isOpen ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {isOpen ? 'Aberta' : 'Fechada'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-mono">ID: {order.id}</p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {!isOpen && (
            <>
              <button
                onClick={() => exportOrderToPdf(order, orderNumber)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-sky-700 text-sm font-bold rounded-xl border border-sky-100 shadow-xs transition-all cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                Gerar PDF / Imprimir
              </button>

              <button
                onClick={handleShareWhatsApp}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                Enviar por WhatsApp
              </button>
            </>
          )}

          <button
            onClick={handleToggleStatus}
            disabled={toggling}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl shadow-xs transition-all cursor-pointer ${
              isOpen
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-white hover:bg-slate-50 text-slate-700 border border-gray-200'
            }`}
          >
            {isOpen ? <Check className="w-4 h-4" /> : <Wrench className="w-4 h-4" />}
            {toggling ? 'Atualizando...' : isOpen ? 'Concluir Serviço' : 'Reabrir Serviço'}
          </button>

          <button
            onClick={() => setShowHelpModal(true)}
            title="Instruções de envio ao cliente"
            className="inline-flex items-center justify-center p-2.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl border border-sky-200 transition-all cursor-pointer font-bold shrink-0 shadow-xs"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Instructions Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 border border-gray-100 relative">
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
                  Clique no botão <strong>"Gerar PDF / Imprimir"</strong> e selecione a opção <strong>"Salvar como PDF"</strong> no seu computador ou celular.
                </p>
              </div>

              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 space-y-1">
                <p className="font-bold text-emerald-900">2. Enviar mensagem formatada:</p>
                <p className="text-emerald-800">
                  Clique no botão <strong>"Enviar por WhatsApp"</strong> para abrir a conversa com o cliente contendo o resumo do serviço.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <p className="font-bold text-slate-800">3. Anexar o PDF no WhatsApp:</p>
                <p className="text-slate-600">
                  Na conversa do WhatsApp, clique no ícone de clipe (<strong>📎 Anexo</strong>) &gt; <strong>Documento</strong> e selecione o PDF que você salvou.
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
              {order.clients?.phone && (
                <p className="text-sm text-slate-500 mt-1 font-medium">{formatPhone(order.clients.phone)}</p>
              )}
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
            <h2 className="text-base font-extrabold text-slate-900">Serviços Executados</h2>
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
            {servicos.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-5 hover:bg-slate-50/30 transition-all">
                <span className="text-sm font-medium text-slate-800">{item.description}</span>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold text-slate-900">
                    {formatCurrency(Number(item.price))}
                  </span>
                  {isOpen && (
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      disabled={deleting === item.id}
                      className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
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
              <div key={item.id} className="flex items-center justify-between p-5 hover:bg-slate-50/30 transition-all">
                <span className="text-sm font-medium text-slate-800">{item.description}</span>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold text-slate-900">
                    {formatCurrency(Number(item.price))}
                  </span>
                  {isOpen && (
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      disabled={deleting === item.id}
                      className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
            ? 'Este serviço está aberto. Você ainda pode adicionar ou deletar serviços e peças conforme o diagnóstico e orçamento.'
            : 'Este serviço está concluído. Para fazer modificações, você precisará reabri-lo primeiro usando os botões superiores.'}
        </div>
      </div>

      {/* Add Item Modal */}
      {addModalVisible && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-gray-100 overflow-hidden animate-scale-up">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-xl font-bold text-slate-900">
                {addType === 'servico' ? 'Adicionar Serviço' : 'Adicionar Peça'}
              </h2>
              <button
                onClick={() => setAddModalVisible(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="p-6 space-y-4">
              {addError && (
                <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-100">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 font-medium">{addError}</p>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Descrição *
                </label>
                <input
                  type="text"
                  required
                  placeholder={addType === 'servico' ? 'Ex: Alinhamento e balanceamento' : 'Ex: Filtro de ar cabine'}
                  value={addDescription}
                  onChange={(e) => setAddDescription(e.target.value)}
                  className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:bg-white focus:border-sky-500 transition-all outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Valor (R$)
                </label>
                <input
                  type="text"
                  placeholder="0,00"
                  value={addPrice}
                  onChange={(e) => setAddPrice(e.target.value)}
                  className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:bg-white focus:border-sky-500 transition-all outline-none font-medium"
                />
              </div>

              <div className="flex gap-3 pt-4">
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
                  {saving ? 'Cadastrando...' : 'Cadastrar Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
