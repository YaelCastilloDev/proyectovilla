import express from 'express';
import dotenv from 'dotenv';
import { validarToken, requerirNivel00, requerirPremium } from './auth-middleware.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());



// NUEVO ENDPOINT: Solo para  Premium
app.get('/api/satelite', validarToken, requerirPremium, (req, res) => {
  res.json({
    nivel: 'Cuenta premium aprobada',
    mensaje: 'aprobado.',
    coordenadas: 'Cuenta premium'
  });
});

// ... (app.listen) ...

// Endpoint público (Health check)
app.get('/api/status', (req, res) => {
  res.json({ sistema: 'SpyNet API', estado: 'OPERATIVO' });
});

// Endpoint Protegido: Datos del Agente [cite: 158]
app.get('/api/expediente', validarToken, (req, res) => {
  res.json({
    mensaje: 'Acceso aprobado',
    agente: req.user.preferred_username,
    rango_id: req.user.sub,
    datos_mision: 'siete mas uno.'
  });
});

// Endpoint Protegido con Rol (Solo Nivel-00) [cite: 158]
app.get('/api/codigos-nucleares', validarToken, requerirNivel00, (req, res) => {
  res.json({
    alerta: 'autorización mayor',
    contenido: 'solo para ciertos roles'
  });
});

app.listen(PORT, () => {
  console.log(`[API] Escuchando en puerto ${PORT}`);
});