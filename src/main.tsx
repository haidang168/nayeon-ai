import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { StatsProvider } from './hooks/useStats';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StatsProvider>
      <App />
    </StatsProvider>
  </StrictMode>,
);
