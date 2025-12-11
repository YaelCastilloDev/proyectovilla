import session from 'express-session'; 
import express from 'express';
import { Issuer, generators } from 'openid-client';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(session({
  secret: process.env.SESSION_SECRET || 'secreto_temporal',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, 
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));


let client;

// Inicialización del Cliente 
async function initOIDC() {
  const issuer = await Issuer.discover(process.env.ISSUER_URL);
  console.log('[BFF] IdP Descubierto:', issuer.issuer);

  client = new issuer.Client({
    client_id: process.env.CLIENT_ID,
    response_types: ['code'],
    token_endpoint_auth_method: 'none' 
  });
}

// Ruta 1: Iniciar Login
app.get('/login', (req, res) => {
  const code_verifier = generators.codeVerifier();
  const code_challenge = generators.codeChallenge(code_verifier);
  
  // Guardamos el verifier en la sesión para usarlo en el callback
  req.session.code_verifier = code_verifier;

  const authorizationUrl = client.authorizationUrl({
    scope: 'openid profile roles',
    resource: process.env.API_URL,
    code_challenge,
    code_challenge_method: 'S256', // Obligatorio PKCE
    redirect_uri: `http://${req.headers.host}/callback`
  });

  res.redirect(authorizationUrl);
});

// Ruta 2: Callback (Recibe 'code', canjea por tokens) 
app.get('/callback', async (req, res) => {
  try {
    const params = client.callbackParams(req);
    const code_verifier = req.session.code_verifier;

    if (!code_verifier) return res.status(400).send('Error: Falta code_verifier (¿cookies activas?)');

    const tokenSet = await client.callback(
      `http://${req.headers.host}/callback`,
      params,
      { code_verifier } 
    );

    console.log('[BFF] Tokens obtenidos exitosamente');
    
    // Extrae los datos del usuario (claims) mientras el objeto tokenSet aún tiene funciones
    const userClaims = tokenSet.claims(); 

    // Guarda el tokenSet (para el access_token) y los claims por separado
    req.session.tokenSet = tokenSet;
    req.session.userClaims = userClaims; // Guarda el objeto simple
    req.session.code_verifier = null; 

    res.redirect('/mision');
  } catch (err) {
    console.error('[BFF] Error en callback:', err);
    res.status(500).send('Error en autenticación OIDC');
  }
});

// Ruta 3: Dashboard del Agente
app.get('/mision', async (req, res) => {
  if (!req.session.tokenSet) return res.redirect('/login');

  // Recupera el access_token del tokenSet y los userClaims guardados aparte
  const { access_token } = req.session.tokenSet;
  const userClaims = req.session.userClaims; // Ya es un objeto simple, no una función

  try {
    console.log(`[BFF] Solicitando datos a: ${process.env.API_URL}/expediente`);

    const apiResponse = await fetch(`${process.env.API_URL}/expediente`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });
    
    if (!apiResponse.ok) {
        throw new Error(`API respondió con estado: ${apiResponse.status} ${apiResponse.statusText}`);
    }

    const data = await apiResponse.json();

    res.send(`
      <h1>🕵️ Panel de Control - SpyNet</h1>
      <p>Bienvenido, Agente <strong>${userClaims.preferred_username}</strong></p>
      <hr>
      <h3>📂 Respuesta de la API Segura:</h3>
      <pre>${JSON.stringify(data, null, 2)}</pre>
      <a href="/logout">Cerrar Sesión</a>
    `);
  } catch (error) {
    console.error('[BFF] Error REAL en /mision:', error);
    res.send(`<h1>Error Misión Fallida</h1><p>Detalle técnico: ${error.message}</p>`);
  }
});

// Ruta 4: Logout (OIDC Logout centralizado) [cite: 118]
app.get('/logout', (req, res) => {
  // Verifica si hay sesión antes de intentar cerrar
  if (!req.session || !req.session.tokenSet) return res.redirect('/');
  
  const endSessionUrl = client.endSessionUrl({
    id_token_hint: req.session.tokenSet.id_token,
    post_logout_redirect_uri: `http://${req.headers.host}/` // Le dice a Keycloak que vuelva al inicio
  });

  // req.session = null NO SIRVE en express-session. Usamos destroy:
  req.session.destroy((err) => {
    if (err) console.error('Error destruyendo sesión:', err);
    
    // Limpia la cookie del navegador explícitamente por si acaso
    res.clearCookie('connect.sid'); 
    
    //  redirige a Keycloak para matar la sesión del IdP
    res.redirect(endSessionUrl);
  });
});

app.get('/', (req, res) => res.send('<h1>SpyNet Access Point</h1><a href="/login">Identificarse</a>'));

// Inicializa y arranca
initOIDC().then(() => {
  app.listen(process.env.PORT, () => console.log(`[BFF] Web iniciada en puerto ${process.env.PORT}`));
});


//  Intenta acceder a zona Premium
app.get('/premium', async (req, res) => {
  if (!req.session.tokenSet) return res.redirect('/login');

  const { access_token } = req.session.tokenSet;
  const userClaims = req.session.userClaims;

  try {
    // Intentamos contactar al endpoint protegido por rol
    const apiResponse = await fetch(`${process.env.API_URL}/satelite`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });

    // Si la API responde 403, muestra aviso de "Prohibido"
    if (apiResponse.status === 403) {
       return res.send(`
         <h1>⛔ ACCESO DENEGADO</h1>
         <p>Lo siento,  <strong>${userClaims.preferred_username}</strong>.</p>
         <p>No tienes el rango <code>agente-premium</code> para ver esto.</p>
         <a href="/mision">Volver</a>
       `);
    }

    const data = await apiResponse.json();

    // Si todo sale bien (tiene rol):
    res.send(`
      <h1> ZONA PREMIUM - SPYNET</h1>
      <p> Autorizado: <strong>${userClaims.preferred_username}</strong></p>
      <div style="background: #e0f7fa; padding: 15px; border-radius: 5px;">
        <h3>${data.mensaje}</h3>
        <p>Datos: ${data.coordenadas}</p>
      </div>
      <br>
      <a href="/mision">Volver al Dashboard</a>
    `);

  } catch (error) {
    res.send(`Error de comunicación: ${error.message}`);
  }
});
