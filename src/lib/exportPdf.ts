import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDate, formatPhone } from './theme';

export type PdfOrder = {
  id: string;
  order_date: string;
  mileage: number | null;
  status: string;
  clients: { name: string; phone: string | null } | null;
  vehicles: { plate: string; brand: string; model: string; year: number | null } | null;
  order_items: { item_type: 'servico' | 'peca'; description: string; price: number }[];
};

export const generateOrderPdf = (order: PdfOrder, customOrderNum?: string): jsPDF => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const numDisplay = customOrderNum ? customOrderNum.toUpperCase() : order.id.slice(0, 8).toUpperCase();
  const servicos = order.order_items.filter((i) => i.item_type === 'servico');
  const pecas = order.order_items.filter((i) => i.item_type === 'peca');
  const totalServicos = servicos.reduce((s, i) => s + Number(i.price), 0);
  const totalPecas = pecas.reduce((s, i) => s + Number(i.price), 0);
  const total = totalServicos + totalPecas;

  // Header Blue Bar (#0F4C81)
  doc.setFillColor(15, 76, 129);
  doc.rect(15, 12, 180, 2, 'F');

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 76, 129);
  doc.text(`Serviço #${numDisplay}`, 15, 23);

  // Date
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90, 107, 133);
  doc.text(`Data: ${formatDate(order.order_date)}`, 15, 29);

  // Status Badge
  const isConcluida = order.status === 'concluida';
  const statusText = isConcluida ? 'CONCLUÍDO' : 'ABERTO';
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  if (isConcluida) {
    doc.setFillColor(232, 245, 233);
    doc.setTextColor(46, 125, 50);
  } else {
    doc.setFillColor(227, 242, 253);
    doc.setTextColor(21, 101, 192);
  }
  doc.roundedRect(155, 17, 40, 8, 3, 3, 'F');
  doc.text(statusText, 175, 22.5, { align: 'center' });

  // Info Cards (3 cards)
  const y = 36;
  const cardWidth = 57;
  const cardHeight = 22;

  // Card 1: Cliente
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(15, y, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(142, 155, 175);
  doc.text('CLIENTE', 19, y + 6);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 35, 50);
  const clientNameLines = doc.splitTextToSize(order.clients?.name || '—', cardWidth - 8);
  doc.text(clientNameLines[0] || '—', 19, y + 12);
  if (order.clients?.phone) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90, 107, 133);
    doc.text(formatPhone(order.clients.phone), 19, y + 17);
  }

  // Card 2: Veículo
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(76.5, y, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(142, 155, 175);
  doc.text('VEÍCULO', 80.5, y + 6);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 35, 50);
  const vehStr = `${order.vehicles?.brand || ''} ${order.vehicles?.model || ''}${order.vehicles?.year ? ` (${order.vehicles.year})` : ''}`.trim() || '—';
  const vehLines = doc.splitTextToSize(vehStr, cardWidth - 8);
  doc.text(vehLines[0] || '—', 80.5, y + 12);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90, 107, 133);
  doc.text(`Placa: ${order.vehicles?.plate || '—'}`, 80.5, y + 17);

  // Card 3: Quilometragem
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(138, y, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(142, 155, 175);
  doc.text('QUILOMETRAGEM', 142, y + 6);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 35, 50);
  const kmStr = order.mileage != null && order.mileage !== 0 ? `${Number(order.mileage).toLocaleString('pt-BR')} km` : (order.mileage === 0 ? '0 km' : '—');
  doc.text(kmStr, 142, y + 13);

  let currentY = y + cardHeight + 8;

  // Table Serviços
  if (servicos.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 76, 129);
    doc.text('Serviços', 15, currentY);
    currentY += 2;

    autoTable(doc, {
      startY: currentY,
      margin: { left: 15, right: 15 },
      head: [['Descrição', 'Valor']],
      body: [
        ...servicos.map((s) => [s.description, formatCurrency(Number(s.price))]),
        [{ content: 'Subtotal Serviços', styles: { fontStyle: 'bold' } }, { content: formatCurrency(totalServicos), styles: { fontStyle: 'bold', halign: 'right' } }],
      ],
      headStyles: { fillColor: [15, 76, 129], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { textColor: [26, 35, 50], fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 45, halign: 'right' },
      },
      theme: 'grid',
    });
    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // Table Peças
  if (pecas.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 76, 129);
    doc.text('Peças', 15, currentY);
    currentY += 2;

    autoTable(doc, {
      startY: currentY,
      margin: { left: 15, right: 15 },
      head: [['Descrição', 'Valor']],
      body: [
        ...pecas.map((p) => [p.description, formatCurrency(Number(p.price))]),
        [{ content: 'Subtotal Peças', styles: { fontStyle: 'bold' } }, { content: formatCurrency(totalPecas), styles: { fontStyle: 'bold', halign: 'right' } }],
      ],
      headStyles: { fillColor: [15, 76, 129], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { textColor: [26, 35, 50], fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 45, halign: 'right' },
      },
      theme: 'grid',
    });
    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // Total Box
  doc.setFillColor(15, 76, 129);
  doc.roundedRect(15, currentY, 180, 16, 3, 3, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Total Geral', 22, currentY + 10.5);
  doc.setFontSize(16);
  doc.text(formatCurrency(total), 188, currentY + 10.5, { align: 'right' });

  // Footer
  const footerY = 285;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(142, 155, 175);
  doc.text(`Documento gerado em ${new Date().toLocaleString('pt-BR')}`, 105, footerY, { align: 'center' });

  return doc;
};

export const exportOrderToPdf = (order: PdfOrder, customOrderNum?: string): void => {
  const doc = generateOrderPdf(order, customOrderNum);
  const numDisplay = customOrderNum ? customOrderNum : order.id.slice(0, 8);
  try {
    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, '_blank');
    if (!win) {
      doc.save(`servico-${numDisplay}.pdf`);
    }
  } catch {
    doc.save(`servico-${numDisplay}.pdf`);
  }
};

export const getOrderPdfFile = (order: PdfOrder, customOrderNum?: string): { blob: Blob; file: File; filename: string } => {
  const doc = generateOrderPdf(order, customOrderNum);
  const numDisplay = customOrderNum ? customOrderNum : order.id.slice(0, 8);
  const filename = `servico-${numDisplay}.pdf`;
  const blob = doc.output('blob');
  const file = new File([blob], filename, { type: 'application/pdf' });
  return { blob, file, filename };
};
