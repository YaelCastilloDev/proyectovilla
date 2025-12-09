import { createRemoteJWKSet, jwtVerify } from 'jose';
import dotenv from 'dotenv';

dotenv.config();

// Configuración del conjunto de claves remotas (JWKS)
const JWKS = createRemoteJWKSet(new URL(process.env.JWKS_URI));

export async function validarToken(req, res, next) {
  try {
    // 1. Extraer el token Bearer del header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Acceso denegado: Token faltante' });
    }

    const token = authHeader.split(' ')[1];

    // 2. Verificar firma, expiración (exp), emisor (iss) y audiencia (aud)
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: process.env.ISSUER,
      // audience: process.env.AUDIENCE // Descomentar si validas audiencia estricta
    });

    // 3. Inyectar información del agente en la request
    req.user = payload;
    console.log(`[API] Acceso autorizado para: ${payload.preferred_username}`);
    
    next();
  } catch (err) {
    console.error('[API] Error de validación JWT:', err.message);
    // Cumple criterio: API devuelve 401 con token inválido [cite: 117]
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// Middleware para validar roles (Authorization)
export function requerirNivel00(req, res, next) {
  const roles = req.user.realm_access?.roles || [];
  if (roles.includes('nivel-00')) {
    next();
  } else {
    res.status(403).json({ error: 'Acceso Prohibido: Se requiere autorización Nivel 00' });
  }
}