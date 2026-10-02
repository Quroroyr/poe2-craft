import { Workspace } from '@/components/Workspace';
import { I18nProvider } from '@/i18n/I18nProvider';

export default function HomePage() {
  return (
    <I18nProvider>
      <Workspace />
    </I18nProvider>
  );
}
