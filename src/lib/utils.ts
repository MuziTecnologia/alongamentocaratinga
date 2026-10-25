export const currency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export const dateKey = (value: string | Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
export const timeLabel = (value: string) =>
  new Date(value).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  });
export const dateLabel = (
  value: string,
  opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' },
) =>
  new Date(value.length === 10 ? `${value}T12:00:00-03:00` : value).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    ...opts,
  });
export const addDays = (value: string, count: number) => {
  const date = new Date(`${value}T12:00:00-03:00`);
  date.setUTCDate(date.getUTCDate() + count);
  return dateKey(date);
};
export const atTime = (date: string, time: string) =>
  new Date(`${date}T${time}:00-03:00`).toISOString();
export const minutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};
export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
export const uid = () => crypto.randomUUID();
export const normalizePhone = (phone: string) =>
  phone.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
export const whatsapp = (phone: string, message: string) =>
  `https://wa.me/55${normalizePhone(phone)}?text=${encodeURIComponent(message)}`;
export const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
export const statusLabels = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  no_show: 'Não compareceu',
};
export function downloadCsv(name: string, rows: (string | number)[][]) {
  const content =
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map((cell) => {
            let text = String(cell);
            if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
            return `"${text.replace(/"/g, '""')}"`;
          })
          .join(';'),
      )
      .join('\r\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '');
  const separator = clean.split(/\r?\n/)[0]?.includes(';') ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [],
    value = '',
    quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (char === '"') {
      if (quoted && clean[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === separator && !quoted) {
      row.push(value.trim());
      value = '';
    } else if (char === '\n' && !quoted) {
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = '';
    } else if (char !== '\r' || quoted) value += char;
  }
  if (quoted) throw new Error('Há aspas sem fechamento no CSV.');
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
