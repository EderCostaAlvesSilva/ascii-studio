import type { ArtResult } from './types';

export const toPlainText = (art: Pick<ArtResult, 'lines'>) => art.lines.join('\n');

/**
 * Formato monoespaçado do WhatsApp. Corta linhas em branco nas pontas, espaços no fim e o
 * recuo comum: a tela é estreita, e cada coluna a menos evita uma quebra de linha.
 */
export function toWhatsAppBlock(art: Pick<ArtResult, 'lines' | 'emoji'>): { text: string; width: number } {
  // Emojis já têm a mesma largura e não têm sobras em branco.
  if (art.emoji) return { text: toPlainText(art), width: Math.max(...art.lines.map((line) => Array.from(line).length)) };
  const lines = art.lines.map((line) => line.trimEnd());
  const first = lines.findIndex(Boolean);
  if (first < 0) return { text: '', width: 0 };
  const kept = lines.slice(first, lines.findLastIndex(Boolean) + 1);
  const indent = Math.min(...kept.filter(Boolean).map((line) => line.length - line.trimStart().length));
  const cropped = kept.map((line) => line.slice(indent));
  return {
    text: `\`\`\`${cropped.join('\n')}\`\`\``,
    width: Math.max(...cropped.map((line) => Array.from(line).length)),
  };
}

export function toMarkdownBlock(art: Pick<ArtResult, 'lines'>): string {
  const text = toPlainText(art);
  // A cerca precisa ser mais longa que qualquer sequência de crases na arte.
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}text\n${text}\n${fence}`;
}
