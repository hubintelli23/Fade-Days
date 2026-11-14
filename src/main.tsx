import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { listenForInstallPrompt } from './lib/install.ts';
import { AuthProvider } from './store/AuthContext.tsx';
import './index.css';

listenForInstallPrompt();

// 웹앱(PWA): 배포된 버전에서만 서비스 워커를 등록해 오프라인에서도 열리게 한다
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e: unknown) => console.warn('서비스 워커 등록 실패', e));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
