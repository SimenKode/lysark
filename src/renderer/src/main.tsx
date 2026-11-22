import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { STAGE_CSS } from '../../shared/render/css';
import { App } from './App';
import './fonts.css';
import './styles.css';

// The scene styles are the same string that goes into exported HTML.
const style = document.createElement('style');
style.textContent = STAGE_CSS;
document.head.appendChild(style);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
