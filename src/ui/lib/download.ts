export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const downloadText = (text: string, filename: string, type: string) =>
  downloadBlob(new Blob([text], { type }), filename);

/** Nome de arquivo seguro, a partir do nome da criação. */
export function fileBaseName(name: string | null): string {
  const clean = (name ?? '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim().replace(/\s+/g, '-');
  return clean || 'ascii-art';
}
