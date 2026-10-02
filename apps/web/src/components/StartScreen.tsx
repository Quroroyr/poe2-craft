import { useI18n } from '@/i18n/I18nProvider';
import { Icon } from './Icon';

interface StartScreenProps {
  readonly onImport: () => void;
  readonly onCreate: () => void;
}

/** A fresh session: two ways in. Ctrl+V anywhere on the page does the same as "Import item". */
export function StartScreen(props: StartScreenProps) {
  const { t } = useI18n();
  return (
    <section className="start-screen" aria-labelledby="start-title">
      <h2 id="start-title" className="start-title">
        {t('start.title')}
      </h2>
      <p className="start-lead">{t('start.lead')}</p>
      <div className="start-actions">
        <button type="button" className="start-card" onClick={props.onImport}>
          <span className="start-card-icon" aria-hidden>
            <Icon name="import" size={26} />
          </span>
          <span className="start-card-title">{t('start.import')}</span>
          <span className="start-card-hint">{t('start.importHint')}</span>
          <kbd className="start-card-kbd">Ctrl+V</kbd>
        </button>
        <button type="button" className="start-card" onClick={props.onCreate}>
          <span className="start-card-icon" aria-hidden>
            <Icon name="hammer" size={26} />
          </span>
          <span className="start-card-title">{t('start.create')}</span>
          <span className="start-card-hint">{t('start.createHint')}</span>
        </button>
      </div>
      <p className="start-paste">{t('start.pasteHint')}</p>
    </section>
  );
}
