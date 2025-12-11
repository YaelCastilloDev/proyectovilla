#!/bin/bash

# 1. VARIABLES DE CONFIGURACIÓN
KEYCLOAK_BIN="/opt/keycloak/bin"
SERVER_IP="192.168.231.129"
ADM_USER="administrador"
ADM_PASS="12345"

# 2. AUTENTICARSE
cd $KEYCLOAK_BIN
./kcadm.sh config credentials --server http://localhost:8080 --realm master --user $ADM_USER --password $ADM_PASS
echo "✅ Autenticado en Keycloak CLI"

# 3. CREAR EL REALM
./kcadm.sh create realms -s realm=spynet-realm -s enabled=true
echo "✅ Realm 'spynet-realm' creado"

# 4. CREAR ROLES
./kcadm.sh create roles -r spynet-realm -s name=nivel-00
./kcadm.sh create roles -r spynet-realm -s name=agente-premium
echo "✅ Roles creados"

# 5. CREAR EL CLIENTE (BFF)
./kcadm.sh create clients -r spynet-realm \
  -s clientId=agente-web-client \
  -s enabled=true \
  -s publicClient=true \
  -s directAccessGrantsEnabled=false \
  -s rootUrl="http://${SERVER_IP}:3000/" \
  -s "redirectUris=[\"http://${SERVER_IP}:3000/*\"]" \
  -s "webOrigins=[\"+\"]" \
  -s protocol=openid-connect
echo "✅ Cliente configurado"

# 6. CREAR USUARIOS
# --- PEPO ---
./kcadm.sh create users -r spynet-realm \
  -s username=pepo \
  -s enabled=true \
  -s email=agente007@spynet.com \
  -s firstName="Agente" \
  -s lastName="Pepo"

# --- PEZ (Nuevo) ---
./kcadm.sh create users -r spynet-realm \
  -s username=pez \
  -s enabled=true \
  -s email=pez@spynet.com \
  -s firstName="Agente" \
  -s lastName="Pez"

# Asignar passwords
./kcadm.sh set-password -r spynet-realm --username pepo --new-password 1234
./kcadm.sh set-password -r spynet-realm --username pez --new-password 123
echo "✅ Usuarios 'pepo' y 'pez' creados con contraseña"

# 7. ASIGNAR ROLES
# Pepo -> Nivel 00
./kcadm.sh add-roles -r spynet-realm --uusername pepo --rolename nivel-00

# Pez -> Agente Premium
./kcadm.sh add-roles -r spynet-realm --uusername pez --rolename agente-premium

echo "✅ Roles asignados correctamente."
echo "✅ ¡Configuración finalizada!"