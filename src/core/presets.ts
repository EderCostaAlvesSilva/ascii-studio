import { LIMITS, type Settings } from './types';

export type PresetId = 'portrait' | 'phone' | 'readme';

export const PRESETS: ReadonlyArray<{ id: PresetId; label: string; hint: string }> = [
  { id: 'portrait', label: 'Retrato', hint: 'Mais detalhe em fotos de rosto' },
  { id: 'phone', label: 'Celular', hint: 'Cabe na tela do WhatsApp no celular' },
  { id: 'readme', label: 'README', hint: 'Para colocar ao lado de informações no GitHub' },
];

const PHONE_TEXT_WIDTH = 32;
const PHONE_EMOJI_WIDTH = 14;

/** Só altera o que define a predefinição; a remoção de fundo exige confirmação de download. */
export function applyPreset(id: PresetId, current: Settings): Partial<Settings> {
  const base = { autoContrast: true, color: false };
  switch (id) {
    case 'portrait':
      return { ...base, rampId: 'detailed', width: 100, contrast: 10, sharpness: 30, brightness: 0 };
    case 'phone':
      // Emojis continuam emojis: foi essa a escolha, e eles cabem melhor no celular.
      return current.rampId === 'emoji'
        ? { autoContrast: true, width: Math.min(PHONE_EMOJI_WIDTH, LIMITS.emojiWidth.max), sharpness: 0, contrast: 0, brightness: 0 }
        : { ...base, rampId: 'simple', width: PHONE_TEXT_WIDTH, contrast: 20, sharpness: 50, brightness: 0 };
    case 'readme':
      return { ...base, rampId: 'detailed', width: 60, contrast: 10, sharpness: 40, brightness: 0 };
  }
}
