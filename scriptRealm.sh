#!/bin/bash

# ==============================================================================
# SCRIPT DE CONFIGURACIÓN AUTOMÁTICA DE KEYCLOAK (SPYNET)
# ==============================================================================

# 1. VARIABLES DE CONFIGURACIÓN
# ------------------------------------------------------------------------------
KEYCLOAK_BIN="/opt/keycloak/bin"
SERVER_IP="192.168.231.129"   # Tu IP real confirmada
ADM_USER="administrador"      # Usuario admin de Keycloak (según tu configuración anterior)
ADM_PASS="12345"              # Password admin de Keycloak

# 2. AUTENTICACIÓN EN KEYCLOAK CLI
# ------------------------------------------------------------------------------
echo "🔌 Conectando a Keycloak CLI..."
cd $KEYCLOAK_BIN

# Nos logueamos en el realm 'master' para tener permisos administrativos
./kcadm.sh config credentials --server http://localhost:8080 --realm master --user $ADM_USER --password $ADM_PASS

if [ $? -eq 0 ]; then
    echo "✅ Autenticado correctamente."
else
    echo "❌ Error de autenticación. Verifica que Keycloak esté corriendo y el usuario/pass sean correctos."
    exit 1
fi

# 3. CREAR EL REALM "spynet-realm"
# ------------------------------------------------------------------------------
echo "🏰 Creando Realm 'spynet-realm'..."
./kcadm.sh create realms -s realm=spynet-realm -s enabled=true

# 4. CREAR ROLES
# ------------------------------------------------------------------------------
echo "🏷️ Creando roles..."
./kcadm.sh create roles -r spynet-realm -s name=nivel-00
./kcadm.sh create roles -r spynet-realm -s name=agente-premium

# 5. CREAR EL CLIENTE (BFF)
# ------------------------------------------------------------------------------
echo "💻 Creando Cliente 'agente-web-client'..."
# Configuramos redirectUris y WebOrigins con tu IP para que funcione desde Windows
./kcadm.sh create clients -r spynet-realm \
  -s clientId=agente-web-client \
  -s enabled=true \
  -s publicClient=true \
  -s directAccessGrantsEnabled=false \
  -s rootUrl="http://${SERVER_IP}:3000/" \
  -s "redirectUris=[\"http://${SERVER_IP}:3000/*\"]" \
  -s "webOrigins=[\"+\"]" \
  -s protocol=openid-connect

# 6. CREAR USUARIOS
# ------------------------------------------------------------------------------
echo "busts_in_silhouette: Creando usuarios..."

# --- USUARIO 1: PEPO ---
./kcadm.sh create users -r spynet-realm \
  -s username=pepo \
  -s enabled=true \
  -s email=agente007@spynet.com \
  -s firstName="Agente" \
  -s lastName="Pepo"

# --- USUARIO 2: PEZ ---
./kcadm.sh create users -r spynet-realm \
  -s username=pez \
  -s enabled=true \
  -s email=pez@spynet.com \
  -s firstName="Agente" \
  -s lastName="Pez"

# 7. ASIGNAR CONTRASEÑAS
# ------------------------------------------------------------------------------
echo "🔑 Asignando contraseñas..."
./kcadm.sh set-password -r spynet-realm --username pepo --new-password 1234
./kcadm.sh set-password -r spynet-realm --username pez --new-password 123

# 8. ASIGNAR ROLES A LOS USUARIOS
# ------------------------------------------------------------------------------
echo "shield: Asignando permisos (Roles)..."

# Pepo -> Rol Básico (Nivel 00)
./kcadm.sh add-roles -r spynet-realm --uusername pepo --rolename nivel-00

# Pez -> Rol Premium (Agente Premium - Puede ver /api/satelite)
./kcadm.sh add-roles -r spynet-realm --uusername pez --rolename agente-premium

echo "=================================================================="
echo "✅ ¡CONFIGURACIÓN COMPLETADA EXITOSAMENTE!"
echo "   - Realm: spynet-realm"
echo "   - Cliente: agente-web-client (IP: $SERVER_IP)"
echo "   - Usuario: pepo (Pass: 1234) -> Rol: nivel-00"
echo "   - Usuario: pez  (Pass: 123)  -> Rol: agente-premium"
echo "=================================================================="