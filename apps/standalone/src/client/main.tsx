import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.tsx';
import { SETTINGS_PATH } from './page-hrefs.ts';
import { SettingsPage } from './SettingsPage.tsx';

const container = document.querySelector('#root');
if (container) {
  createRoot(container).render(
    <StrictMode>{globalThis.location.pathname === SETTINGS_PATH ? <SettingsPage /> : <App />}</StrictMode>,
  );
}
