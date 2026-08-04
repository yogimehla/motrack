import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import { registerOfflineTileProtocol } from './offline/tiles';

// Route all map tiles through the offline cache (osmcache://) — must run before any map mounts.
registerOfflineTileProtocol();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
