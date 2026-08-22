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
 * Renderiza a Ordem de Serviço em um Canvas 2D com tipografia EXTRA GRANDE para visualização imediata no celular
 */
export async function generateOrderImageBlob(order: any, orderNumber: string): Promise<Blob | null> {
  if (!order) return null;

  const workshopName = (localStorage.getItem('workshop_name') || 'AUTO MECÂNICA').toUpperCase();
  const workshopCnpj = localStorage.getItem('workshop_cnpj') || '';
  const workshopPhone = localStorage.getItem('workshop_phone') || '';
  const workshopAddress = localStorage.getItem('workshop_address') || '';
  const workshopPix = localStorage.getItem('workshop_pix') || '';
  const workshopNotes = localStorage.getItem('workshop_notes') || '';

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
  const isConcluida = order.status === 'concluida';

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

  // Barra de identificação (OS # e Status)
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

  // Rodapé (Pix + Garantia)
  if (workshopPix) estimatedHeight += 40;
  estimatedHeight += 44; // Notas garantia
  estimatedHeight += 26; // Documento eletrônico
  estimatedHeight += padding + 8; // Bottom padding

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

  // --- 2. BARRA DE IDENTIFICAÇÃO (OS # e STATUS) ---
  const barH = 58;
  roundRect(ctx, padding, curY, contentWidth, barH, 12, '#0F172A');

  // OS #
  ctx.textAlign = 'left';
  ctx.fillStyle = '#94A3B8';
  ctx.font = '800 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('ORDEM DE SERVIÇO', padding + 14, curY + 22);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 24px "Courier New", Courier, monospace';
  ctx.fillText(`#${numDisplay}`, padding + 14, curY + 48);

  // Status Badge
  const statusW = isConcluida ? 135 : 155;
  const statusColor = isConcluida ? '#10B981' : '#F59E0B';
  const statusText = isConcluida ? 'CONCLUÍDO' : 'EM ANDAMENTO';
  roundRect(ctx, width - padding - statusW - 10, curY + 11, statusW, 36, 18, statusColor);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(statusText, width - padding - statusW / 2 - 10, curY + 34);

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

  // --- 7. RODAPÉ (PIX + GARANTIA) ---
  if (workshopPix) {
    roundRect(ctx, padding, curY, contentWidth, 42, 10, '#FEF3C7', '#F59E0B', 1.5);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#78350F';
    ctx.font = '900 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`💳 CHAVE PIX: ${workshopPix}`, width / 2, curY + 27);
    curY += 52;
  }

  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padding, curY);
  ctx.lineTo(width - padding, curY);
  ctx.stroke();
  curY += 16;

  ctx.textAlign = 'center';
  ctx.fillStyle = '#334155';
  ctx.font = '700 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const notesText = workshopNotes || 'Garantia de 90 dias conforme CDC sobre serviços e peças executados.';
  const noteLines = wrapText(ctx, notesText, contentWidth - 20);
  noteLines.forEach((l) => {
    ctx.fillText(l, width / 2, curY);
    curY += 20;
  });

  ctx.fillStyle = '#64748B';
  ctx.font = '800 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('DOCUMENTO EMITIDO ELETRONICAMENTE', width / 2, curY + 6);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/png', 0.98);
  });
}

/**
 * Envia/abre WhatsApp para envio da imagem da OS (apenas a foto, sem texto adicional)
 * - Em Celulares (Android / iOS): Utiliza a Web Share API para anexar a foto diretamente no WhatsApp
 * - No Computador (WhatsApp Web): Copia a foto para o Clipboard (Ctrl+V) e abre a conversa
 */
export async function sendOrderImageToWhatsApp(
  order: any,
  orderNumber: string,
  targetPhone?: string
): Promise<{ copied: boolean; sharedDirectly: boolean }> {
  const blob = await generateOrderImageBlob(order, orderNumber);
  if (!blob) {
    throw new Error('Não foi possível gerar a foto da Ordem de Serviço');
  }

  const numDisplay = orderNumber ? orderNumber.toUpperCase() : order.id.slice(0, 8).toUpperCase();
  const clientName = (order.clients?.name || 'cliente').replace(/\s+/g, '_');
  const fileName = `OS_${numDisplay}_${clientName}.png`;
  const file = new File([blob], fileName, { type: 'image/png' });

  // 1. Sempre tentar compartilhar o arquivo nativamente no celular (Android / iOS) - SEM texto extra
  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
      });
      return { copied: false, sharedDirectly: true };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { copied: false, sharedDirectly: false };
      }
    }
  }

  // 2. Fallback (Desktop / PC / Navegadores sem suporte a Web Share de arquivo)
  let wasCopied = false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof window.ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      wasCopied = true;
    }
  } catch (e) {
    console.log('Clipboard write not allowed or failed:', e);
  }

  // 3. Baixar arquivo da foto no computador
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  // 4. Abrir conversa no WhatsApp Web / App (apenas abrindo o chat, sem mensagem de texto)
  const cleanPhone = targetPhone ? targetPhone.replace(/\D/g, '') : '';
  const formattedPhone = cleanPhone ? (cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`) : '';

  const waUrl = formattedPhone
    ? `https://wa.me/${formattedPhone}`
    : `https://wa.me/`;

  window.open(waUrl, '_blank');
  return { copied: wasCopied, sharedDirectly: false };
}
