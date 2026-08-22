import React, { useState, useEffect } from 'react';
import {
  generateOrderImageBlob,
  copyOrderImageToClipboard,
  downloadOrderImageFile,
  sendOrderImageToWhatsApp,
  shareOrderImageNatively,
} from '@/src/lib/orderImageUtils';
import {
  X,
  Share2,
  Copy,
  Download,
  Check,
  Smartphone,
  Send,
  Loader2,
  FileText,
  Sparkles,
  AlertCircle,
  Car,
  User,
  Calendar,
  Gauge,
  Wrench,
  Package,
} from 'lucide-react';
import { formatCurrency, formatDate, formatPhone } from '@/src/lib/theme';
import { parseItemDescription } from '@/src/lib/serviceItemUtils';

interface OrderImageCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  orderNumber: string;
}

export const OrderImageCardModal: React.FC<OrderImageCardModalProps> = ({
  isOpen,
  onClose,
  order,
  orderNumber,
}) => {
  const [generating, setGenerating] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [blobCache, setBlobCache] = useState<Blob | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canNativeShare, setCanNativeShare] = useState(false);

  // Verifica suporte a compartilhamento nativo de arquivo (Mobile)
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.canShare) {
      try {
        const dummyFile = new File([''], 'test.png', { type: 'image/png' });
        setCanNativeShare(navigator.canShare({ files: [dummyFile] }));
      } catch {
        setCanNativeShare(false);
      }
    }
  }, []);

  // Gera a imagem ao abrir o modal
  useEffect(() => {
    if (!isOpen || !order) return;

    let isMounted = true;
    setGenerating(true);
    setErrorMessage(null);

    (async () => {
      try {
        const blob = await generateOrderImageBlob(order, orderNumber);
        if (!blob) throw new Error('Não foi possível gerar a imagem');
        if (isMounted) {
          setBlobCache(blob);
          const url = URL.createObjectURL(blob);
          setPreviewDataUrl(url);
          setGenerating(false);
        }
      } catch (err: any) {
        console.error('Erro ao gerar imagem:', err);
        if (isMounted) {
          setErrorMessage('Não foi possível gerar a imagem automaticamente.');
          setGenerating(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isOpen, order, orderNumber]);

  if (!isOpen || !order) return null;

  const numDisplay = orderNumber ? orderNumber.toUpperCase() : (order.id ? order.id.slice(0, 8).toUpperCase() : '');
  const plate = (order?.vehicles?.plate || '').trim();
  const vehicleDisplay = `${order?.vehicles?.brand || ''} ${order?.vehicles?.model || ''}`.trim() || 'Veículo';
  const clientPhone = order.clients?.phone ? order.clients.phone.replace(/\D/g, '') : '';
  const clientName = order.clients?.name || 'Cliente';

  // 1. Compartilhar Direto no WhatsApp (Mobile ou Cópia + Abertura Web)
  const handleShareWhatsApp = async () => {
    try {
      setErrorMessage(null);
      // Se for celular / navegador com Web Share nativo de arquivos
      if (canNativeShare) {
        const res = await shareOrderImageNatively(order, orderNumber);
        if (res.success) {
          setShareSuccess(true);
          setTimeout(() => setShareSuccess(false), 4000);
          return;
        }
      }

      // No computador / WhatsApp Web: copia a foto e abre o WhatsApp na conversa do cliente
      const res = await sendOrderImageToWhatsApp(order, orderNumber, clientPhone);
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 4000);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Erro ao compartilhar:', err);
        setErrorMessage('Não foi possível abrir o compartilhamento. Você pode baixar a imagem abaixo.');
      }
    }
  };

  // 2. Copiar Imagem para a Área de Transferência
  const handleCopyImage = async () => {
    try {
      const success = await copyOrderImageToClipboard(order, orderNumber);
      if (success) {
        setCopied(true);
        setErrorMessage(null);
        setTimeout(() => setCopied(false), 3000);
      } else {
        setErrorMessage('Não foi possível copiar diretamente para a área de transferência. Use o botão "Baixar Foto" para salvar o arquivo.');
      }
    } catch (err: any) {
      console.error('Erro ao copiar imagem:', err);
      setErrorMessage('Não foi possível gravar na área de transferência. Use o botão "Baixar Foto".');
    }
  };

  // 3. Baixar Imagem PNG
  const handleDownloadImage = () => {
    try {
      const ok = downloadOrderImageFile(order, orderNumber);
      if (!ok) {
        setErrorMessage('Não foi possível realizar o download.');
      }
    } catch (err) {
      console.error('Erro ao baixar imagem:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-gray-100 overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Header do Modal */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                Foto do Orçamento (WhatsApp)
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Imagem em alta resolução com visual moderno para visualização no celular
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200/60 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensagem de Erro ou Alerta */}
        {errorMessage && (
          <div className="mx-4 mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs font-medium flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Área de Visualização */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-100 flex flex-col items-center justify-center min-h-[340px]">
          {generating && !previewDataUrl ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-sm font-bold text-slate-700">Gerando imagem da OS...</p>
              <p className="text-xs text-slate-400">Formatando dados e itens da ordem</p>
            </div>
          ) : previewDataUrl ? (
            <div className="w-full max-w-sm rounded-2xl shadow-xl overflow-hidden border border-slate-300 bg-white group relative">
              <img
                src={previewDataUrl}
                alt="Prévia da Ordem de Serviço"
                className="w-full h-auto object-contain block"
              />
            </div>
          ) : null}
        </div>

        {/* Botões de Ação */}
        <div className="p-4 sm:p-5 border-t border-gray-100 bg-white space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            {/* 1. Abrir WhatsApp / Compartilhar */}
            <button
              onClick={handleShareWhatsApp}
              disabled={generating}
              className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              title="Abre a conversa no WhatsApp e copia a foto para colar (Ctrl+V)"
            >
              {shareSuccess ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>WhatsApp Aberto!</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>{canNativeShare ? 'Enviar Foto no WhatsApp' : 'Abrir WhatsApp'}</span>
                </>
              )}
            </button>

            {/* 2. Copiar Foto para a Área de Transferência */}
            <button
              onClick={handleCopyImage}
              disabled={generating}
              className="py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              title="Copia a imagem para você colar com Ctrl + V no WhatsApp"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Foto Copiada!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar Foto (Ctrl+V)</span>
                </>
              )}
            </button>

            {/* 3. Baixar Foto */}
            <button
              onClick={handleDownloadImage}
              disabled={generating}
              className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs sm:text-sm border border-slate-200 transition-all cursor-pointer flex items-center justify-center gap-2"
              title="Salva o arquivo PNG no seu computador"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>Baixar Foto (PNG)</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-500 gap-2 pt-1">
            <span className="flex items-center gap-1.5 text-slate-600 font-medium">
              💡 <strong>Como funciona no WhatsApp Web:</strong> A foto é copiada para sua Área de Transferência. Ao abrir o WhatsApp, basta dar <strong>Ctrl + V</strong> ou arrastar o arquivo baixado.
            </span>
            <button
              onClick={onClose}
              className="self-end sm:self-auto font-bold text-slate-600 hover:text-slate-900 cursor-pointer px-2 py-1"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
