import { Router, static as serveStatic } from 'express';
import { absolutePath } from 'swagger-ui-dist';
import { openApiDocument } from './openapi.js';

const html = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>JEJAK API Documentation</title>
  <link rel="stylesheet" href="/api/docs/assets/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="/api/docs/assets/swagger-ui-bundle.js"></script>
  <script src="/api/docs/assets/swagger-ui-standalone-preset.js"></script>
  <script src="/api/docs/init.js"></script>
</body>
</html>`;

const initializer = `window.addEventListener('load', function () {
  window.ui = SwaggerUIBundle({
    url: '/api/docs/openapi.json',
    dom_id: '#swagger-ui',
    deepLinking: true,
    persistAuthorization: true,
    withCredentials: true,
    displayRequestDuration: true,
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
    layout: 'StandaloneLayout',
    validatorUrl: null
  });
});`;

export function createDocsRouter(): Router {
  const router = Router();
  router.use('/assets', serveStatic(absolutePath(), { immutable: true, maxAge: '1d' }));
  router.get('/openapi.json', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(openApiDocument);
  });
  router.get('/init.js', (_req, res) => {
    res.type('application/javascript').send(initializer);
  });
  router.get('/', (_req, res) => {
    res.type('html').send(html);
  });
  return router;
}
