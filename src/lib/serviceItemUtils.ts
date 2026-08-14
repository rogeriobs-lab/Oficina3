export interface ParsedItemDescription {
  title: string;
  details: string[];
}

/**
 * Parses an order item description that may contain a main title
 * (e.g. "Mão de Obra") and sub-item detail descriptions without price.
 */
export function parseItemDescription(rawDescription: string | null | undefined): ParsedItemDescription {
  if (!rawDescription) {
    return { title: '', details: [] };
  }

  const lines = rawDescription
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { title: '', details: [] };
  }

  const title = lines[0];
  const details = lines.slice(1).map((line) => {
    // Strip leading bullet points or dashes
    return line.replace(/^[•\-\*–—\s]+/, '').replace(/^\d+[\.\)]\s*/, '').trim();
  }).filter((line) => line.length > 0);

  return { title, details };
}

/**
 * Formats a title and its details list into a unified description string
 * for database storage.
 */
export function formatItemDescription(title: string, details: string[] | string): string {
  const cleanTitle = (title || '').trim();
  let detailsList: string[] = [];

  if (Array.isArray(details)) {
    detailsList = details
      .map((d) => (d || '').replace(/^[•\-\*–—\s]+/, '').replace(/^\d+[\.\)]\s*/, '').trim())
      .filter((d) => d.length > 0);
  } else if (typeof details === 'string') {
    detailsList = details
      .split(/\r?\n/)
      .map((d) => d.replace(/^[•\-\*–—\s]+/, '').replace(/^\d+[\.\)]\s*/, '').trim())
      .filter((d) => d.length > 0);
  }

  if (detailsList.length === 0) {
    return cleanTitle;
  }

  const formattedDetails = detailsList.map((d) => `• ${d}`).join('\n');
  return `${cleanTitle}\n${formattedDetails}`;
}
