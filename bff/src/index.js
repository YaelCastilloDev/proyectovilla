import express from 'express';
import cookieSession from 'cookie-session';
import { Issuer, generators } from 'openid-client';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Configuración de Sesión (Cookies seguras) [cite: 114]
app.use(cookieSession({
  name: 'spynet-session',
  secret: process.env.SESSION_SECRET,
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 24 * 60 * 60 * 1000 // 24 horas
}));

let client;

// Inicialización del Cliente OIDC
async function initOIDC() {
  const issuer = await Issuer.discover(process.env.ISSUER_URL);
  console.log('[BFF] IdP Descubierto:', issuer.issuer);

  client = new issuer.Client({
    client_id: process.env.CLIENT_ID,
    response_types: ['code'],
    token_endpoint_auth_method: 'none' // Cliente Público [cite: 174]
  });
}

// Ruta 1: Iniciar Login (Genera PKCE y Redirige) [cite: 116, 126]
app.get('/login', (req, res) => {
  const code_verifier = generators.codeVerifier();
  const code_challenge = generators.codeChallenge(code_verifier);
  
  // Guardamos el verifier en la sesión para usarlo en el callback
  req.session.code_verifier = code_verifier;

  const authorizationUrl = client.authorizationUrl({
    scope: 'openid profile roles',
    resource: process.env.API_URL,
    code_challenge,
    code_challenge_method: 'S256', // Obligatorio PKCE [cite: 112]
    redirect_uri: `http://${req.headers.host}/callback`
  });

  res.redirect(authorizationUrl);
});

// Ruta 2: Callback (Recibe 'code', canjea por tokens) [cite: 197]
app.get('/callback', async (req, res) => {
  try {
    const params = client.callbackParams(req);
    const code_verifier = req.session.code_verifier;

    if (!code_verifier) return res.status(400).send('Error: Falta code_verifier (¿cookies activas?)');

    const tokenSet = await client.callback(
      `http://${req.headers.host}/callback`,
      params,
      { code_verifier } // Envío del verifier para validar PKCE
    );

    console.log('[BFF] Tokens obtenidos exitosamente');
    
    // Guardamos tokens en sesión (BFF Pattern) - NO en navegador
    req.session.tokenSet = tokenSet;
    req.session.code_verifier = null; // Limpiar

    res.redirect('/mision');
  } catch (err) {
    console.error('[BFF] Error en callback:', err);
    res.status(500).send('Error en autenticación OIDC');
  }
});

// Ruta 3: Dashboard del Agente (Consume la API usando el Token)
app.get('/mision', async (req, res) => {
  if (!req.session.tokenSet) return res.redirect('/login');

  const { access_token, id_token, claims } = req.session.tokenSet;

  // Consumir la API (Simulación de proxy) [cite: 198]
  try {
    const apiResponse = await fetch(`${process.env.API_URL}/expediente`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });
    
    const data = await apiResponse.json();

    // Renderizado simple (sin frontend complejo)
    res.send(`
      <h1>🕵️ Panel de Control - SpyNet</h1>
      <p>Bienvenido, Agente <strong>${claims().preferred_username}</strong></p>
      <hr>
      <h3>📂 Respuesta de la API Segura:</h3>
      <pre>${JSON.stringify(data, null, 2)}</pre>
      <hr>
      <a href="/logout">Abortar Misión (Logout)</a>
    `);
  } catch (error) {
    res.send('Error conectando con la base de datos de la agencia.');
  }
});

// Ruta 4: Logout (OIDC Logout centralizado) [cite: 118]
app.get('/logout', (req, res) => {
  if (!req.session.tokenSet) return res.redirect('/');
  
  const endSessionUrl = client.endSessionUrl({
    id_token_hint: req.session.tokenSet.id_token,
    post_logout_redirect_uri: `http://${req.headers.host}/`
  });

  req.session = null; // Destruir sesión local
  res.redirect(endSessionUrl);
});

app.get('/', (req, res) => res.send('<h1>SpyNet Access Point</h1><a href="/login">Identificarse</a>'));

// Inicializar y arrancar
initOIDC().then(() => {
  app.listen(process.env.PORT, () => console.log(`[BFF] Web iniciada en puerto ${process.env.PORT}`));
});