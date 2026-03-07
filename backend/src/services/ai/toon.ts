type ToonPrimitive = string | number | boolean | null;

interface ToTOONOptions {
  indent?: number;
}

function isPrimitive(value: unknown): value is ToonPrimitive {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function indentLine(depth: number): string {
  return '  '.repeat(depth);
}

function formatPrimitive(value: ToonPrimitive): string {
  return JSON.stringify(value);
}

function canInlineTableCell(value: unknown): boolean {
  return isPrimitive(value);
}

function canRenderAsTable(value: unknown[]): value is Array<Record<string, ToonPrimitive>> {
  if (value.length === 0) return false;
  if (!value.every(isPlainObject)) return false;

  const firstKeys = Object.keys(value[0]);
  if (firstKeys.length === 0) return false;

  return value.every((row) => {
    const keys = Object.keys(row);
    return keys.length === firstKeys.length
      && keys.every((key, index) => key === firstKeys[index])
      && keys.every((key) => canInlineTableCell(row[key]));
  });
}

function renderArray(value: unknown[], depth: number): string[] {
  const pad = indentLine(depth);

  if (canRenderAsTable(value)) {
    const headers = Object.keys(value[0]);
    const lines = [`${pad}@table ${headers.join(' | ')}`];
    for (const row of value) {
      lines.push(`${pad}- ${headers.map((header) => formatPrimitive(row[header] as ToonPrimitive)).join(' | ')}`);
    }
    return lines;
  }

  const lines = [`${pad}@list`];
  for (const item of value) {
    if (isPrimitive(item)) {
      lines.push(`${pad}- ${formatPrimitive(item)}`);
      continue;
    }

    if (Array.isArray(item)) {
      lines.push(`${pad}-`);
      lines.push(...renderArray(item, depth + 1));
      continue;
    }

    if (isPlainObject(item)) {
      lines.push(`${pad}-`);
      lines.push(...renderObject(item, depth + 1));
      continue;
    }

    lines.push(`${pad}- ${JSON.stringify(item)}`);
  }

  return lines;
}

function renderObject(value: Record<string, unknown>, depth: number): string[] {
  const pad = indentLine(depth);
  const lines = [`${pad}@object`];

  for (const [key, fieldValue] of Object.entries(value)) {
    if (isPrimitive(fieldValue)) {
      lines.push(`${pad}${key}: ${formatPrimitive(fieldValue)}`);
      continue;
    }

    if (Array.isArray(fieldValue)) {
      lines.push(`${pad}${key}:`);
      lines.push(...renderArray(fieldValue, depth + 1));
      continue;
    }

    if (isPlainObject(fieldValue)) {
      lines.push(`${pad}${key}:`);
      lines.push(...renderObject(fieldValue, depth + 1));
      continue;
    }

    lines.push(`${pad}${key}: ${JSON.stringify(fieldValue)}`);
  }

  return lines;
}

export function toTOON(value: unknown, options: ToTOONOptions = {}): string {
  const depth = options.indent ?? 0;

  if (isPrimitive(value)) {
    return formatPrimitive(value);
  }

  if (Array.isArray(value)) {
    return renderArray(value, depth).join('\n');
  }

  if (isPlainObject(value)) {
    return renderObject(value, depth).join('\n');
  }

  return JSON.stringify(value);
}

export function buildTOONBlock(label: string, value: unknown): string {
  return `<${label}_toon>\n${toTOON(value)}\n</${label}_toon>`;
}
