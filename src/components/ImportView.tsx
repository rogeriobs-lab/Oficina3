import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase, clearAllDatabaseData, consolidateDuplicateOrders, consolidateDuplicateVehicles, type Client, type Vehicle } from '../lib/supabase';
import { theme } from '../lib/theme';
import {
  Upload,
  Clipboard,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Database,
  FileSpreadsheet,
  Users,
  Car,
  ChevronRight,
  HelpCircle,
  RefreshCw,
  ClipboardList,
  Trash2,
  X,
  Layers,
  Zap,
} from 'lucide-react';

type ImportType = 'master' | 'clients' | 'vehicles' | 'orders';

interface ColumnMapping {
  dbField: string;
  label: string;
  required: boolean;
  mappedIndex: number; // -1 means not mapped
}

// Helper to format error messages from Supabase or standard Error objects
const formatErrorMessage = (err: any): string => {
  if (!err) return 'Erro desconhecido';
  if (typeof err === 'string') return err;
  if (err.message && typeof err.message === 'string') return err.message;
  if (err.details && typeof err.details === 'string') return err.details;
  if (err.error_description && typeof err.error_description === 'string') return err.error_description;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
};

// Helper to parse dates from various spreadsheet formats (Excel serial number, DD/MM/YYYY, YYYY-MM-DD, etc.)
const parseImportDate = (dateRaw: any): string => {
  if (!dateRaw) return new Date().toISOString().split('T')[0];
  const str = String(dateRaw).trim();
  if (!str) return new Date().toISOString().split('T')[0];

  // Excel serial number check (e.g. 43461 or "43461")
  const num = Number(str);
  if (!isNaN(num) && num > 10000 && num < 100000) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const msPerDay = 86400000;
    const dateObj = new Date(excelEpoch + num * msPerDay);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().split('T')[0];
    }
  }

  // YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Clean separators like 27/12/2018 or 27.12.2018 or 27-12-2018
  const cleanD = str.replace(/[.\-\s]/g, '/');
  const parts = cleanD.split('/').filter(Boolean);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${year}-${month}-${day}`;
    } else {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      let year = parts[2];
      if (year.length === 2) {
        year = Number(year) > 50 ? `19${year}` : `20${year}`;
      }
      return `${year}-${month}-${day}`;
    }
  }

  // Fallback JS Date parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
};

export default function ImportView() {
  const [importType, setImportType] = useState<ImportType>('clients');
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [inputText, setInputText] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    successCount: number;
    failedCount: number;
    errors: string[];
  } | null>(null);

  const [groupingStrategy, setGroupingStrategy] = useState<'plate_date' | 'order_number' | 'plate_date_client' | 'none'>('plate_date');
  const [consolidating, setConsolidating] = useState(false);

  const [showClearModal, setShowClearModal] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearNotice, setClearNotice] = useState<string | null>(null);

  const handleClearDatabase = async () => {
    setClearing(true);
    const result = await clearAllDatabaseData();
    setClearing(false);
    setShowClearModal(false);
    if (result.success) {
      setClearNotice('Todos os dados de clientes, veículos e serviços foram apagados do banco.');
    } else {
      setClearNotice(`Falha ao apagar: ${result.message}`);
    }
  };

  const handleConsolidateOrders = async () => {
    setConsolidating(true);
    const result = await consolidateDuplicateOrders();
    setConsolidating(false);
    if (result.success) {
      setClearNotice(result.message);
    } else {
      setClearNotice(`Falha ao agrupar O.S.: ${result.message}`);
    }
  };

  const handleConsolidateVehicles = async () => {
    setConsolidating(true);
    const result = await consolidateDuplicateVehicles();
    setConsolidating(false);
    if (result.success) {
      setClearNotice(result.message);
    } else {
      setClearNotice(`Falha ao agrupar veículos: ${result.message}`);
    }
  };


  // Initial column definitions for mapping
  const getInitialMappings = (type: ImportType): ColumnMapping[] => {
    if (type === 'master') {
      return [
        { dbField: 'client_name', label: 'Nome do Cliente / Proprietário', required: true, mappedIndex: -1 },
        { dbField: 'client_phone', label: 'Telefone / WhatsApp', required: false, mappedIndex: -1 },
        { dbField: 'client_notes', label: 'Observações / Notas do Cliente (Obs)', required: false, mappedIndex: -1 },
        { dbField: 'plate', label: 'Placa do Veículo', required: true, mappedIndex: -1 },
        { dbField: 'brand', label: 'Marca (ex: Toyota)', required: false, mappedIndex: -1 },
        { dbField: 'model', label: 'Modelo (ex: Corolla)', required: false, mappedIndex: -1 },
        { dbField: 'vehicle_notes', label: 'Observações do Veículo (Obs)', required: false, mappedIndex: -1 },
        { dbField: 'order_number', label: 'Nº / Código da O.S. (Opcional)', required: false, mappedIndex: -1 },
        { dbField: 'order_date', label: 'Data da O.S. (Ex: 15/05/2024)', required: false, mappedIndex: -1 },
        { dbField: 'service_description', label: 'Descrição do Serviço / Peça', required: false, mappedIndex: -1 },
        { dbField: 'item_type', label: 'Ref / Tipo (PÇ = Peça, MO = Mão de Obra)', required: false, mappedIndex: -1 },
        { dbField: 'price', label: 'Valor (R$)', required: false, mappedIndex: -1 },
        { dbField: 'mileage', label: 'Quilometragem (Km)', required: false, mappedIndex: -1 },
        { dbField: 'status', label: 'Status (Aberta/Fechada)', required: false, mappedIndex: -1 },
      ];
    } else if (type === 'clients') {
      return [
        { dbField: 'name', label: 'Nome do Cliente', required: true, mappedIndex: -1 },
        { dbField: 'phone', label: 'Telefone / WhatsApp', required: false, mappedIndex: -1 },
        { dbField: 'notes', label: 'Observações / Notas', required: false, mappedIndex: -1 },
      ];
    } else if (type === 'vehicles') {
      return [
        { dbField: 'plate', label: 'Placa do Veículo', required: true, mappedIndex: -1 },
        { dbField: 'brand', label: 'Marca (ex: Toyota)', required: false, mappedIndex: -1 },
        { dbField: 'model', label: 'Modelo (ex: Corolla)', required: false, mappedIndex: -1 },
        { dbField: 'year', label: 'Ano de Fabricação', required: false, mappedIndex: -1 },
        { dbField: 'client_identifier', label: 'Proprietário (Nome ou Telefone)', required: true, mappedIndex: -1 },
        { dbField: 'notes', label: 'Observações do Veículo', required: false, mappedIndex: -1 },
      ];
    } else {
      return [
        { dbField: 'plate', label: 'Placa do Veículo', required: true, mappedIndex: -1 },
        { dbField: 'client_identifier', label: 'Proprietário / Cliente (Opcional)', required: false, mappedIndex: -1 },
        { dbField: 'client_phone', label: 'Telefone / WhatsApp do Cliente', required: false, mappedIndex: -1 },
        { dbField: 'client_notes', label: 'Observações / Notas do Cliente (Obs)', required: false, mappedIndex: -1 },
        { dbField: 'vehicle_notes', label: 'Observações do Veículo (Obs)', required: false, mappedIndex: -1 },
        { dbField: 'order_number', label: 'Nº / Código da O.S. (Opcional)', required: false, mappedIndex: -1 },
        { dbField: 'order_date', label: 'Data da O.S. (Ex: 15/05/2024)', required: false, mappedIndex: -1 },
        { dbField: 'service_description', label: 'Descrição do Serviço / Item', required: false, mappedIndex: -1 },
        { dbField: 'item_type', label: 'Ref / Tipo (PÇ = Peça, MO = Mão de Obra)', required: false, mappedIndex: -1 },
        { dbField: 'price', label: 'Valor (R$)', required: false, mappedIndex: -1 },
        { dbField: 'mileage', label: 'Quilometragem (Km)', required: false, mappedIndex: -1 },
        { dbField: 'status', label: 'Status (Aberta/Fechada)', required: false, mappedIndex: -1 },
      ];
    }
  };

  // Helper to normalize strings for robust comparison (strips accents, collapses spaces, lowercase)
  const normalizeKey = (str: string) => {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Auto-map headers to database fields
  const autoMapHeaders = (detectedHeaders: string[], type: ImportType): ColumnMapping[] => {
    const initialMaps = getInitialMappings(type);
    return initialMaps.map((map) => {
      const matchIndex = detectedHeaders.findIndex((header) => {
        const h = header.toLowerCase().trim();
        const normH = normalizeKey(h);
        const label = map.label.toLowerCase();
        const field = map.dbField.toLowerCase();
        return (
          h === field ||
          h.includes(field) ||
          h === label ||
          h.includes(label) ||
          ((field === 'name' || field === 'client_name') && (
            normH.includes('nome') ||
            normH.includes('cliente') ||
            normH.includes('proprietario') ||
            normH.includes('razao') ||
            normH.includes('fantasia') ||
            normH.includes('dono') ||
            normH.includes('contato') ||
            normH.includes('titular') ||
            normH.includes('comprador')
          )) ||
          ((field === 'phone' || field === 'client_phone') && (
            normH.includes('tel') ||
            normH.includes('cel') ||
            normH.includes('fone') ||
            normH.includes('whats') ||
            normH.includes('contato') ||
            normH.includes('mobile') ||
            normH.includes('telefone') ||
            normH.includes('celular')
          )) ||
          (field === 'plate' && (
            normH.includes('placa') ||
            normH.includes('veiculo_placa') ||
            normH === 'pl'
          )) ||
          (field === 'brand' && (
            normH.includes('marca') ||
            normH.includes('fabricante') ||
            normH.includes('montadora')
          )) ||
          (field === 'model' && (
            normH.includes('modelo') ||
            normH.includes('veiculo') ||
            normH.includes('carro')
          )) ||
          (field === 'year' && (
            normH.includes('ano') ||
            normH.includes('fab')
          )) ||
          (field === 'client_identifier' && (
            normH.includes('proprietario') ||
            normH.includes('dono') ||
            normH.includes('cliente') ||
            normH.includes('nome') ||
            normH.includes('razao') ||
            normH.includes('titular')
          )) ||
          (field === 'order_number' && (
            normH.includes('os') ||
            normH.includes('ordem') ||
            normH.includes('numero') ||
            normH.includes('num') ||
            normH.includes('codigo') ||
            normH === 'nº' ||
            normH === 'no' ||
            normH === 'id'
          )) ||
          (field === 'order_date' && (
            normH.includes('data') ||
            normH.includes('dt')
          )) ||
          (field === 'service_description' && (
            normH.includes('servico') ||
            normH.includes('desc') ||
            normH.includes('item') ||
            normH.includes('trabalho') ||
            normH.includes('manutencao')
          )) ||
          (field === 'item_type' && (
            normH.includes('ref') ||
            normH.includes('tipo') ||
            normH.includes('categoria') ||
            normH.includes('class') ||
            normH === 'mo' ||
            normH === 'pc' ||
            normH === 'pç' ||
            normH.includes('mo/pc') ||
            normH.includes('pc/mo')
          )) ||
          (field === 'price' && (
            normH.includes('valor') ||
            normH.includes('preco') ||
            normH.includes('total') ||
            normH.includes('r$')
          )) ||
          (field === 'mileage' && (
            normH.includes('km') ||
            normH.includes('quilometragem') ||
            normH.includes('horimetro')
          )) ||
          (field === 'client_notes' && (
            normH.includes('obs') ||
            normH.includes('notas') ||
            normH.includes('observacao') ||
            normH.includes('comentario')
          )) ||
          (field === 'vehicle_notes' && (
            (normH.includes('obs') && (normH.includes('veic') || normH.includes('carr') || normH.includes('auto'))) ||
            (normH.includes('nota') && (normH.includes('veic') || normH.includes('carr') || normH.includes('auto'))) ||
            (normH.includes('observa') && (normH.includes('veic') || normH.includes('carr') || normH.includes('auto')))
          )) ||
          (field === 'notes' && (
            normH.includes('obs') ||
            normH.includes('notas') ||
            normH.includes('observacao')
          ))
        );
      });
      return { ...map, mappedIndex: matchIndex };
    });
  };

  // Safe CSV/TSV Parser
  const parseDelimitedText = (text: string) => {
    if (!text.trim()) return;

    // Detect delimiter: tab for spreadsheet copy-paste, otherwise semicolon or comma
    let delimiter = '\t';
    const firstLine = text.split('\n')[0];
    if (!firstLine.includes('\t')) {
      if (firstLine.includes(';')) delimiter = ';';
      else if (firstLine.includes(',')) delimiter = ',';
    }

    // Split rows and handle potential quotes
    const rawLines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const parsedRows: string[][] = [];

    rawLines.forEach((line) => {
      let tokens: string[] = [];
      if (delimiter === '\t') {
        tokens = line.split('\t');
      } else {
        // Simple quote-aware split
        let currentToken = '';
        let insideQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            insideQuotes = !insideQuotes;
          } else if (char === delimiter && !insideQuotes) {
            tokens.push(currentToken.trim().replace(/^"|"$/g, ''));
            currentToken = '';
          } else {
            currentToken += char;
          }
        }
        tokens.push(currentToken.trim().replace(/^"|"$/g, ''));
      }
      parsedRows.push(tokens);
    });

    if (parsedRows.length === 0) return;

    const detectedHeaders = parsedRows[0].map((h, i) => h.trim() || `Coluna ${i + 1}`);
    const dataRows = parsedRows.slice(1);

    setHeaders(detectedHeaders);
    setRows(dataRows);
    setMappings(autoMapHeaders(detectedHeaders, importType));
    setStep(3);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const buffer = event.target?.result as ArrayBuffer;
          const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
          
          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            alert('O arquivo Excel parece estar vazio.');
            return;
          }

          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });

          if (!jsonRows || jsonRows.length === 0) {
            alert('Nenhum dado encontrado na primeira aba da planilha.');
            return;
          }

          // Format rows into string arrays
          const formattedRows: string[][] = jsonRows
            .map((row) =>
              row.map((cell) => {
                if (cell === null || cell === undefined) return '';
                if (cell instanceof Date) {
                  const day = String(cell.getDate()).padStart(2, '0');
                  const month = String(cell.getMonth() + 1).padStart(2, '0');
                  const year = cell.getFullYear();
                  return `${day}/${month}/${year}`;
                }
                return String(cell).trim();
              })
            )
            .filter((row) => row.some((cell) => cell.length > 0));

          if (formattedRows.length === 0) {
            alert('A planilha não contém dados válidos.');
            return;
          }

          const detectedHeaders = formattedRows[0].map((h, i) => h.trim() || `Coluna ${i + 1}`);
          const dataRows = formattedRows.slice(1);

          setHeaders(detectedHeaders);
          setRows(dataRows);
          setMappings(autoMapHeaders(detectedHeaders, importType));
          setStep(3);
        } catch (err) {
          console.error('Erro ao ler arquivo Excel:', err);
          alert('Ocorreu um erro ao processar a planilha do Excel. Certifique-se de que o arquivo não está protegido ou corrompido.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        // Check if user accidentally uploaded a binary file renamed as .csv
        if (text.startsWith('PK\x03\x04') || text.includes('[Content_Types].xml')) {
          alert('Este arquivo é uma planilha Excel (.xlsx). Por favor, selecione-o garantindo a extensão .xlsx');
          return;
        }
        setInputText(text);
        parseDelimitedText(text);
      };
      reader.readAsText(file, 'UTF-8');
    }
  };

  const handleMappingChange = (dbField: string, colIndex: number) => {
    setMappings((prev) =>
      prev.map((m) => {
        if (m.dbField === dbField) {
          return { ...m, mappedIndex: colIndex };
        }
        // If another field was mapped to this column, unmap it to prevent duplicates (optional but safe)
        if (m.mappedIndex === colIndex && colIndex !== -1) {
          return { ...m, mappedIndex: -1 };
        }
        return m;
      })
    );
  };

  const executeImport = async () => {
    setImporting(true);
    setImportResult(null);

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    try {
      const getMappedValue = (row: string[], fieldName: string) => {
        const mapping = mappings.find((m) => m.dbField === fieldName);
        if (!mapping || mapping.mappedIndex === -1) return null;
        return row[mapping.mappedIndex] || null;
      };

      // 1. Common Pre-fetch for Client & Vehicle Lookup
      const { data: existingClientsData } = await supabase.from('clients').select('id, name, phone, notes');
      const { data: existingVehiclesData } = await supabase.from('vehicles').select('id, plate, client_id, notes');

      const clientsMap = new Map<string, string>(); // normalized key -> client id
      const clientNotesMap = new Map<string, string | null>(); // clientId -> current notes
      (existingClientsData || []).forEach((c: any) => {
        clientNotesMap.set(c.id, c.notes);
        if (c.name) clientsMap.set(normalizeKey(c.name), c.id);
        if (c.phone) {
          clientsMap.set(c.phone.trim(), c.id);
          const cleanP = c.phone.replace(/\D/g, '');
          if (cleanP) clientsMap.set(cleanP, c.id);
        }
      });

      const vehiclesMap = new Map<string, { id: string; client_id: string | null }>(); // clean plate -> vehicle info
      const vehicleNotesMap = new Map<string, string | null>(); // vehicleId -> current notes
      (existingVehiclesData || []).forEach((v: any) => {
        vehicleNotesMap.set(v.id, v.notes);
        if (v.plate) {
          const rawP = v.plate.toUpperCase().trim();
          const cleanP = rawP.replace(/[^A-Z0-9]/g, '');
          if (cleanP) vehiclesMap.set(cleanP, { id: v.id, client_id: v.client_id });
          vehiclesMap.set(rawP, { id: v.id, client_id: v.client_id });
        }
      });

      if (importType === 'clients') {
        // High-Speed Bulk Import for Clients
        const clientsToInsertMap = new Map<string, { name: string; phone: string | null; notes: string | null }>();

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const name = getMappedValue(row, 'name');
          if (!name || !name.trim()) {
            failedCount++;
            errors.push(`Linha ${i + 2}: Nome do cliente é obrigatório e está em branco.`);
            continue;
          }

          const trimmedName = name.trim();
          const phone = getMappedValue(row, 'phone')?.trim() || null;
          const notes = getMappedValue(row, 'notes')?.trim() || null;

          const normName = normalizeKey(trimmedName);
          const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
          const existingId = clientsMap.get(normName) || (cleanPhone ? clientsMap.get(cleanPhone) : null);

          if (existingId) {
            successCount++;
            // If existing client lacks notes or has generic notes, update with new notes
            const currNotes = clientNotesMap.get(existingId);
            if (notes && (!currNotes || currNotes.startsWith('Cadastrado'))) {
              await supabase.from('clients').update({ notes }).eq('id', existingId);
              clientNotesMap.set(existingId, notes);
            }
          } else if (!clientsToInsertMap.has(normName)) {
            clientsToInsertMap.set(normName, { name: trimmedName, phone, notes });
          } else {
            successCount++;
          }
        }

        const newClientsList = Array.from(clientsToInsertMap.values());
        for (let c = 0; c < newClientsList.length; c += 200) {
          const chunk = newClientsList.slice(c, c + 200);
          const { data: inserted, error: insertErr } = await supabase.from('clients').insert(chunk).select('id, name, phone');
          if (insertErr) {
            failedCount += chunk.length;
            errors.push(`Erro ao salvar lote de clientes: ${formatErrorMessage(insertErr)}`);
          } else {
            successCount += inserted?.length || chunk.length;
          }
        }
      } else if (importType === 'vehicles') {
        // High-Speed Bulk Import for Vehicles
        const newClientsMap = new Map<string, { name: string; phone: string | null; notes: string | null }>();
        const vehicleRowsToProcess: Array<{ plateClean: string; rawPlate: string; brand: string; model: string; clientIdent: string; notes: string | null }> = [];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const plate = getMappedValue(row, 'plate');
          const clientIdent = getMappedValue(row, 'client_identifier');
          if (!plate || !plate.trim()) {
            failedCount++;
            errors.push(`Linha ${i + 2}: Placa é obrigatória.`);
            continue;
          }
          if (!clientIdent || !clientIdent.trim()) {
            failedCount++;
            errors.push(`Linha ${i + 2}: Proprietário é obrigatório.`);
            continue;
          }

          const rawPlate = plate.trim().toUpperCase();
          const plateClean = rawPlate.replace(/[^A-Z0-9]/g, '');
          const brand = getMappedValue(row, 'brand')?.trim() || 'Veículo';
          const model = getMappedValue(row, 'model')?.trim() || 'Importado';
          const notes = getMappedValue(row, 'notes')?.trim() || null;

          const rawIdent = clientIdent.trim();
          const normIdent = normalizeKey(rawIdent);
          const cleanIdentPhone = rawIdent.replace(/\D/g, '');

          const existingClientId = clientsMap.get(normIdent) || (cleanIdentPhone ? clientsMap.get(cleanIdentPhone) : null);
          if (!existingClientId && !newClientsMap.has(normIdent)) {
            const isPhoneLike = cleanIdentPhone.length >= 8 && /^\+?[\d\s\-\(\)]+$/.test(rawIdent);
            newClientsMap.set(normIdent, {
              name: isPhoneLike ? `Cliente ${rawIdent}` : rawIdent,
              phone: isPhoneLike ? rawIdent : null,
              notes: null,
            });
          }

          vehicleRowsToProcess.push({ plateClean, rawPlate, brand, model, clientIdent: rawIdent, notes });
        }

        // Batch Insert Missing Clients
        const newClientsList = Array.from(newClientsMap.values());
        if (newClientsList.length > 0) {
          for (let c = 0; c < newClientsList.length; c += 200) {
            const chunk = newClientsList.slice(c, c + 200);
            const { data: inserted, error: cErr } = await supabase.from('clients').insert(chunk).select('id, name, phone');
            if (inserted) {
              inserted.forEach((cli) => {
                const normN = normalizeKey(cli.name);
                clientsMap.set(normN, cli.id);
                if (cli.phone) {
                  clientsMap.set(cli.phone.trim(), cli.id);
                  const cleanP = cli.phone.replace(/\D/g, '');
                  if (cleanP) clientsMap.set(cleanP, cli.id);
                }
              });
            } else if (cErr) {
              console.warn('Erro ao inserir clientes de veículos:', cErr);
            }
          }
        }

        // Batch Insert Vehicles
        const vehiclesToInsertMap = new Map<string, { plate: string; brand: string; model: string; client_id: string | null; notes: string | null }>();

        for (const item of vehicleRowsToProcess) {
          const normIdent = normalizeKey(item.clientIdent);
          const cleanIdentPhone = item.clientIdent.replace(/\D/g, '');
          const clientId = clientsMap.get(normIdent) || (cleanIdentPhone ? clientsMap.get(cleanIdentPhone) || null : null);

          const existingVeh = vehiclesMap.get(item.plateClean);
          if (existingVeh) {
            successCount++;
            if (item.notes) {
              const currNotes = vehicleNotesMap.get(existingVeh.id);
              if (!currNotes || currNotes.startsWith('Cadastrado')) {
                await supabase.from('vehicles').update({ notes: item.notes }).eq('id', existingVeh.id);
                vehicleNotesMap.set(existingVeh.id, item.notes);
              }
            }
          } else if (!vehiclesToInsertMap.has(item.plateClean)) {
            vehiclesToInsertMap.set(item.plateClean, {
              plate: item.plateClean,
              brand: item.brand,
              model: item.model,
              client_id: clientId,
              notes: item.notes,
            });
          } else {
            successCount++;
          }
        }

        const newVehiclesList = Array.from(vehiclesToInsertMap.values());
        for (let v = 0; v < newVehiclesList.length; v += 200) {
          const chunk = newVehiclesList.slice(v, v + 200);
          const { data: inserted, error: vErr } = await supabase.from('vehicles').insert(chunk).select('id, plate');
          if (vErr) {
            failedCount += chunk.length;
            errors.push(`Erro ao salvar lote de veículos: ${formatErrorMessage(vErr)}`);
          } else {
            successCount += inserted?.length || chunk.length;
          }
        }
      } else {
        // High-Speed Master / Services Import ('master' or 'orders')
        // Step 1: In-memory extract missing clients & vehicles
        const newClientsMap = new Map<string, { name: string; phone: string | null; notes: string | null }>();
        const clientUpdatesMap = new Map<string, string>();

        rows.forEach((row) => {
          const cName = getMappedValue(row, 'client_name') || getMappedValue(row, 'name') || getMappedValue(row, 'client_identifier');
          const cPhone = getMappedValue(row, 'client_phone') || getMappedValue(row, 'phone');
          const cNotes = getMappedValue(row, 'client_notes') || getMappedValue(row, 'notes');
          const trimmedNotes = cNotes?.trim() || null;

          if (cName && cName.trim()) {
            const trimmedName = cName.trim();
            const normN = normalizeKey(trimmedName);
            const cleanP = cPhone ? cPhone.replace(/\D/g, '') : '';
            const existingId = clientsMap.get(normN) || (cleanP ? clientsMap.get(cleanP) : null);

            if (existingId) {
              const currNotes = clientNotesMap.get(existingId);
              if (trimmedNotes && (!currNotes || currNotes.startsWith('Cadastrado'))) {
                clientUpdatesMap.set(existingId, trimmedNotes);
                clientNotesMap.set(existingId, trimmedNotes);
              }
            } else if (!newClientsMap.has(normN)) {
              newClientsMap.set(normN, {
                name: trimmedName,
                phone: cPhone ? cPhone.trim() : null,
                notes: trimmedNotes,
              });
            } else if (trimmedNotes && !newClientsMap.get(normN)!.notes) {
              newClientsMap.get(normN)!.notes = trimmedNotes;
            }
          }
        });

        // Apply Client Notes Updates for Existing Clients
        if (clientUpdatesMap.size > 0) {
          for (const [id, notes] of clientUpdatesMap.entries()) {
            await supabase.from('clients').update({ notes }).eq('id', id);
          }
        }

        // Batch Insert Clients
        const newClientsList = Array.from(newClientsMap.values());
        if (newClientsList.length > 0) {
          for (let c = 0; c < newClientsList.length; c += 200) {
            const chunk = newClientsList.slice(c, c + 200);
            const { data: inserted } = await supabase.from('clients').insert(chunk).select('id, name, phone');
            if (inserted) {
              inserted.forEach((cli) => {
                const normN = normalizeKey(cli.name);
                clientsMap.set(normN, cli.id);
                if (cli.phone) {
                  clientsMap.set(cli.phone.trim(), cli.id);
                  const cleanP = cli.phone.replace(/\D/g, '');
                  if (cleanP) clientsMap.set(cleanP, cli.id);
                }
              });
            }
          }
        }

        // Step 2: In-memory extract missing vehicles
        const newVehiclesMap = new Map<string, { plate: string; brand: string; model: string; client_id: string | null; notes: string | null }>();
        const vehicleUpdatesMap = new Map<string, string>();

        rows.forEach((row) => {
          const plate = getMappedValue(row, 'plate');
          if (!plate || !plate.trim()) return;
          const plateClean = plate.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (!plateClean) return;

          const rawVNotes = getMappedValue(row, 'vehicle_notes');
          const trimmedVNotes = rawVNotes?.trim() || null;

          const existingVeh = vehiclesMap.get(plateClean);
          if (existingVeh) {
            if (trimmedVNotes) {
              const currNotes = vehicleNotesMap.get(existingVeh.id);
              if (!currNotes || currNotes.startsWith('Cadastrado')) {
                vehicleUpdatesMap.set(existingVeh.id, trimmedVNotes);
                vehicleNotesMap.set(existingVeh.id, trimmedVNotes);
              }
            }
          } else if (!newVehiclesMap.has(plateClean)) {
            const cName = getMappedValue(row, 'client_name') || getMappedValue(row, 'name') || getMappedValue(row, 'client_identifier');
            const cPhone = getMappedValue(row, 'client_phone') || getMappedValue(row, 'phone');
            let clientId: string | null = null;
            if (cName && cName.trim()) {
              const normN = normalizeKey(cName.trim());
              const cleanP = cPhone ? cPhone.replace(/\D/g, '') : '';
              clientId = clientsMap.get(normN) || (cleanP ? clientsMap.get(cleanP) || null : null);
            }

            const brand = getMappedValue(row, 'brand')?.trim() || 'Veículo';
            const model = getMappedValue(row, 'model')?.trim() || 'Importado';

            newVehiclesMap.set(plateClean, {
              plate: plateClean,
              brand,
              model,
              client_id: clientId,
              notes: trimmedVNotes,
            });
          } else if (trimmedVNotes && !newVehiclesMap.get(plateClean)!.notes) {
            newVehiclesMap.get(plateClean)!.notes = trimmedVNotes;
          }
        });

        // Apply Vehicle Notes Updates for Existing Vehicles
        if (vehicleUpdatesMap.size > 0) {
          for (const [id, notes] of vehicleUpdatesMap.entries()) {
            await supabase.from('vehicles').update({ notes }).eq('id', id);
          }
        }

        // Batch Insert Vehicles
        const newVehiclesList = Array.from(newVehiclesMap.values());
        if (newVehiclesList.length > 0) {
          for (let v = 0; v < newVehiclesList.length; v += 200) {
            const chunk = newVehiclesList.slice(v, v + 200);
            const { data: inserted } = await supabase.from('vehicles').insert(chunk).select('id, plate, client_id');
            if (inserted) {
              inserted.forEach((veh) => {
                const cleanP = veh.plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
                vehiclesMap.set(cleanP, { id: veh.id, client_id: veh.client_id });
              });
            }
          }
        }

        // Step 3: Group Service Orders
        const osGroupsMap = new Map<string, {
          plateClean: string;
          orderNumberRaw: string | null;
          orderDate: string;
          mileage: number;
          status: 'aberta' | 'concluida' | 'cancelada';
          clientIdentRaw: string | null;
          items: Array<{ serviceDesc: string | null; itemTypeRaw: string | null; price: number }>;
        }>();

        rows.forEach((row, i) => {
          const plate = getMappedValue(row, 'plate');
          if (!plate || !plate.trim()) {
            failedCount++;
            errors.push(`Linha ${i + 2}: Placa em branco.`);
            return;
          }
          const plateClean = plate.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (!plateClean) return;

          const dateRaw = getMappedValue(row, 'order_date');
          const orderDate = parseImportDate(dateRaw);
          const orderNumRaw = getMappedValue(row, 'order_number')?.trim() || null;
          const clientIdentRaw = getMappedValue(row, 'client_name') || getMappedValue(row, 'name') || getMappedValue(row, 'client_identifier');

          let groupKey = '';
          if (groupingStrategy === 'order_number' && orderNumRaw) {
            groupKey = `NUM_${orderNumRaw}_${plateClean}`;
          } else {
            groupKey = `DATE_${plateClean}_${orderDate}`;
            if (orderNumRaw) groupKey += `_${orderNumRaw}`;
          }

          const mileageRaw = getMappedValue(row, 'mileage');
          const mileage = mileageRaw ? (parseInt(mileageRaw.replace(/\D/g, ''), 10) || 0) : 0;

          const statusRaw = getMappedValue(row, 'status')?.toLowerCase().trim() || '';
          let status: 'aberta' | 'concluida' | 'cancelada' = 'concluida';
          if (statusRaw.includes('abert') || statusRaw.includes('pendent')) status = 'aberta';

          const priceRaw = getMappedValue(row, 'price');
          let price = 0;
          if (priceRaw) {
            const cleanVal = priceRaw.replace(/R\$\s?/gi, '').replace(/\./g, '').replace(',', '.').trim();
            price = parseFloat(cleanVal) || 0;
          }

          const serviceDesc = getMappedValue(row, 'service_description');
          const itemTypeRaw = getMappedValue(row, 'item_type');

          if (!osGroupsMap.has(groupKey)) {
            osGroupsMap.set(groupKey, {
              plateClean,
              orderNumberRaw: orderNumRaw,
              orderDate,
              mileage,
              status,
              clientIdentRaw,
              items: [],
            });
          }

          const group = osGroupsMap.get(groupKey)!;
          if (serviceDesc || price > 0 || itemTypeRaw) {
            group.items.push({ serviceDesc, itemTypeRaw, price });
          }
        });

        // Step 4: Batch Insert Service Orders & Items
        const osGroupsList = Array.from(osGroupsMap.values());
        for (let g = 0; g < osGroupsList.length; g += 200) {
          const chunk = osGroupsList.slice(g, g + 200);

          const ordersToInsert = chunk.map((group) => {
            const vehInfo = vehiclesMap.get(group.plateClean);
            let clientId = vehInfo?.client_id || null;
            if (!clientId && group.clientIdentRaw) {
              const normN = normalizeKey(group.clientIdentRaw);
              const cleanP = group.clientIdentRaw.replace(/\D/g, '');
              clientId = clientsMap.get(normN) || (cleanP ? clientsMap.get(cleanP) || null : null);
            }
            return {
              vehicle_id: vehInfo?.id || null,
              client_id: clientId,
              order_date: group.orderDate,
              mileage: group.mileage,
              status: group.status,
            };
          }).filter((o) => o.vehicle_id && o.client_id);

          if (ordersToInsert.length === 0) continue;

          const { data: insertedOrders, error: orderErr } = await supabase
            .from('service_orders')
            .insert(ordersToInsert)
            .select('id');

          if (orderErr) {
            failedCount += chunk.length;
            errors.push(`Erro ao inserir lote de O.S.: ${formatErrorMessage(orderErr)}`);
            continue;
          }

          if (insertedOrders && insertedOrders.length > 0) {
            const itemsToInsert: any[] = [];
            insertedOrders.forEach((order, idx) => {
              const group = chunk[idx];
              if (group && group.items) {
                group.items.forEach((item) => {
                  let itemType: 'servico' | 'peca' = 'servico';
                  if (item.itemTypeRaw && item.itemTypeRaw.trim()) {
                    const normRef = normalizeKey(item.itemTypeRaw);
                    if (
                      normRef.includes('pc') ||
                      normRef.includes('peca') ||
                      normRef.includes('part') ||
                      normRef.includes('produto') ||
                      normRef === 'p'
                    ) {
                      itemType = 'peca';
                    }
                  }
                  itemsToInsert.push({
                    order_id: order.id,
                    item_type: itemType,
                    description: (item.serviceDesc && item.serviceDesc.trim())
                      ? item.serviceDesc.trim()
                      : (itemType === 'peca' ? 'Peça' : 'Serviço'),
                    price: item.price,
                  });
                });
              }
            });

            if (itemsToInsert.length > 0) {
              for (let it = 0; it < itemsToInsert.length; it += 500) {
                const itemChunk = itemsToInsert.slice(it, it + 500);
                const { error: itemErr } = await supabase.from('order_items').insert(itemChunk);
                if (itemErr) {
                  console.warn('Erro ao inserir lote de itens:', itemErr);
                }
              }
            }
            successCount += insertedOrders.length;
          }
        }
      }

      setImportResult({
        successCount,
        failedCount,
        errors,
      });
      setStep(4);
    } catch (err) {
      console.error(err);
      errors.push(`Erro crítico na importação: ${formatErrorMessage(err)}`);
      setImportResult({ successCount, failedCount, errors });
      setStep(4);
    } finally {
      setImporting(false);
    }
  };

  const resetImporter = () => {
    setInputText('');
    setHeaders([]);
    setRows([]);
    setMappings([]);
    setImportResult(null);
    setStep(1);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Importador de Dados</h1>
        <p className="text-slate-500 mt-1">Traga os dados do seu banco de dados Microsoft Access, planilhas Excel ou arquivos CSV.</p>
      </div>

      {/* Steps Indicator */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 md:gap-2">
        {[
          { label: 'Tipo de Dado', num: 1 },
          { label: 'Colar ou Carregar', num: 2 },
          { label: 'Mapear Colunas', num: 3 },
          { label: 'Resultado', num: 4 },
        ].map((s) => (
          <div key={s.num} className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
                step === s.num
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/10'
                  : step > s.num
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {s.num}
            </div>
            <span
              className={`text-xs font-bold ${
                step === s.num ? 'text-slate-900' : 'text-slate-400'
              }`}
            >
              {s.label}
            </span>
            {s.num < 4 && <ChevronRight className="w-4 h-4 text-slate-300 hidden md:block" />}
          </div>
        ))}
      </div>

      {/* Step Contents */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 md:p-8 shadow-sm">
        {step === 1 && (
          <div className="space-y-8 animate-fade-in">
            {clearNotice && (
              <div className="max-w-4xl mx-auto p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-amber-900 text-sm font-medium">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <span>{clearNotice}</span>
                </div>
                <button
                  onClick={() => setClearNotice(null)}
                  className="p-1 hover:bg-amber-100 rounded-lg text-amber-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="text-center max-w-xl mx-auto space-y-2">
              <Database className="w-12 h-12 text-sky-500 mx-auto" />
              <h2 className="text-xl font-extrabold text-slate-800">O que você gostaria de importar hoje?</h2>
              <p className="text-sm text-slate-500">Escolha a importação direta de arquivo único ou por categoria.</p>
            </div>

            {/* Featured Master Import Option */}
            <div className="max-w-4xl mx-auto">
              <button
                onClick={() => {
                  setImportType('master');
                  setMappings(getInitialMappings('master'));
                  setStep(2);
                }}
                className="w-full group relative bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-emerald-500/10 hover:from-sky-500/20 hover:via-indigo-500/20 hover:to-emerald-500/20 border-2 border-sky-500/40 hover:border-sky-500 rounded-3xl p-6 text-left transition-all cursor-pointer shadow-md hover:shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5"
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-lg shadow-sky-500/20 group-hover:scale-105 transition-transform shrink-0">
                    <Zap className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-600 text-white text-[10px] font-black uppercase tracking-wider mb-1">
                      ⚡ Recomendado - 100x Mais Rápido
                    </div>
                    <h3 className="text-lg font-black text-slate-900 group-hover:text-sky-700 transition-colors">
                      Planilha Única (Clientes + Veículos + Serviços)
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 max-w-xl leading-relaxed">
                      Possui uma única planilha com todas as O.S., placas e clientes repetidos? O sistema cria os clientes, cadastra os veículos e agrupa os serviços em <strong>uma única passada ultrarrápida</strong>.
                    </p>
                  </div>
                </div>
                <div className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-sky-600 group-hover:bg-sky-700 text-white rounded-2xl text-xs font-black shadow-md shrink-0 transition-colors">
                  <span>Usar Planilha Única</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
              <button
                onClick={() => {
                  setImportType('clients');
                  setMappings(getInitialMappings('clients'));
                  setStep(2);
                }}
                className="group relative bg-slate-50 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-6 text-left transition-all cursor-pointer shadow-sm hover:shadow-md"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-sky-500 text-white shadow-md shadow-sky-500/10 mb-4 group-hover:scale-110 transition-transform">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-base font-extrabold text-slate-800 group-hover:text-sky-700 transition-colors">Tabela de Clientes</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">Importe nomes, telefones e notas de contatos.</p>
                <div className="absolute bottom-6 right-6 text-sky-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="w-5 h-5" />
                </div>
              </button>

              <button
                onClick={() => {
                  setImportType('vehicles');
                  setMappings(getInitialMappings('vehicles'));
                  setStep(2);
                }}
                className="group relative bg-slate-50 hover:bg-emerald-50/50 border border-slate-100 hover:border-emerald-200 rounded-2xl p-6 text-left transition-all cursor-pointer shadow-sm hover:shadow-md"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/10 mb-4 group-hover:scale-110 transition-transform">
                  <Car className="w-6 h-6" />
                </div>
                <h3 className="text-base font-extrabold text-slate-800 group-hover:text-emerald-700 transition-colors">Tabela de Veículos</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">Importe placas, marcas, modelos, anos de fabricação e proprietário.</p>
                <div className="absolute bottom-6 right-6 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="w-5 h-5" />
                </div>
              </button>

              <button
                onClick={() => {
                  setImportType('orders');
                  setMappings(getInitialMappings('orders'));
                  setStep(2);
                }}
                className="group relative bg-slate-50 hover:bg-amber-50/50 border border-slate-100 hover:border-amber-200 rounded-2xl p-6 text-left transition-all cursor-pointer shadow-sm hover:shadow-md"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/10 mb-4 group-hover:scale-110 transition-transform">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <h3 className="text-base font-extrabold text-slate-800 group-hover:text-amber-700 transition-colors">Tabela de Serviços</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">Importe histórico de serviços, datas, placas, valores e itens.</p>
                <div className="absolute bottom-6 right-6 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="w-5 h-5" />
                </div>
              </button>
            </div>

            {/* Database Management Tools */}
            <div className="max-w-4xl mx-auto pt-4 border-t border-slate-100 space-y-3">
              {/* Consolidate Duplicate Orders Card */}
              <div className="bg-sky-50/60 border border-sky-100 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-sky-950">Agrupar O.S. Duplicadas Existentes no Banco</h4>
                    <p className="text-xs text-sky-700/80 mt-0.5">
                      Já importou os dados e ficou com várias O.S. para o mesmo veículo na mesma data? Clique para agrupar tudo em ordens únicas com seus respectivos itens.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleConsolidateOrders}
                  disabled={consolidating}
                  className="w-full sm:w-auto px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 flex-shrink-0 cursor-pointer"
                >
                  {consolidating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Agrupando O.S...</span>
                    </>
                  ) : (
                    <>
                      <Layers className="w-4 h-4" />
                      <span>Agrupar O.S. Existentes</span>
                    </>
                  )}
                </button>
              </div>

              {/* Clear Database Card / Option */}
              <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-rose-950">Apagar Dados para Nova Importação</h4>
                    <p className="text-xs text-rose-700/80 mt-0.5">Deseja zerar os cadastros de clientes, veículos e serviços antes de reimportar?</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowClearModal(true)}
                  className="w-full sm:w-auto px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 flex-shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Apagar Todos os Dados</span>
                </button>
              </div>
            </div>

            {/* Confirmation Modal */}
            {showClearModal && (
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 animate-scale-in space-y-5">
                  <div className="flex items-center gap-3 text-rose-600">
                    <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">Confirmar exclusão de dados</h3>
                      <p className="text-xs text-slate-500">Ação irreversível</p>
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 leading-relaxed">
                    Você tem certeza que deseja <strong>apagar permanentemente todos os clientes, veículos e serviços/O.S.</strong> salvos no sistema?
                  </p>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      onClick={() => setShowClearModal(false)}
                      disabled={clearing}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleClearDatabase}
                      disabled={clearing}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-2"
                    >
                      {clearing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Apagando...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          <span>Sim, Apagar Tudo</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  Carregar {importType === 'master' ? 'Planilha Única (Completa)' : importType === 'clients' ? 'Clientes' : importType === 'vehicles' ? 'Veículos' : 'Ordens de Serviço'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Escolha uma das duas formas práticas abaixo para trazer seus dados.</p>
              </div>
              <button
                onClick={() => setStep(1)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
              >
                Voltar
              </button>
            </div>

            {/* Instruction Banner */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex gap-3 text-left">
              <HelpCircle className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-extrabold text-slate-700">Dica Prática para Microsoft Access / Excel</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  No Access ou Excel, você pode simplesmente <strong>selecionar todas as colunas e linhas que deseja</strong>, copiar com <strong>Ctrl + C</strong>, e <strong>colar diretamente</strong> na caixa de texto abaixo. Nosso sistema identificará as colunas automaticamente!
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Box A: Upload Excel or CSV */}
              <div className="border border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center bg-slate-50/50 hover:bg-slate-50 transition-colors group">
                <FileSpreadsheet className="w-10 h-10 text-slate-400 mb-3 group-hover:text-emerald-500 transition-colors" />
                <h4 className="text-xs font-extrabold text-slate-700">Enviar arquivo Excel ou CSV</h4>
                <p className="text-[11px] text-slate-400 max-w-xs mt-1">Selecione a planilha do Excel (.xlsx, .xls) ou arquivo CSV/TXT.</p>
                <label className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-extrabold transition-all cursor-pointer shadow-sm">
                  Selecionar Planilha Excel
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.txt"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>

              {/* Box B: Copy Paste */}
              <div className="flex flex-col space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700">
                  <Clipboard className="w-4 h-4 text-slate-400" />
                  <span>Colar Linhas Copiadas</span>
                </div>
                <textarea
                  placeholder="Cole as colunas aqui... (Exemplo: Nome [tab] Telefone [tab] Obs)"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="block w-full h-36 p-3 bg-white border border-gray-200 rounded-xl text-xs font-mono focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all outline-none resize-none"
                />
                <button
                  disabled={!inputText.trim()}
                  onClick={() => parseDelimitedText(inputText)}
                  className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/10 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  Continuar com Dados Colados
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Mapeamento de Colunas</h3>
                <p className="text-xs text-slate-400 mt-0.5">Associe cada campo do sistema com a coluna correspondente da sua planilha.</p>
              </div>
              <button
                onClick={() => setStep(2)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
              >
                Voltar
              </button>
            </div>

            {/* Headers Mapping Box */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-slate-50 border border-slate-100 rounded-xl p-5">
              <div className="space-y-4">
                <h4 className="text-xs font-extrabold text-slate-700 tracking-wider uppercase">Campos do Sistema</h4>
                <div className="space-y-3.5">
                  {mappings.map((map) => (
                    <div key={map.dbField} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white border border-gray-100 rounded-lg p-3 shadow-xs">
                      <div>
                        <span className="text-xs font-extrabold text-slate-800">
                          {map.label}
                          {map.required && <span className="text-rose-500 ml-1">*</span>}
                        </span>
                        <p className="text-[10px] text-slate-400">{map.required ? 'Obrigatório' : 'Opcional'}</p>
                      </div>

                      <select
                        value={map.mappedIndex}
                        onChange={(e) => handleMappingChange(map.dbField, parseInt(e.target.value, 10))}
                        className="text-xs bg-slate-50 border border-gray-200 rounded-lg p-2 text-slate-700 outline-none focus:border-sky-500 font-medium"
                      >
                        <option value={-1}>-- Selecionar Coluna --</option>
                        {headers.map((h, idx) => (
                          <option key={idx} value={idx}>
                            {h} (Ex: "{rows[0]?.[idx] || ''}")
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data Preview */}
              <div className="flex flex-col space-y-3">
                <h4 className="text-xs font-extrabold text-slate-700 tracking-wider uppercase">Pré-visualização dos Dados</h4>
                <div className="flex-1 overflow-auto border border-slate-200 rounded-lg bg-white h-full max-h-80 shadow-inner">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700 sticky top-0">
                        {headers.map((h, idx) => (
                          <th key={idx} className="p-2 border-r border-slate-200 whitespace-nowrap min-w-[100px]">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 5).map((row, rIdx) => (
                        <tr key={rIdx} className="border-b border-slate-100 text-slate-600 hover:bg-slate-50">
                          {headers.map((_, cIdx) => (
                            <td key={cIdx} className="p-2 border-r border-slate-100 truncate max-w-[200px]">
                              {row[cIdx] || <span className="text-slate-300">vazio</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-slate-400 font-medium text-right">
                  Mostrando {Math.min(5, rows.length)} de {rows.length} linhas importadas.
                </p>
              </div>
            </div>

            {/* Grouping Strategy Option for Service Orders */}
            {importType === 'orders' && (
              <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-amber-950 font-extrabold text-xs">
                  <ClipboardList className="w-4 h-4 text-amber-600" />
                  <span>Como agrupar as linhas da planilha em Ordens de Serviço?</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Planilhas costumam ter 1 linha para cada peça ou serviço. Escolha o critério para agrupar as linhas em uma mesma O.S.:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <label className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    groupingStrategy === 'plate_date'
                      ? 'bg-white border-amber-500 shadow-xs text-slate-900 font-bold'
                      : 'bg-amber-50/40 border-amber-200 text-slate-700 hover:bg-white'
                  }`}>
                    <input
                      type="radio"
                      name="groupingStrategy"
                      checked={groupingStrategy === 'plate_date'}
                      onChange={() => setGroupingStrategy('plate_date')}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <div className="font-extrabold text-slate-900">Por Placa e Data (Recomendado)</div>
                      <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                        Junta todas as peças e serviços do mesmo veículo na mesma data em 1 única O.S.
                      </div>
                    </div>
                  </label>

                  <label className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    groupingStrategy === 'order_number'
                      ? 'bg-white border-amber-500 shadow-xs text-slate-900 font-bold'
                      : 'bg-amber-50/40 border-amber-200 text-slate-700 hover:bg-white'
                  }`}>
                    <input
                      type="radio"
                      name="groupingStrategy"
                      checked={groupingStrategy === 'order_number'}
                      onChange={() => setGroupingStrategy('order_number')}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <div className="font-extrabold text-slate-900">Por Número / Código da O.S.</div>
                      <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                        Agrupa linhas que possuam o mesmo número de O.S. informado na planilha.
                      </div>
                    </div>
                  </label>

                  <label className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    groupingStrategy === 'plate_date_client'
                      ? 'bg-white border-amber-500 shadow-xs text-slate-900 font-bold'
                      : 'bg-amber-50/40 border-amber-200 text-slate-700 hover:bg-white'
                  }`}>
                    <input
                      type="radio"
                      name="groupingStrategy"
                      checked={groupingStrategy === 'plate_date_client'}
                      onChange={() => setGroupingStrategy('plate_date_client')}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <div className="font-extrabold text-slate-900">Por Placa, Data e Cliente</div>
                      <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                        Agrupa somente se a placa, a data e o proprietário forem idênticos.
                      </div>
                    </div>
                  </label>

                  <label className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    groupingStrategy === 'none'
                      ? 'bg-white border-amber-500 shadow-xs text-slate-900 font-bold'
                      : 'bg-amber-50/40 border-amber-200 text-slate-700 hover:bg-white'
                  }`}>
                    <input
                      type="radio"
                      name="groupingStrategy"
                      checked={groupingStrategy === 'none'}
                      onChange={() => setGroupingStrategy('none')}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <div className="font-extrabold text-slate-900">Não Agrupar</div>
                      <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                        Cada linha da planilha criará 1 O.S. individual no sistema.
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Warning if required mappings are missing */}
            {mappings.some((m) => m.required && m.mappedIndex === -1) && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3.5 flex gap-2.5 text-xs text-left">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <h5 className="font-extrabold">Campos Obrigatórios Pendentes</h5>
                  <p className="mt-0.5 opacity-90">Por favor, mapeie todos os campos obrigatórios marcados com asterisco (*) para prosseguir.</p>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={resetImporter}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={importing || mappings.some((m) => m.required && m.mappedIndex === -1)}
                onClick={executeImport}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/10 transition-all cursor-pointer flex items-center gap-2"
              >
                {importing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Confirmar e Importar ({rows.length} registros)
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 4 && importResult && (
          <div className="space-y-6 animate-fade-in text-center py-4">
            <div className="max-w-md mx-auto space-y-3">
              {importResult.failedCount === 0 ? (
                <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
              ) : (
                <AlertTriangle className="w-14 h-14 text-amber-500 mx-auto" />
              )}
              <h2 className="text-xl font-extrabold text-slate-800">Importação Concluída!</h2>
              <p className="text-sm text-slate-500">O processamento dos seus registros foi finalizado com os seguintes resultados:</p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto bg-slate-50 border border-slate-100 rounded-xl p-4">
              <div className="text-center p-3 bg-white rounded-lg border border-gray-100">
                <span className="text-2xl font-black text-emerald-600">{importResult.successCount}</span>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Com Sucesso</p>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border border-gray-100">
                <span className={`text-2xl font-black ${importResult.failedCount > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                  {importResult.failedCount}
                </span>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Falhas / Avisos</p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="max-w-xl mx-auto border border-rose-100 rounded-xl bg-rose-50/50 p-4 text-left">
                <h4 className="text-xs font-extrabold text-rose-800">Relatório de Detalhes / Erros</h4>
                <div className="mt-2 text-[11px] text-rose-700 font-mono space-y-1.5 max-h-32 overflow-y-auto pr-2">
                  {importResult.errors.map((err, idx) => (
                    <div key={idx} className="flex gap-2">
                      <span className="shrink-0">•</span>
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 flex justify-center gap-3">
              <button
                onClick={resetImporter}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Nova Importação
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
