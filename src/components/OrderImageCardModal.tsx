import React, { useState, useEffect } from 'react';
import { generateOrderImageBlob } from '@/src/lib/orderImageUtils';
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

  const numDisplay = orderNumber ? orderNumber.toUpperCase() : order.id.slice(0, 8).toUpperCase();
  const plate = (order?.vehicles?.plate || '').trim();
  const vehicleDisplay = `${order?.vehicles?.brand || ''} ${order?.vehicles?.model || ''}`.trim() || 'Veículo';

  // Obter Blob da imagem
  const getImageBlob = async (): Promise<Blob | null> => {
    if (blobCache) return blobCache;
    return await generateOrderImageBlob(order, orderNumber);
  };

  // 1. Compartilhar Direto no WhatsApp (Mobile / Web Share API)
  const handleShareWhatsApp = async () => {
    try {
      setGenerating(true);
      const blob = await getImageBlob();
      if (!blob) throw new Error('Falha ao gerar arquivo da imagem');

      const fileName = `OS_${numDisplay}_${order.clients?.name?.replace(/\s+/g, '_') || 'cliente'}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      // Se o navegador suportar compartilhamento de arquivo (Android / iOS / Chrome)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
        });
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 3000);
      } else {
        // Fallback: Baixar a imagem e orientar o envio
        handleDownloadImage();
        setErrorMessage('Seu navegador não suporta compartilhamento direto de imagem. A imagem foi baixada! Basta anexá-la como foto no WhatsApp.');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Erro ao compartilhar:', err);
        handleDownloadImage();
      }
    } finally {
      setGenerating(false);
    }
  };

  // 2. Copiar Imagem para a Área de Transferência (Para colar no WhatsApp Web com Ctrl+V)
  const handleCopyImage = async () => {
    try {
      setGenerating(true);
      const blob = await getImageBlob();
      if (!blob) throw new Error('Falha ao gerar blob');

      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': blob,
          }),
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } else {
        throw new Error('Área de transferência não suportada');
      }
    } catch (err: any) {
      console.error('Erro ao copiar imagem:', err);
      // Fallback para download
      handleDownloadImage();
      setErrorMessage('Não foi possível copiar diretamente. A imagem foi salva em Downloads!');
    } finally {
      setGenerating(false);
    }
  };

  // 3. Baixar Imagem PNG
  const handleDownloadImage = async () => {
    try {
      setGenerating(true);
      const blob = await getImageBlob();
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `OS_${numDisplay}_${plate || 'servico'}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao baixar imagem:', err);
    } finally {
      setGenerating(false);
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
                Orçamento em Imagem (Para WhatsApp)
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Formato foto otimizado para abrir direto na tela do celular sem dar zoom
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
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-100 flex flex-col items-center justify-center min-h-[360px]">
          {generating && !previewDataUrl ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-sm font-bold text-slate-700">Gerando imagem em alta resolução...</p>
              <p className="text-xs text-slate-400">Otimizando fontes e contraste para telas de celular</p>
            </div>
          ) : previewDataUrl ? (
            <div className="w-full max-w-sm rounded-2xl shadow-xl overflow-hidden border border-slate-300 bg-white">
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
            {/* 1. WhatsApp / Compartilhar */}
            <button
              onClick={handleShareWhatsApp}
              disabled={generating}
              className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {shareSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Enviado!</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>WhatsApp (Foto)</span>
                </>
              )}
            </button>

            {/* 2. Copiar Imagem (Para colar no WhatsApp Web com Ctrl+V) */}
            <button
              onClick={handleCopyImage}
              disabled={generating}
              className="py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              title="Copia a imagem para você só dar Ctrl + V na conversa do WhatsApp Web"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Imagem Copiada!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar Imagem (Ctrl+V)</span>
                </>
              )}
            </button>

            {/* 3. Baixar Foto */}
            <button
              onClick={handleDownloadImage}
              disabled={generating}
              className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs sm:text-sm border border-slate-200 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>Baixar Imagem</span>
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
            <span className="flex items-center gap-1">
              💡 <strong>Dica WhatsApp Web:</strong> Clique em <em>"Copiar Imagem"</em> e aperte <strong>Ctrl+V</strong> no WhatsApp.
            </span>
            <button
              onClick={onClose}
              className="font-bold text-slate-600 hover:text-slate-900 cursor-pointer px-2 py-1"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
