"""
Script para generar datos simulados del Sistema de Detección de Fraude Bancario
Genera CSVs para cargar en Neo4j AuraDB
Ejecutar: pip install faker && python generate_data.py
"""

import csv
import random
from datetime import datetime, timedelta
import os

# Intentar importar faker, si no está instalado usar datos básicos
try:
    from faker import Faker
    fake = Faker('es_MX')
    USE_FAKER = True
except ImportError:
    print("Faker no instalado. Usando datos básicos.")
    print("Para mejor calidad: pip install faker")
    USE_FAKER = False

random.seed(42)

# ===================== CONFIGURACIÓN =====================
NUM_USUARIOS = 1000
NUM_CUENTAS = 1500
NUM_TRANSACCIONES = 2000
NUM_DISPOSITIVOS = 600
NUM_UBICACIONES = 200
# Total mínimo: 5300 nodos ✓

OUTPUT_DIR = "data_csv"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ===================== HELPERS =====================
def random_date(start_year=2020, end_year=2025):
    start = datetime(start_year, 1, 1)
    end = datetime(end_year, 12, 31)
    delta = end - start
    return (start + timedelta(days=random.randint(0, delta.days))).strftime("%Y-%m-%d")

def random_ip():
    return f"{random.randint(1,255)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}"

NOMBRES = ["Carlos","María","Juan","Ana","Pedro","Luisa","Diego","Sofia","Miguel","Elena",
           "Roberto","Carmen","Fernando","Isabel","Alejandro","Valentina","Ricardo","Daniela",
           "Eduardo","Paola","Andrés","Gabriela","Luis","Patricia","Jorge","Claudia"]
APELLIDOS = ["García","López","Martínez","Rodríguez","Hernández","González","Pérez","Sánchez",
             "Ramírez","Torres","Flores","Rivera","Morales","Cruz","Reyes","Jiménez"]

PAISES = ["Guatemala","México","Colombia","Argentina","España","Estados Unidos",
          "Brasil","Chile","Perú","Venezuela","Ecuador","Bolivia","Paraguay","Uruguay"]
CIUDADES = {
    "Guatemala": ["Guatemala City","Quetzaltenango","Escuintla","Mixco","Villa Nueva"],
    "México": ["Ciudad de México","Guadalajara","Monterrey","Puebla","Cancún"],
    "Colombia": ["Bogotá","Medellín","Cali","Barranquilla","Cartagena"],
    "Argentina": ["Buenos Aires","Córdoba","Rosario","Mendoza","La Plata"],
    "España": ["Madrid","Barcelona","Valencia","Sevilla","Bilbao"],
    "Estados Unidos": ["New York","Los Angeles","Chicago","Houston","Miami"],
    "Brasil": ["São Paulo","Rio de Janeiro","Brasília","Salvador","Fortaleza"],
    "Chile": ["Santiago","Valparaíso","Concepción","La Serena","Antofagasta"],
    "Perú": ["Lima","Arequipa","Cusco","Trujillo","Chiclayo"],
    "Venezuela": ["Caracas","Maracaibo","Valencia","Barquisimeto","Mérida"],
    "Ecuador": ["Quito","Guayaquil","Cuenca","Santo Domingo","Manta"],
    "Bolivia": ["La Paz","Santa Cruz","Cochabamba","Sucre","Oruro"],
    "Paraguay": ["Asunción","Ciudad del Este","San Lorenzo","Luque","Capiatá"],
    "Uruguay": ["Montevideo","Salto","Ciudad de la Costa","Paysandú","Las Piedras"]
}

TIPOS_CUENTA = ["Ahorro","Corriente","Inversión","Empresarial","Nómina"]
TIPOS_TRANSACCION = ["Transferencia","Pago","Retiro","Depósito","Compra","Préstamo"]
TIPOS_DISPOSITIVO = ["Móvil","Computadora","Tablet","ATM","POS"]
SISTEMAS_OS = ["Android","iOS","Windows","macOS","Linux"]
CANALES = ["App Móvil","Web","ATM","Sucursal","Telefónico"]
MONEDAS = ["GTQ","USD","EUR","MXN","COP"]

# ===================== GENERAR UBICACIONES =====================
print("Generando ubicaciones...")
ubicaciones = []
for i in range(1, NUM_UBICACIONES + 1):
    pais = random.choice(PAISES)
    ciudad = random.choice(CIUDADES[pais])
    ubicaciones.append({
        "id_ubicacion": i,
        "pais": pais,
        "ciudad": ciudad,
        "latitud": round(random.uniform(-55, 72), 6),
        "longitud": round(random.uniform(-180, 180), 6),
        # Lista como string separado por pipe (Neo4j lo puede manejar)
        "zonas_riesgo": f"zona_{random.randint(1,5)}|zona_{random.randint(6,10)}"
    })

with open(f"{OUTPUT_DIR}/ubicaciones.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=ubicaciones[0].keys())
    writer.writeheader()
    writer.writerows(ubicaciones)
print(f"  ✓ {len(ubicaciones)} ubicaciones")

# ===================== GENERAR USUARIOS =====================
print("Generando usuarios...")
usuarios = []
for i in range(1, NUM_USUARIOS + 1):
    nombre = f"{random.choice(NOMBRES)} {random.choice(APELLIDOS)}"
    if USE_FAKER:
        email = fake.email()
    else:
        email = f"user{i}@banco{random.randint(1,5)}.com"
    
    usuarios.append({
        "id_usuario": i,
        "nombre": nombre,
        "email": email,
        "fecha_registro": random_date(2018, 2023),
        "estado": random.choice([True, True, True, False]),  # 75% activos
        "telefono": f"+502{random.randint(10000000, 99999999)}",
        "ocupacion": random.choice(["Empleado","Empresario","Estudiante","Independiente","Jubilado"]),
        "score_credito": random.randint(300, 850),
        "id_ubicacion_registro": random.randint(1, NUM_UBICACIONES)
    })

with open(f"{OUTPUT_DIR}/usuarios.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=usuarios[0].keys())
    writer.writeheader()
    writer.writerows(usuarios)
print(f"  ✓ {len(usuarios)} usuarios")

# ===================== GENERAR DISPOSITIVOS =====================
print("Generando dispositivos...")
dispositivos = []
for i in range(1, NUM_DISPOSITIVOS + 1):
    dispositivos.append({
        "id_dispositivo": i,
        "tipo": random.choice(TIPOS_DISPOSITIVO),
        "ip": random_ip(),
        "sistema_operativo": random.choice(SISTEMAS_OS),
        "ubicacion": random.choice(PAISES),
        "marca": random.choice(["Samsung","Apple","Huawei","Xiaomi","LG","Dell","HP"]),
        "verificado": random.choice([True, True, False]),
        "id_ubicacion": random.randint(1, NUM_UBICACIONES)
    })

with open(f"{OUTPUT_DIR}/dispositivos.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=dispositivos[0].keys())
    writer.writeheader()
    writer.writerows(dispositivos)
print(f"  ✓ {len(dispositivos)} dispositivos")

# ===================== GENERAR CUENTAS =====================
print("Generando cuentas...")
cuentas = []
for i in range(1, NUM_CUENTAS + 1):
    cuentas.append({
        "id_cuenta": i,
        "tipo": random.choice(TIPOS_CUENTA),
        "saldo": round(random.uniform(100, 500000), 2),
        "fecha_creacion": random_date(2015, 2024),
        "estado": random.choice([True, True, True, False]),
        "moneda": random.choice(MONEDAS),
        "limite_diario": round(random.uniform(1000, 50000), 2),
        "id_usuario_principal": random.randint(1, NUM_USUARIOS)
    })

with open(f"{OUTPUT_DIR}/cuentas.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=cuentas[0].keys())
    writer.writeheader()
    writer.writerows(cuentas)
print(f"  ✓ {len(cuentas)} cuentas")

# ===================== GENERAR TRANSACCIONES =====================
print("Generando transacciones...")
transacciones = []
for i in range(1, NUM_TRANSACCIONES + 1):
    cuenta_origen = random.randint(1, NUM_CUENTAS)
    cuenta_destino = random.randint(1, NUM_CUENTAS)
    while cuenta_destino == cuenta_origen:
        cuenta_destino = random.randint(1, NUM_CUENTAS)
    
    monto = round(random.uniform(10, 50000), 2)
    # ~8% son fraudulentas
    es_fraude = random.random() < 0.08
    
    transacciones.append({
        "id_transaccion": i,
        "monto": monto,
        "fecha": random_date(2022, 2025),
        "tipo": random.choice(TIPOS_TRANSACCION),
        "es_fraudulenta": es_fraude,
        "moneda": random.choice(MONEDAS),
        "descripcion": f"TXN-{i:06d}",
        "canal": random.choice(CANALES),
        "id_cuenta_origen": cuenta_origen,
        "id_cuenta_destino": cuenta_destino,
        "id_dispositivo": random.randint(1, NUM_DISPOSITIVOS),
        "id_ubicacion": random.randint(1, NUM_UBICACIONES)
    })

with open(f"{OUTPUT_DIR}/transacciones.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=transacciones[0].keys())
    writer.writeheader()
    writer.writerows(transacciones)
print(f"  ✓ {len(transacciones)} transacciones")

# ===================== GENERAR RELACIONES =====================
print("Generando relaciones...")

# TIENE: Usuario -> Cuenta
tiene_rel = []
for cuenta in cuentas:
    uid = cuenta["id_usuario_principal"]
    tiene_rel.append({
        "id_usuario": uid,
        "id_cuenta": cuenta["id_cuenta"],
        "fecha_asociacion": random_date(2018, 2024),
        "tipo_relacion": random.choice(["Titular","Beneficiario","Autorizado"]),
        "activo": random.choice([True, True, False])
    })
# Algunos usuarios tienen múltiples cuentas (esto es normal)

with open(f"{OUTPUT_DIR}/rel_tiene.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=tiene_rel[0].keys())
    writer.writeheader()
    writer.writerows(tiene_rel)
print(f"  ✓ {len(tiene_rel)} relaciones TIENE")

# USA: Usuario -> Dispositivo
usa_rel = []
used = set()
for u in usuarios:
    num_disp = random.randint(1, 3)
    for _ in range(num_disp):
        did = random.randint(1, NUM_DISPOSITIVOS)
        key = (u["id_usuario"], did)
        if key not in used:
            used.add(key)
            usa_rel.append({
                "id_usuario": u["id_usuario"],
                "id_dispositivo": did,
                "fecha_uso": random_date(2022, 2025),
                "frecuencia": random.randint(1, 200),
                "activo": random.choice([True, True, False])
            })

with open(f"{OUTPUT_DIR}/rel_usa.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=usa_rel[0].keys())
    writer.writeheader()
    writer.writerows(usa_rel)
print(f"  ✓ {len(usa_rel)} relaciones USA")

# REGISTRADO_EN: Usuario -> Ubicacion
reg_rel = []
for u in usuarios:
    reg_rel.append({
        "id_usuario": u["id_usuario"],
        "id_ubicacion": u["id_ubicacion_registro"],
        "fecha": random_date(2018, 2023),
        "tipo": random.choice(["Residencia","Trabajo","Temporal"]),
        "verificado": random.choice([True, False])
    })

with open(f"{OUTPUT_DIR}/rel_registrado_en.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=reg_rel[0].keys())
    writer.writeheader()
    writer.writerows(reg_rel)
print(f"  ✓ {len(reg_rel)} relaciones REGISTRADO_EN")

# UBICADO_EN: Dispositivo -> Ubicacion
ubic_rel = []
for d in dispositivos:
    ubic_rel.append({
        "id_dispositivo": d["id_dispositivo"],
        "id_ubicacion": d["id_ubicacion"],
        "fecha": random_date(2022, 2025),
        "precision": round(random.uniform(0.5, 1.0), 2),
        "verificado": random.choice([True, False])
    })

with open(f"{OUTPUT_DIR}/rel_ubicado_en.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=ubic_rel[0].keys())
    writer.writeheader()
    writer.writerows(ubic_rel)
print(f"  ✓ {len(ubic_rel)} relaciones UBICADO_EN")

print("\n✅ Todos los CSVs generados en carpeta 'data_csv/'")
print(f"\n📊 RESUMEN DE NODOS:")
print(f"   Usuarios:       {NUM_USUARIOS}")
print(f"   Cuentas:        {NUM_CUENTAS}")
print(f"   Transacciones:  {NUM_TRANSACCIONES}")
print(f"   Dispositivos:   {NUM_DISPOSITIVOS}")
print(f"   Ubicaciones:    {NUM_UBICACIONES}")
print(f"   TOTAL:          {NUM_USUARIOS+NUM_CUENTAS+NUM_TRANSACCIONES+NUM_DISPOSITIVOS+NUM_UBICACIONES} nodos ✓")
print(f"\n📂 Archivos creados:")
for f in os.listdir(OUTPUT_DIR):
    print(f"   - {OUTPUT_DIR}/{f}")
