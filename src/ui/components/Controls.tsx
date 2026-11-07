import { useState } from 'react';
import { applyPreset, PRESETS } from '../../core/presets';
import { validateCustomRamp } from '../../core/ramps';
import { DEFAULT_SETTINGS, EMOJI_DEFAULT_WIDTH, LIMITS, widthLimits, type RampId, type Settings, type Theme } from '../../core/types';
import type { BgProgress } from '../lib/bg-removal-client';

interface Props {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  bg: { running: boolean; progress: BgProgress | null };
  onToggleBackground: (enabled: boolean) => void;
  onOpenCrop: () => void;
}

const RAMP_OPTIONS: Array<{ id: RampId; label: string }> = [
  { id: 'simple', label: 'Simples' },
  { id: 'detailed', label: 'Detalhado' },
  { id: 'blocks', label: 'Blocos Unicode' },
  { id: 'custom', label: 'Personalizado' },
  { id: 'emoji', label: 'Emojis coloridos' },
];

const DEFAULT_CUSTOM_RAMP = ' .oO@';

function Slider(props: { id: string; label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const { id, label, value, min, max, onChange } = props;
  return (
    <div>
      <div className="mb-1 flex justify-between">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="text-muted">
          {value}
        </output>
      </div>
      <input id={id} type="range" className="w-full" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function Check(props: { label: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-6 items-center gap-2">
      <input
        type="checkbox"
        className="size-4"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      {props.label}
    </label>
  );
}

function progressText(progress: BgProgress | null): string {
  if (progress?.phase === 'download') return `Baixando recursos… ${progress.percent}%`;
  return progress?.phase === 'processing' ? 'Removendo o fundo…' : 'Preparando…';
}

export function Controls({ settings, onChange, bg, onToggleBackground, onOpenCrop }: Props) {
  // Rascunhos guardam o que ainda não é válido; as configurações só recebem valores válidos.
  const [widthDraft, setWidthDraft] = useState<string | null>(null);
  const [rampDraft, setRampDraft] = useState<string | null>(null);
  const rampCheck = rampDraft === null ? null : validateCustomRamp(rampDraft);
  const rampError = rampCheck && !rampCheck.ok ? rampCheck.error : '';
  const isEmoji = settings.rampId === 'emoji';
  const limits = widthLimits(settings.rampId);

  const typeWidth = (text: string) => {
    setWidthDraft(text);
    const value = Number(text);
    if (Number.isInteger(value) && value >= limits.min && value <= limits.max) onChange({ width: value });
  };

  const typeRamp = (text: string) => {
    if (validateCustomRamp(text).ok) {
      setRampDraft(null);
      onChange({ customRamp: text });
    } else {
      setRampDraft(text);
    }
  };

  const chooseRamp = (rampId: RampId) => {
    setRampDraft(null);
    setWidthDraft(null);
    const patch: Partial<Settings> = { rampId };
    if (rampId === 'custom' && !settings.customRamp) patch.customRamp = DEFAULT_CUSTOM_RAMP;
    // Emojis ocupam mais espaço: a faixa de largura é outra.
    if (rampId === 'emoji' && !isEmoji) patch.width = EMOJI_DEFAULT_WIDTH;
    if (rampId !== 'emoji' && isEmoji) patch.width = DEFAULT_SETTINGS.width;
    onChange(patch);
  };

  return (
    <form className="panel flex flex-col gap-4" aria-label="Ajustes" onSubmit={(e) => e.preventDefault()}>
      <fieldset>
        <legend className="mb-1">Predefinições</legend>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="btn"
              title={preset.hint}
              onClick={() => {
                setWidthDraft(null);
                setRampDraft(null);
                onChange(applyPreset(preset.id, settings));
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </fieldset>

      <button type="button" className="btn" onClick={onOpenCrop}>
        {settings.crop ? 'Recortar imagem (ativo)' : 'Recortar imagem'}
      </button>

      <div>
        <label htmlFor="width-range" className="mb-1 block">
          Largura em caracteres
        </label>
        <div className="flex items-center gap-3">
          <input
            id="width-range"
            type="range"
            className="min-w-0 flex-1"
            min={limits.min}
            max={limits.max}
            value={settings.width}
            onChange={(e) => {
              setWidthDraft(null);
              onChange({ width: Number(e.target.value) });
            }}
          />
          <input
            aria-label="Largura em caracteres, digitada"
            type="number"
            className="field w-20! shrink-0"
            min={limits.min}
            max={limits.max}
            value={widthDraft ?? settings.width}
            onChange={(e) => typeWidth(e.target.value)}
            onBlur={() => setWidthDraft(null)}
          />
        </div>
      </div>

      <div>
        <label htmlFor="ramp" className="mb-1 block">
          Conjunto de caracteres
        </label>
        <select id="ramp" className="field" value={settings.rampId} onChange={(e) => chooseRamp(e.target.value as RampId)}>
          {RAMP_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {settings.rampId === 'custom' && (
        <div>
          <label htmlFor="custom-ramp" className="mb-1 block">
            Caracteres personalizados
          </label>
          <input
            id="custom-ramp"
            className="field"
            value={rampDraft ?? settings.customRamp}
            spellCheck={false}
            aria-invalid={Boolean(rampError)}
            aria-describedby="custom-ramp-help"
            onChange={(e) => typeRamp(e.target.value)}
          />
          <p id="custom-ramp-help" className={`mt-1 ${rampError ? 'text-danger' : 'text-muted'}`}>
            {rampError || 'Do menos para o mais denso.'}
          </p>
        </div>
      )}

      <Check label="Contraste automático" checked={settings.autoContrast} onChange={(autoContrast) => onChange({ autoContrast })} />
      <Slider id="brightness" label="Brilho" {...LIMITS.brightness} value={settings.brightness} onChange={(brightness) => onChange({ brightness })} />
      <Slider id="contrast" label="Contraste" {...LIMITS.contrast} value={settings.contrast} onChange={(contrast) => onChange({ contrast })} />
      <Slider id="sharpness" label="Nitidez" {...LIMITS.sharpness} value={settings.sharpness} onChange={(sharpness) => onChange({ sharpness })} />
      <div>
        <Slider id="trim-edge" label="Remover contorno" {...LIMITS.trimEdge} value={settings.trimEdge} onChange={(trimEdge) => onChange({ trimEdge })} />
        <p className="mt-1 text-muted">Afina a borda de figurinhas e de imagens sem fundo.</p>
      </div>
      <button type="button" className="btn" onClick={() => onChange({ brightness: 0, contrast: 0, sharpness: 0, trimEdge: 0 })}>
        Restaurar padrões
      </button>

      <div className="flex flex-col gap-2">
        <Check label="Inverter claro e escuro" checked={settings.invert && !isEmoji} disabled={isEmoji} onChange={(invert) => onChange({ invert })} />
        <Check label="Modo colorido" checked={settings.color && !isEmoji} disabled={isEmoji} onChange={(color) => onChange({ color })} />
        {isEmoji && <p className="text-muted">Com emojis, a cor já vem de cada caractere.</p>}
        <Check label="Remover fundo" checked={settings.removeBackground} disabled={bg.running} onChange={onToggleBackground} />
        {bg.running && (
          <div role="status">
            <p className="text-muted">{progressText(bg.progress)}</p>
            <progress className="w-full" aria-label="Progresso da remoção de fundo" max={100} value={bg.progress?.phase === 'download' ? bg.progress.percent : undefined} />
          </div>
        )}
      </div>

      <fieldset>
        <legend className="mb-1">Tema da pré-visualização</legend>
        <div className="flex gap-4">
          {(
            [
              ['dark', 'Escuro'],
              ['light', 'Claro'],
            ] as Array<[Theme, string]>
          ).map(([theme, label]) => (
            <label key={theme} className="flex items-center gap-2">
              <input type="radio" name="preview-theme" className="size-4" checked={settings.theme === theme} onChange={() => onChange({ theme })} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
    </form>
  );
}
