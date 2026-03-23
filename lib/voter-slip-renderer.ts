'use client';

import { DEFAULT_THERMAL_PRINT_TEMPLATE, type ThermalPrintTemplateConfig } from './thermal-print-template';

export type VoterSlipRenderData = {
  voter_name?: string | null;
  relation_name?: string | null;
  epic_id?: string | null;
  booth_no?: string | null;
  serial_no?: string | null;
  booth_name?: string | null;
  booth_address?: string | null;
};

type RenderVoterSlipOptions = {
  imageUrl?: string | null;
  template?: Partial<ThermalPrintTemplateConfig>;
};

const SLIP_WIDTH = 384;
const H_PADDING = 20;

function valueOf(value: string | null | undefined, fallback = '-') {
  const trimmed = (value ?? '').trim();
  return trimmed || fallback;
}

function textValue(value: string | null | undefined, fallback = '') {
  const trimmed = (value ?? '').trim();
  return trimmed || fallback;
}

function renderTemplateText(text: string | null | undefined, data: VoterSlipRenderData, fallback = '') {
  const source = textValue(text, fallback);
  const tokens: Record<string, string> = {
    voter_name: textValue(data.voter_name),
    relation_name: textValue(data.relation_name),
    epic_id: textValue(data.epic_id),
    booth_no: textValue(data.booth_no),
    serial_no: textValue(data.serial_no),
    booth_name: textValue(data.booth_name),
    booth_address: textValue(data.booth_address)
  };

  return source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => tokens[key] ?? '');
}

function drawCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  font: string,
  options?: { underline?: boolean; maxWidth?: number }
) {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000';
  ctx.fillText(text, SLIP_WIDTH / 2, y, options?.maxWidth);

  if (options?.underline) {
    const metrics = ctx.measureText(text);
    const width = Math.min(metrics.width, options.maxWidth ?? metrics.width);
    const startX = (SLIP_WIDTH - width) / 2;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(startX, y + 4);
    ctx.lineTo(startX + width, y + 4);
    ctx.strokeStyle = '#000';
    ctx.stroke();
  }
}

function drawLineBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  font: string,
  maxWidth: number,
  lineHeight: number
) {
  const normalized = text.trim();
  if (!normalized) return 0;

  drawCenteredText(ctx, normalized, y, font, { maxWidth });
  return lineHeight;
}

function drawWrappedCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  font: string,
  maxWidth: number,
  lineHeight: number
) {
  const normalized = text.trim();
  if (!normalized) return 0;

  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000';

  const words = normalized.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);

  lines.forEach((line, index) => {
    ctx.fillText(line, SLIP_WIDTH / 2, y + index * lineHeight, maxWidth);
  });

  return lines.length * lineHeight;
}

async function loadImage(src: string) {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.decoding = 'sync';
  image.src = src;
  await image.decode();
  return image;
}

function formatPrintedOn() {
  const now = new Date();
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(now);
}

export async function renderVoterSlipCanvas(data: VoterSlipRenderData, options?: RenderVoterSlipOptions) {
  const template = {
    ...DEFAULT_THERMAL_PRINT_TEMPLATE,
    ...(options?.template ?? {})
  };
  const footerImage = options?.imageUrl ? await loadImage(options.imageUrl) : null;
  const canvas = document.createElement('canvas');
  canvas.width = SLIP_WIDTH;
  canvas.height = 1280;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to prepare slip canvas');
  }

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'top';

  let y = 26;
  const contentWidth = SLIP_WIDTH - H_PADDING * 2;

  drawCenteredText(ctx, renderTemplateText(template.headerLine1, data, 'TAMILNADU STATE'), y, 'bold 26px Arial');
  y += 30;
  drawCenteredText(ctx, renderTemplateText(template.headerLine2, data, 'ELECTIONS-2026'), y, 'bold 26px Arial');
  y += 30;
  drawCenteredText(ctx, renderTemplateText(template.headerLine3, data, 'VOTER-SLIP'), y, 'bold 24px Arial', {
    underline: true
  });
  y += 48;

  y += drawLineBlock(ctx, `Name: ${valueOf(data.voter_name)}`, y, 'bold 18px Arial', contentWidth, 30);
  y += 8;
  y += drawLineBlock(
    ctx,
    `${renderTemplateText(template.relationLabel, data, 'Father')}: ${valueOf(data.relation_name)}`,
    y,
    'bold 18px Arial',
    contentWidth,
    30
  );
  y += 8;
  y += drawLineBlock(
    ctx,
    `${renderTemplateText(template.epicLabel, data, 'EPIC ID')}: ${valueOf(data.epic_id)}`,
    y,
    'bold 18px Arial',
    contentWidth,
    30
  );
  y += 16;

  drawCenteredText(
    ctx,
    `${renderTemplateText(template.boothLabel, data, 'Booth#')}: ${valueOf(data.booth_no)} ${renderTemplateText(template.serialLabel, data, 'Sl#')}: ${valueOf(data.serial_no)}`,
    y,
    'bold 30px Arial',
    { maxWidth: contentWidth }
  );
  y += 52;

  drawCenteredText(ctx, renderTemplateText(template.pollBoothLabel, data, 'Poll Booth:'), y, 'bold 18px Arial', {
    maxWidth: contentWidth
  });
  y += 30;
  y += drawWrappedCenteredText(
    ctx,
    valueOf(data.booth_name) + (data.booth_address ? `, ${valueOf(data.booth_address, '')}` : ''),
    y,
    'bold 17px Arial',
    contentWidth,
    23
  );
  y += 12;

  drawCenteredText(ctx, renderTemplateText(template.voteOnLabel, data, 'Vote On:'), y, 'bold 18px Arial', {
    maxWidth: contentWidth
  });
  y += 28;
  drawCenteredText(
    ctx,
    `${renderTemplateText(template.printedOnLabel, data, 'Printed On')} ${formatPrintedOn()}`,
    y,
    '14px Arial',
    { maxWidth: contentWidth }
  );
  y += 26;
  drawCenteredText(
    ctx,
    renderTemplateText(template.cutLineText, data, '****** Please cut here ******'),
    y,
    'bold 17px Arial',
    { maxWidth: contentWidth }
  );
  y += 44;

  if (footerImage) {
    const imageMaxWidth = 280;
    const imageMaxHeight = 220;
    const imageScale = Math.min(imageMaxWidth / footerImage.width, imageMaxHeight / footerImage.height, 1);
    const imageWidth = Math.round(footerImage.width * imageScale);
    const imageHeight = Math.round(footerImage.height * imageScale);
    ctx.drawImage(footerImage, (SLIP_WIDTH - imageWidth) / 2, y, imageWidth, imageHeight);
    y += imageHeight + 24;
  }

  y += drawWrappedCenteredText(ctx, renderTemplateText(template.appealLine1, data), y, 'bold 18px Arial', contentWidth, 24);
  y += 2;
  y += drawWrappedCenteredText(ctx, renderTemplateText(template.appealLine2, data), y, 'bold 18px Arial', contentWidth, 24);
  y += 8;
  y += drawWrappedCenteredText(
    ctx,
    renderTemplateText(template.appealLineTamil, data),
    y,
    'bold 19px Arial',
    contentWidth,
    27
  );
  y += 24;

  drawCenteredText(ctx, renderTemplateText(template.candidateLine1, data), y, 'bold 24px Arial', { maxWidth: contentWidth });
  y += 34;
  drawCenteredText(ctx, renderTemplateText(template.candidateLine2, data), y, 'bold 22px Arial', { maxWidth: contentWidth });
  y += 30;
  drawCenteredText(ctx, renderTemplateText(template.candidateLine3, data), y, 'bold 22px Arial', { maxWidth: contentWidth });
  y += 30;
  drawCenteredText(ctx, renderTemplateText(template.candidateLine4, data), y, 'bold 22px Arial', { maxWidth: contentWidth });

  const finalHeight = Math.max(1120, y + 50);
  if (finalHeight < canvas.height) {
    const trimmed = document.createElement('canvas');
    trimmed.width = canvas.width;
    trimmed.height = finalHeight;
    const trimmedCtx = trimmed.getContext('2d');
    if (!trimmedCtx) {
      return canvas;
    }
    trimmedCtx.fillStyle = '#fff';
    trimmedCtx.fillRect(0, 0, trimmed.width, trimmed.height);
    trimmedCtx.drawImage(canvas, 0, 0);
    return trimmed;
  }

  return canvas;
}

export async function renderVoterSlipDataUrl(data: VoterSlipRenderData, options?: RenderVoterSlipOptions) {
  const canvas = await renderVoterSlipCanvas(data, options);
  return canvas.toDataURL('image/png');
}
