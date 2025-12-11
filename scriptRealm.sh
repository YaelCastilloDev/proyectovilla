# ---------------------------------------------------------
# 1. VARIABLES DE CONFIGURACIÓN (¡EDITA TU IP AQUÍ!)
# ---------------------------------------------------------
KEYCLOAK_BIN="/opt/keycloak/bin"
SERVER_IP="192.168.231.129"  # <--- PON AQUÍ TU IP REAL (resultado de 'ip a')
ADM_USER="administrador"          # Tu usuario admin de Keycloak
ADM_PASS="12345"          # Tu password admin de Keycloak

# ---------------------------------------------------------
# 2. AUTENTICARSE (Login de la herramienta CLI)
# ---------------------------------------------------------
cd $KEYCLOAK_BIN

# Nos logueamos contra el master para tener permisos de crear cosas
./kcadm.sh config credentials --server http://localhost:8080 --realm master --user $ADM_USER --password $ADM_PASS

echo "✅ Autenticado correctamente en Keycloak CLI"

# ---------------------------------------------------------
# 3. CREAR EL REALM "spynet-realm"
# ---------------------------------------------------------
# Creamos el reino y lo habilitamos
./kcadm.sh create realms -s realm=spynet-realm -s enabled=true

echo "✅ Realm 'spynet-realm' creado"

# ---------------------------------------------------------
# 4. CREAR ROLES (nivel-00 y agente-premium)
# ---------------------------------------------------------
./kcadm.sh create roles -r spynet-realm -s name=nivel-00
./kcadm.sh create roles -r spynet-realm -s name=agente-premium

echo "✅ Roles creados"

# ---------------------------------------------------------
# 5. CREAR EL CLIENTE (BFF)
# ---------------------------------------------------------
# OJO: Aquí configuramos las Redirect URIs y Web Origins usando tu IP
./kcadm.sh create clients -r spynet-realm \
  -s clientId=agente-web-client \
  -s enabled=true \
  -s publicClient=true \
  -s directAccessGrantsEnabled=false \
  -s rootUrl="http://${SERVER_IP}:3000/" \
  -s "redirectUris=[\"http://${SERVER_IP}:3000/*\"]" \
  -s "webOrigins=[\"+\"]" \
  -s protocol=openid-connect

echo "✅ Cliente 'agente-web-client' configurado para IP: $SERVER_IP"

# ---------------------------------------------------------
# 6. CREAR USUARIO "pepo" Y ASIGNAR PASSWORD
# ---------------------------------------------------------
# Crear usuario
./kcadm.sh create users -r spynet-realm \
  -s username=pepo \
  -s enabled=true \
  -s email=agente007@spynet.com \
  -s firstName="Agente" \
  -s lastName="Pepo"

./kcadm.sh create users -r spynet-realm \
  -s username=pez \
  -s enabled=true \
  -s email=pez@spynet.com \
  -s firstName="Agente" \
  -s lastName="Pez"

# Asignar password (1234)
./kcadm.sh set-password -r spynet-realm --username pepo --new-password 1234
./kcadm.sh set-password -r spynet-realm --username pez --new-password 123


echo "✅ Usuario 'pepo' creado con password"

# ---------------------------------------------------------
# 7. ASIGNAR ROLES AL USUARIO
# ---------------------------------------------------------
# Asignamos los roles que creamos antes al usuario pepo
./kcadm.sh add-roles -r spynet-realm --uusername pepo --rolename nivel-00
./kcadm.sh add-roles -r spynet-realm --uusername pez --rolename agente-premium

echo "✅ Roles asignados a 'pepo'. ¡Configuración completada!"