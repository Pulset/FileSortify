import { I18nProvider } from './contexts/I18nContext';
import { useTranslation } from './hooks/useTranslation';

// Test component to verify I18n functionality
function TestI18nComponent() {
  const { t, language, setLanguage, isLoading } = useTranslation();

  if (isLoading) {
    return <div>Loading translations...</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>I18n Test Component</h2>
      <p>Current Language: {language}</p>

      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => setLanguage('zh')}>中文</button>
        <button
          onClick={() => setLanguage('en')}
          style={{ marginLeft: '10px' }}
        >
          English
        </button>
      </div>

      <div>
        <h3>Navigation Tests:</h3>
        <ul>
          <li>Dashboard: {t('nav.dashboard')}</li>
          <li>Organize: {t('nav.organize')}</li>
          <li>Rules: {t('nav.rules')}</li>
          <li>Logs: {t('nav.logs')}</li>
          <li>Subscription: {t('nav.subscription')}</li>
        </ul>

        <h3>Common Tests:</h3>
        <ul>
          <li>Loading: {t('common.loading')}</li>
          <li>Error: {t('common.error')}</li>
          <li>Success: {t('common.success')}</li>
        </ul>

        <h3>Parameter Interpolation Test:</h3>
        <p>{t('subscription.daysRemaining', { days: '5' })}</p>

        <h3>Missing Key Test (should show key):</h3>
        <p>{t('nonexistent.key')}</p>
      </div>
    </div>
  );
}

// Test app wrapper
export function TestI18nApp() {
  return (
    <I18nProvider>
      <TestI18nComponent />
    </I18nProvider>
  );
}

export default TestI18nApp;
