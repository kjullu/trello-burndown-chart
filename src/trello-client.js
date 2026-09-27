const TRELLO_POWER_UP_URL = 'https://p.trellocdn.com/power-up.min.js';

function loadTrelloRuntime(documentObject) {
  return new Promise((resolve, reject) => {
    const script = documentObject.createElement('script');
    script.src = TRELLO_POWER_UP_URL;
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', () => reject(new Error('Trello Power-Up runtime could not be loaded.')), { once: true });
    documentObject.head.append(script);
  });
}

export async function createTrelloClient({
  demoMode,
  demoClient,
  windowObject = window,
  documentObject = document,
}) {
  if (demoMode) return demoClient;
  if (!windowObject.TrelloPowerUp) await loadTrelloRuntime(documentObject);
  return windowObject.TrelloPowerUp.iframe();
}
