import express from 'express';
import dotenv from 'dotenv';
import { validarToken, requerirNivel00 } from './auth-middleware.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

// Endpoint público (Health check)
app.get('/api/status', (req, res) => {
  res.json({ sistema: 'SpyNet API', estado: 'OPERATIVO' });
});

// Endpoint Protegido: Datos del Agente [cite: 158]
app.get('/api/expediente', validarToken, (req, res) => {
  res.json({
    mensaje: 'Acceso a expediente concedido',
    agente: req.user.preferred_username,
    rango_id: req.user.sub,
    datos_mision: 'La entrega del paquete es en Berlín a medianoche.'
  });
});

// Endpoint Protegido con Rol (Solo Nivel-00) [cite: 158]
app.get('/api/codigos-nucleares', validarToken, requerirNivel00, (req, res) => {
  res.json({
    alerta: 'TOP SECRET',
    contenido: 'Códigos de lanzamiento: 8821-XC-99'
  });
});

app.listen(PORT, () => {
  console.log(`[API] Escuchando en puerto ${PORT}`);
});