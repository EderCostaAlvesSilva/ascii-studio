/**
 * Copia texto. A API moderna só existe em HTTPS ou localhost; no endereço de rede
 * (celular na mesma rede, por exemplo), usa o método antigo do navegador.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permissão negada: ainda vale tentar o método antigo.
  }

  const previousFocus = document.activeElement as HTMLElement | null;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.setAttribute('aria-hidden', 'true');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  area.remove();
  previousFocus?.focus();
  return copied;
}
