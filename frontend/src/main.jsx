import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { preloadCriticalAssets } from './preloadCriticalAssets.js';
import './styles/tokens.css';
import './index.css';
import './styles/percisio-sense.css';
import App from './App.jsx';

preloadCriticalAssets();

createRoot(document.getElementById('root')).render(
  <App />
);

document.getElementById('app-shell')?.remove();

const runIdle = () => {
  // PERF: Signal non-critical runtime features can now run.
  window.__PERF_NON_CRITICAL_READY__ = true;
  window.dispatchEvent(new CustomEvent('percisio:idle-ready'));
};

if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
  window.requestIdleCallback(runIdle);
} else {
  window.setTimeout(runIdle, 1);
}
