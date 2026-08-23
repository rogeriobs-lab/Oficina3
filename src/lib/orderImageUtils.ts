import { formatCurrency, formatDate, formatPhone } from '@/src/lib/theme';
import { parseItemDescription } from '@/src/lib/serviceItemUtils';

/**
 * Desenha um retângulo com cantos arredondados no Canvas
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fillColor?: string,
  strokeColor?: string,
  lineWidth: number = 1
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();

  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Quebra texto em múltiplas linhas respeitando a largura máxima
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0] || '';

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + ' ' + word).width;
    if (width < maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Converte dataURL base64 para Blob de forma 100% síncrona
 */
export function dataURLtoBlob(dataurl: string): Blob {
  const arr = dataurl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Renderiza a Ordem de Serviço em um Canvas 2D de forma 100% síncrona
 */
export function generateOrderImageCanvas(order: any, orderNumber: string): HTMLCanvasElement | null {
  if (!order) return null;

  const workshopName = (localStorage.getItem('workshop_name') || 'AUTO MECÂNICA').toUpperCase();
  const workshopCnpj = localStorage.getItem('workshop_cnpj') || '';
  const workshopPhone = localStorage.getItem('workshop_phone') || '';
  const workshopAddress = localStorage.getItem('workshop_address') || '';
  const workshopPix = localStorage.getItem('workshop_pix') || '';

  const servicos = order?.order_items?.filter((i: any) => i.item_type === 'servico') || [];
  const pecas = order?.order_items?.filter((i: any) => i.item_type === 'peca') || [];
  const totalServicos = servicos.reduce((acc: number, item: any) => acc + Number(item.price), 0);
  const totalPecas = pecas.reduce((acc: number, item: any) => acc + Number(item.price), 0);
  const grandTotal = totalServicos + totalPecas;

  const rawBrand = (order?.vehicles?.brand || '').trim();
  const brand = rawBrand.replace(/^ve[íi]culo\s+/i, '').trim();
  const rawModel = (order?.vehicles?.model || '').trim();
  const model = rawModel.replace(/^ve[íi]culo\s+/i, '').trim();
  const plate = (order?.vehicles?.plate || '').trim().toUpperCase();

  let vehicleDisplay = '';
  if (brand && model) {
    if (model.toLowerCase().includes(brand.toLowerCase())) {
      vehicleDisplay = model;
    } else {
      vehicleDisplay = `${brand} ${model}`;
    }
  } else {
    vehicleDisplay = brand || model || 'Não informado';
  }

  const numDisplay = orderNumber ? orderNumber.toUpperCase() : order.id.slice(0, 8).toUpperCase();

  // Largura 480px garante que a tipografia ocupe quase toda a tela do celular sem distorção
  const width = 480;
  const padding = 16;
  const contentWidth = width - padding * 2;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Cálculo da altura necessária
  let estimatedHeight = padding + 8; // Top padding

  // Cabeçalho da Oficina
  estimatedHeight += 38; // Nome oficina
  if (workshopCnpj) estimatedHeight += 24;
  if (workshopPhone) estimatedHeight += 26;
  if (workshopAddress) estimatedHeight += 24;
  estimatedHeight += 20; // Divisor

  // Barra de identificação (OS #)
  estimatedHeight += 64 + 14;

  // Box Cliente e Veículo
  estimatedHeight += 180 + 16;

  // Seção Serviços
  if (servicos.length > 0) {
    estimatedHeight += 44; // Header de serviços
    ctx.font = '700 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    servicos.forEach((s: any) => {
      const { details } = parseItemDescription(s.description);
      estimatedHeight += 44; // Linha do título e valor
      if (details.length > 0) {
        estimatedHeight += details.length * 24 + 4;
      }
    });
    estimatedHeight += 14; // Espaçamento
  }

  // Seção Peças
  if (pecas.length > 0) {
    estimatedHeight += 44; // Header de peças
    pecas.forEach(() => {
      estimatedHeight += 40; // Linha de peça
    });
    estimatedHeight += 14; // Espaçamento
  }

  // Card Total Geral
  estimatedHeight += 96 + 18;

  // Rodapé (apenas Chave Pix se configurada)
  if (workshopPix) estimatedHeight += 52;
  estimatedHeight += padding + 10; // Bottom padding

  // Definir dimensões
  canvas.width = width;
  canvas.height = Math.ceil(estimatedHeight);

  // Fundo branco
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, canvas.height);

  // Moldura externa
  roundRect(ctx, 6, 6, width - 12, canvas.height - 12, 14, '#FFFFFF', '#94A3B8', 2);

  let curY = padding + 10;

  // --- 1. CABEÇALHO OFICINA ---
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0F172A';
  ctx.font = '900 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(workshopName, width / 2, curY);
  curY += 30;

  if (workshopCnpj) {
    ctx.fillStyle = '#334155';
    ctx.font = '700 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`CNPJ: ${workshopCnpj}`, width / 2, curY);
    curY += 22;
  }

  if (workshopPhone) {
    ctx.fillStyle = '#0F172A';
    ctx.font = '800 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`Tel / WhatsApp: ${workshopPhone}`, width / 2, curY);
    curY += 24;
  }

  if (workshopAddress) {
    ctx.fillStyle = '#475569';
    ctx.font = '600 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(workshopAddress, width / 2, curY);
    curY += 22;
  }

  curY += 4;
  // Linha divisória
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding, curY);
  ctx.lineTo(width - padding, curY);
  ctx.stroke();
  curY += 16;

  // --- 2. BARRA DE IDENTIFICAÇÃO (OS #) ---
  const barH = 58;
  roundRect(ctx, padding, curY, contentWidth, barH, 12, '#0F172A');

  // OS #
  ctx.textAlign = 'left';
  ctx.fillStyle = '#94A3B8';
  ctx.font = '800 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('ORDEM DE SERVIÇO', padding + 16, curY + 22);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 24px "Courier New", Courier, monospace';
  ctx.fillText(`#${numDisplay}`, padding + 16, curY + 48);

  curY += barH + 14;

  // --- 3. BOX DADOS DO CLIENTE & VEÍCULO ---
  const boxH = 175;
  roundRect(ctx, padding, curY, contentWidth, boxH, 14, '#F8FAFC', '#94A3B8', 1.5);

  const leftColX = padding + 14;
  let boxY = curY + 30;

  // Linha 1: Cliente
  ctx.textAlign = 'left';
  ctx.fillStyle = '#475569';
  ctx.font = '800 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('CLIENTE:', leftColX, boxY);

  ctx.fillStyle = '#0F172A';
  ctx.font = '900 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const clientName = (order.clients?.name || 'Cliente').slice(0, 20);
  ctx.fillText(clientName, leftColX + 78, boxY);

  boxY += 34;

  // Linha 2: Fone do Cliente (se houver) ou Veículo
  if (order.clients?.phone) {
    ctx.fillStyle = '#475569';
    ctx.font = '800 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('FONE:', leftColX, boxY);

    ctx.fillStyle = '#0F172A';
    ctx.font = '800 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(formatPhone(order.clients.phone), leftColX + 78, boxY);
    boxY += 34;
  }

  // Linha 3: Veículo
  ctx.fillStyle = '#475569';
  ctx.font = '800 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('VEÍCULO:', leftColX, boxY);

  ctx.fillStyle = '#0F172A';
  ctx.font = '900 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(vehicleDisplay.slice(0, 25), leftColX + 78, boxY);

  boxY += 34;

  // Linha 4: Placa e KM
  ctx.fillStyle = '#475569';
  ctx.font = '800 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('PLACA/KM:', leftColX, boxY);

  ctx.fillStyle = '#0284C7';
  ctx.font = '900 20px "Courier New", Courier, monospace';
  const kmText = order.mileage ? ` • ${order.mileage.toLocaleString('pt-BR')} km` : '';
  ctx.fillText(`${plate || 'SEM PLACA'}${kmText}`, leftColX + 90, boxY);

  boxY += 34;

  // Linha 5: Data
  ctx.fillStyle = '#475569';
  ctx.font = '800 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('DATA:', leftColX, boxY);

  ctx.fillStyle = '#0F172A';
  ctx.font = '800 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(formatDate(order.order_date), leftColX + 78, boxY);

  curY += boxH + 16;

  // --- 4. SEÇÃO DE SERVIÇOS ---
  if (servicos.length > 0) {
    const secH = 38;
    roundRect(ctx, padding, curY, contentWidth, secH, 8, '#0F172A');

    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('MÃO DE OBRA / SERVIÇOS', padding + 12, curY + 25);

    ctx.textAlign = 'right';
    ctx.font = '900 17px "Courier New", Courier, monospace';
    ctx.fillText(formatCurrency(totalServicos), width - padding - 12, curY + 25);

    curY += secH + 12;

    servicos.forEach((s: any) => {
      const { title, details } = parseItemDescription(s.description);

      // Linha do serviço
      ctx.textAlign = 'left';
      ctx.fillStyle = '#000000';
      ctx.font = '800 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`• ${title}`, padding + 6, curY + 16);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#000000';
      ctx.font = '900 20px "Courier New", Courier, monospace';
      ctx.fillText(formatCurrency(Number(s.price)), width - padding - 6, curY + 16);

      curY += 26;

      // Detalhes do checklist
      if (details && details.length > 0) {
        ctx.fillStyle = '#334155';
        ctx.font = '700 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        details.forEach((det: string) => {
          ctx.textAlign = 'left';
          ctx.fillText(`    - ${det}`, padding + 14, curY + 10);
          curY += 22;
        });
      }

      // Linha divisória
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padding + 6, curY + 4);
      ctx.lineTo(width - padding - 6, curY + 4);
      ctx.stroke();

      curY += 10;
    });

    curY += 8;
  }

  // --- 5. SEÇÃO DE PEÇAS ---
  if (pecas.length > 0) {
    const secH = 38;
    roundRect(ctx, padding, curY, contentWidth, secH, 8, '#0F172A');

    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('PEÇAS E COMPONENTES', padding + 12, curY + 25);

    ctx.textAlign = 'right';
    ctx.font = '900 17px "Courier New", Courier, monospace';
    ctx.fillText(formatCurrency(totalPecas), width - padding - 12, curY + 25);

    curY += secH + 12;

    pecas.forEach((p: any) => {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#000000';
      ctx.font = '800 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`• ${p.description}`, padding + 6, curY + 16);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#000000';
      ctx.font = '900 20px "Courier New", Courier, monospace';
      ctx.fillText(formatCurrency(Number(p.price)), width - padding - 6, curY + 16);

      curY += 26;

      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padding + 6, curY + 4);
      ctx.lineTo(width - padding - 6, curY + 4);
      ctx.stroke();

      curY += 10;
    });

    curY += 8;
  }

  // --- 6. CARD VALOR TOTAL GERAL ---
  const totalH = 88;
  roundRect(ctx, padding, curY, contentWidth, totalH, 16, '#059669');

  ctx.textAlign = 'left';
  ctx.fillStyle = '#D1FAE5';
  ctx.font = '900 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('VALOR TOTAL DA OS', padding + 18, curY + 32);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Mão de Obra + Peças', padding + 18, curY + 58);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 34px "Courier New", Courier, monospace';
  ctx.fillText(formatCurrency(grandTotal), width - padding - 18, curY + 54);

  curY += totalH + 18;

  // --- 7. RODAPÉ (APENAS CHAVE PIX SE CONFIGURADA) ---
  if (workshopPix) {
    roundRect(ctx, padding, curY, contentWidth, 42, 10, '#FEF3C7', '#F59E0B', 1.5);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#78350F';
    ctx.font = '900 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`💳 CHAVE PIX: ${workshopPix}`, width / 2, curY + 27);
    curY += 52;
  }

  return canvas;
}

/**
 * Retorna o Blob PNG da OS de forma 100% síncrona
 */
export function generateOrderImageBlobSync(order: any, orderNumber: string): Blob | null {
  const canvas = generateOrderImageCanvas(order, orderNumber);
  if (!canvas) return null;
  const dataUrl = canvas.toDataURL('image/png');
  return dataURLtoBlob(dataUrl);
}

/**
 * Retorna o Blob PNG da OS (compatibilidade assíncrona)
 */
export async function generateOrderImageBlob(order: any, orderNumber: string): Promise<Blob | null> {
  return generateOrderImageBlobSync(order, orderNumber);
}

/**
 * Compartilha a foto da OS usando a janela nativa de compartilhamento (Web Share API)
 * No Windows/Android/iOS, ao escolher o WhatsApp, o app abre diretamente a seleção de contatos
 * do WhatsApp com foto de perfil e anexa a imagem automaticamente.
 */
export async function shareOrderImageNatively(
  order: any,
  orderNumber: string
): Promise<{ success: boolean; error?: string }> {
  const blob = generateOrderImageBlobSync(order, orderNumber);
  if (!blob) {
    throw new Error('Não foi possível gerar a foto da Ordem de Serviço');
  }

  const numDisplay = orderNumber ? orderNumber.toUpperCase() : order.id.slice(0, 8).toUpperCase();
  const clientName = (order.clients?.name || 'cliente').replace(/\s+/g, '_');
  const fileName = `OS_${numDisplay}_${clientName}.png`;
  const file = new File([blob], fileName, { type: 'image/png' });

  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `OS #${numDisplay}`,
      });
      return { success: true };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, error: 'Compartilhamento cancelado' };
      }
      throw err;
    }
  }

  // Se o navegador não suportar compartilhamento de arquivos nativo
  throw new Error('Seu navegador não suporta compartilhamento direto de arquivos. Use o envio por número ou copie a foto.');
}

/**
 * Copia um Blob de imagem para a Área de Transferência com suporte completo a navegadores modernos
 */
export async function copyBlobToClipboard(blob: Blob): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return false;
  }

  // Método 1: ClipboardItem com Blob nativo
  try {
    if (typeof window.ClipboardItem !== 'undefined') {
      const item = new ClipboardItem({ [blob.type || 'image/png']: blob });
      await navigator.clipboard.write([item]);
      return true;
    }
  } catch (err1) {
    console.warn('Tentativa 1 de cópia de blob para clipboard:', err1);
  }

  // Método 2: ClipboardItem com Promise de Blob (padrão Chromium)
  try {
    if (typeof window.ClipboardItem !== 'undefined') {
      const item = new ClipboardItem({
        [blob.type || 'image/png']: Promise.resolve(blob),
      });
      await navigator.clipboard.write([item]);
      return true;
    }
  } catch (err2) {
    console.warn('Tentativa 2 de cópia de blob para clipboard:', err2);
  }

  return false;
}

/**
 * Faz o download do arquivo de imagem PNG da Ordem de Serviço de forma direta e segura
 */
export function downloadOrderImageFile(order: any, orderNumber: string): boolean {
  try {
    const blob = generateOrderImageBlobSync(order, orderNumber);
    if (!blob) return false;
    const numDisplay = orderNumber ? orderNumber.toUpperCase() : (order?.id ? order.id.slice(0, 8).toUpperCase() : 'OS');
    const clientName = (order?.clients?.name || 'cliente').replace(/\s+/g, '_');
    const fileName = `OS_${numDisplay}_${clientName}.png`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch (err) {
    console.error('Falha ao baixar imagem:', err);
    return false;
  }
}

/**
 * Copia a imagem da OS diretamente para a Área de Transferência (Clipboard)
 */
export async function copyOrderImageToClipboard(order: any, orderNumber: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard || !navigator.clipboard.write) {
    return false;
  }

  try {
    if (typeof window !== 'undefined' && window.focus) {
      window.focus();
    }
  } catch {}

  // 1. Gera o Blob PNG síncrono da imagem em alta resolução
  const blob = generateOrderImageBlobSync(order, orderNumber);
  if (!blob) return false;

  // Método 1: new ClipboardItem com Blob direto
  try {
    if (typeof window.ClipboardItem !== 'undefined') {
      const item = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([item]);
      return true;
    }
  } catch (err1) {
    console.warn('Tentativa 1 (ClipboardItem com Blob) falhou:', err1);
  }

  // Método 2: new ClipboardItem com Promise de Blob (requerido em algumas versões do Chrome)
  try {
    if (typeof window.ClipboardItem !== 'undefined') {
      const item = new ClipboardItem({
        'image/png': Promise.resolve(blob),
      });
      await navigator.clipboard.write([item]);
      return true;
    }
  } catch (err2) {
    console.warn('Tentativa 2 (ClipboardItem com Promise) falhou:', err2);
  }

  return false;
}

/**
 * Envia/abre WhatsApp para envio da imagem da OS para um número específico
 * - Copia a foto para o Clipboard (Ctrl+V) de forma síncrona
 * - Abre a conversa do WhatsApp sem texto na barra de digitação para que a foto seja colada
 */
export async function sendOrderImageToWhatsApp(
  order: any,
  orderNumber: string,
  targetPhone?: string,
  captionText?: string
): Promise<{ copied: boolean; downloaded: boolean; sharedDirectly: boolean }> {
  // 1. Copia a imagem da OS para o clipboard imediatamente
  let copied = false;
  try {
    copied = await copyOrderImageToClipboard(order, orderNumber);
  } catch (e) {
    console.warn('Erro ao copiar imagem para o clipboard:', e);
  }

  // 2. Abre o WhatsApp diretamente na conversa do número informado
  const cleanPhone = targetPhone ? targetPhone.replace(/\D/g, '') : '';
  const formattedPhone = cleanPhone ? (cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`) : '';

  let waUrl = formattedPhone ? `https://wa.me/${formattedPhone}` : `https://wa.me/`;
  if (captionText) {
    waUrl += (waUrl.includes('?') ? '&' : '?') + `text=${encodeURIComponent(captionText)}`;
  }

  window.open(waUrl, '_blank');
  return { copied, downloaded: false, sharedDirectly: false };
}
