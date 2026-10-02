import { useState } from 'react';
import type { CraftDb } from '@poe2-craft/craft-db';
import { LOCALES } from '@/i18n/core';
import { useI18n } from '@/i18n/I18nProvider';
import { Icon } from './Icon';

interface MastheadProps {
  readonly dataset: 'real' | 'demo';
  readonly onDataset: (dataset: 'real' | 'demo') => void;
  readonly db: CraftDb;
  readonly gameVersion: string;
  readonly fixture: boolean;
  readonly onGameVersion: (version: string) => void;
}

/**
 * Brand, the one section that exists (crafting), game version, interface language and the demo
 * data warning. Sections that do not exist yet are not advertised.
 */
export function Masthead({ db, gameVersion, fixture, onGameVersion, dataset, onDataset }: MastheadProps) {
  const { t, locale, setLocale } = useI18n();
  const [demoOpen, setDemoOpen] = useState(false);
  return (
    <header className="masthead">
      <div className="brand">
        <Compass />
        <div>
          <h1>PoE 2 Craft Planner</h1>
          <p className="brand-sub">{t('masthead.subtitle')}</p>
        </div>
      </div>

      <nav className="sections" aria-label={t('masthead.nav')}>
        <span className="section section-active" aria-current="page">
          {t('masthead.section.craft')}
        </span>
      </nav>

      <div className="masthead-tools">
        <label className="inline-field">{t('data.dataset')}
          <select name="dataset" value={dataset} onChange={(e) => onDataset(e.target.value as 'real' | 'demo')} title={t('data.switchHint')}>
            <option value="real">{t('data.real')}</option><option value="demo">{t('data.demo')}</option>
          </select>
        </label>
        {!fixture && <span className="badge">{t('data.realBadge')}</span>}
        <label className="inline-field">
          {t('masthead.gameVersion')}
          <select name="game-version" value={gameVersion} onChange={(e) => onGameVersion(e.target.value)}>
            {db.supportedVersions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <div className="segmented locale-switch" role="group" aria-label={t('masthead.language')}>
          {LOCALES.map((l) => (
            <button key={l} type="button" lang={l} aria-pressed={locale === l} onClick={() => setLocale(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        {fixture && (
          <div className="demo-wrap">
            <button type="button" className="demo-btn" aria-expanded={demoOpen} onClick={() => setDemoOpen((o) => !o)}>
              <Icon name="alert" size={15} />
              {t('masthead.demo')}
            </button>
            {demoOpen && (
              <div className="demo-pop" role="note">
                <p>
                  <strong>{t('masthead.demoTitle')}.</strong> {t('masthead.demoText')}
                </p>
                <p>{t('masthead.demoReal')}</p>
              </div>
            )}
          </div>
        )}
      </div>
      {fixture && (
        <p className="demo-strip" role="note">
          {t('masthead.demoStrip')}
        </p>
      )}
    </header>
  );
}

/** Eight-point compass rose: the planner's mark. Geometric, drawn in the accent gold. */
function Compass() {
  return (
    <svg className="brand-mark" width="44" height="44" viewBox="0 0 44 44" aria-hidden focusable="false">
      <circle cx="22" cy="22" r="17" fill="none" stroke="currentColor" strokeOpacity="0.45" />
      <circle cx="22" cy="22" r="12.5" fill="none" stroke="currentColor" strokeOpacity="0.25" />
      <path d="M22 2 25 19 22 22 19 19Z M42 22 25 25 22 22 25 19Z M22 42 19 25 22 22 25 25Z M2 22 19 19 22 22 19 25Z" fill="currentColor" />
      <path
        d="M22 10 23.6 20.4 22 22 20.4 20.4Z M34 22 23.6 23.6 22 22 23.6 20.4Z M22 34 20.4 23.6 22 22 23.6 23.6Z M10 22 20.4 20.4 22 22 20.4 23.6Z"
        fill="currentColor"
        fillOpacity="0.55"
        transform="rotate(45 22 22)"
      />
      <circle cx="22" cy="22" r="2" fill="#0b0c0e" stroke="currentColor" />
    </svg>
  );
}
