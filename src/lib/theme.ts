export const theme = {
  primary: '#0F4C81',
  primaryLight: '#3B7BB8',
  primaryDark: '#0A3560',
  secondary: '#1B998B',
  accent: '#F4A261',
  success: '#2A9D8F',
  warning: '#E9C46A',
  error: '#E76F51',
  background: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF2F7',
  text: '#1A2332',
  textSecondary: '#5A6B85',
  textMuted: '#8E9BAF',
  border: '#E1E7EF',
  shadow: '#0F4C81',
  white: '#FFFFFF',
  black: '#0D1117',
};

export const formatCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

export const isInvalidPhone = (val: string | null | undefined): boolean => {
  if (!val) return true;
  const digits = val.replace(/\D/g, '');
  return digits.length <= 3;
};

export const formatPhone = (val: string | null | undefined, isInputMode = false): string => {
  if (!val) return isInputMode ? '' : 'não cadastrado';

  const digits = val.replace(/\D/g, '');

  if (digits.length <= 3) {
    if (isInputMode) {
      if (digits.length === 0) return '';
      if (digits.length <= 2) return `(${digits}`;
      return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }
    return 'não cadastrado';
  }

  let value = digits;
  if (value.length > 11) value = value.slice(0, 11);

  if (value.length > 10) {
    // 11 digits: (XX) XXXXX-XXXX
    return `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
  } else if (value.length > 6) {
    // 7 to 10 digits: (XX) XXXX-XXXX
    return `(${value.slice(0, 2)}) ${value.slice(2, 6)}-${value.slice(6)}`;
  } else if (value.length > 2) {
    // 3 to 6 digits: (XX) XXXX
    return `(${value.slice(0, 2)}) ${value.slice(2)}`;
  }

  return value;
};

export const formatDate = (date: string): string => {
  if (!date) return '—';
  const d = new Date(date);
  // Correct timezone offsets for local dates
  const utcDate = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
  return utcDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const normalizeForSearch = (str?: string | null): string => {
  if (!str) return '';
  return str
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

