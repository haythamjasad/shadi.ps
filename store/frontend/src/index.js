import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import store from './redux/store';
import { Provider } from 'react-redux';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

/**
 * Main application entry point with hydration support for react-snap prerendering
 * This setup ensures proper handling of both client-side rendering and
 * server-side/prerendered content hydration
 */
const rootElement = document.getElementById('root');

// Check if the content was prerendered (react-snap)
if (rootElement.hasChildNodes()) {
  // If prerendered, hydrate the existing content rather than replacing it
  hydrateRoot(
    rootElement,
    <React.StrictMode>
      <Provider store={store}>
        <App />
      </Provider>
    </React.StrictMode>
  );
} else {
  // Normal client-side rendering
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <Provider store={store}>
        <App />
      </Provider>
    </React.StrictMode>
  );
}

// Keep cPanel deploys deterministic and avoid stale product data/assets.
serviceWorkerRegistration.unregister();
