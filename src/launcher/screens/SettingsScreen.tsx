import { Gauge, Info, Volume2 } from 'lucide-react';
import type { EngineSettings, QualityLevel } from '../../engine/types';

interface Props {
  settings: EngineSettings;
  onChange: (settings: EngineSettings) => void;
  gamesCount: number;
}

const QUALITIES: { value: QualityLevel; label: string; hint: string }[] = [
  { value: 'low', label: 'Baixa', hint: 'máx. performance' },
  { value: 'medium', label: 'Média', hint: 'equilíbrio' },
  { value: 'high', label: 'Alta', hint: 'máx. qualidade' },
];

function Slider({
  label,
  value,
  onInput,
}: {
  label: string;
  value: number;
  onInput: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="font-mono text-xs text-cyan-400">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onInput(Number(e.target.value) / 100)}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-cyan-400"
      />
    </label>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0a192f] p-5">
      <h2 className="mb-4 flex items-center gap-2 font-bold text-white">
        <span className="text-cyan-400">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function SettingsScreen({ settings, onChange, gamesCount }: Props) {
  const patch = (p: Partial<EngineSettings>) => onChange({ ...settings, ...p });

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <h1 className="text-2xl font-black text-white">Configurações</h1>
      <p className="mt-1 text-sm text-slate-400">Salvas automaticamente neste aparelho.</p>

      <div className="mt-6 flex flex-col gap-5">
        <Section icon={<Volume2 size={18} />} title="Áudio">
          <div className="flex flex-col gap-4">
            <Slider label="Volume geral" value={settings.masterVolume} onInput={(v) => patch({ masterVolume: v })} />
            <Slider label="Música" value={settings.musicVolume} onInput={(v) => patch({ musicVolume: v })} />
            <Slider label="Efeitos (SFX)" value={settings.sfxVolume} onInput={(v) => patch({ sfxVolume: v })} />
          </div>
        </Section>

        <Section icon={<Gauge size={18} />} title="Gráficos">
          <div className="grid grid-cols-3 gap-2">
            {QUALITIES.map((q) => (
              <button
                key={q.value}
                onClick={() => patch({ quality: q.value })}
                className={`rounded-xl border px-3 py-3 text-center transition ${
                  settings.quality === q.value
                    ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-300'
                    : 'border-white/10 text-slate-400 hover:bg-white/5'
                }`}
              >
                <span className="block text-sm font-bold">{q.label}</span>
                <span className="mt-0.5 block text-[10px] opacity-70">{q.hint}</span>
              </button>
            ))}
          </div>

          <label className="mt-4 flex cursor-pointer items-center justify-between rounded-xl border border-white/10 px-4 py-3">
            <span className="text-sm text-slate-300">Mostrar contador de FPS</span>
            <button
              role="switch"
              aria-checked={settings.showFps}
              onClick={() => patch({ showFps: !settings.showFps })}
              className={`relative h-6 w-11 rounded-full transition ${settings.showFps ? 'bg-cyan-400' : 'bg-white/15'}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                  settings.showFps ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </label>
        </Section>

        <Section icon={<Info size={18} />} title="Sobre">
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between rounded-lg bg-white/5 px-3 py-2 sm:block">
              <dt className="text-slate-500">App</dt>
              <dd className="font-semibold text-slate-200 sm:mt-0.5">NewGen Launcher v1.0.0</dd>
            </div>
            <div className="flex justify-between rounded-lg bg-white/5 px-3 py-2 sm:block">
              <dt className="text-slate-500">Modo</dt>
              <dd className="font-semibold text-slate-200 sm:mt-0.5">100% offline (dentro do APK)</dd>
            </div>
            <div className="flex justify-between rounded-lg bg-white/5 px-3 py-2 sm:block">
              <dt className="text-slate-500">Runtime</dt>
              <dd className="font-semibold text-slate-200 sm:mt-0.5">Web (WebView + engine unificada)</dd>
            </div>
            <div className="flex justify-between rounded-lg bg-white/5 px-3 py-2 sm:block">
              <dt className="text-slate-500">Jogos instalados</dt>
              <dd className="font-semibold text-slate-200 sm:mt-0.5">{gamesCount}</dd>
            </div>
          </dl>
        </Section>
      </div>
    </div>
  );
}
