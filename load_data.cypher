// ============================================================
// SCRIPT CYPHER - Sistema de Detección de Fraude Bancario
// Universidad del Valle de Guatemala - CC3089 Base de Datos 2
// ============================================================
// INSTRUCCIONES:
// 1. Sube tus CSVs a un lugar accesible (GitHub raw, Google Drive público, etc.)
// 2. Reemplaza BASE_URL con la URL donde están tus CSVs
// 3. Ejecuta estas queries en Neo4j Browser o AuraDB
// ============================================================

// ─── PASO 0: Limpiar BD (solo si quieres empezar de cero) ───
// MATCH (n) DETACH DELETE n;

// ─── PASO 1: Crear índices para mejor rendimiento ───
CREATE INDEX IF NOT EXISTS FOR (u:Usuario) ON (u.id_usuario);
CREATE INDEX IF NOT EXISTS FOR (c:Cuenta) ON (c.id_cuenta);
CREATE INDEX IF NOT EXISTS FOR (t:Transaccion) ON (t.id_transaccion);
CREATE INDEX IF NOT EXISTS FOR (d:Dispositivo) ON (d.id_dispositivo);
CREATE INDEX IF NOT EXISTS FOR (ub:Ubicacion) ON (ub.id_ubicacion);

// ─── PASO 2: Cargar UBICACIONES ───
// Reemplaza <TU_URL_BASE> con donde subiste tus CSVs
LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/data_csv/ubicaciones.csv' AS row
CREATE (:Ubicacion {
    id_ubicacion: toInteger(row.id_ubicacion),
    pais: row.pais,
    ciudad: row.ciudad,
    latitud: toFloat(row.latitud),
    longitud: toFloat(row.longitud),
    zonas_riesgo: split(row.zonas_riesgo, '|')
});

// ─── PASO 3: Cargar USUARIOS ───
LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/data_csv/usuarios.csv' AS row
CREATE (:Usuario {
    id_usuario: toInteger(row.id_usuario),
    nombre: row.nombre,
    email: row.email,
    fecha_registro: date(row.fecha_registro),
    estado: row.estado = 'True',
    telefono: row.telefono,
    ocupacion: row.ocupacion,
    score_credito: toInteger(row.score_credito)
});

// ─── PASO 4: Cargar DISPOSITIVOS ───
LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/data_csv/dispositivos.csv' AS row
CREATE (:Dispositivo {
    id_dispositivo: toInteger(row.id_dispositivo),
    tipo: row.tipo,
    ip: row.ip,
    sistema_operativo: row.sistema_operativo,
    ubicacion: row.ubicacion,
    marca: row.marca,
    verificado: row.verificado = 'True'
});

// ─── PASO 5: Cargar CUENTAS ───
LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/data_csv/cuentas.csv' AS row
CREATE (:Cuenta {
    id_cuenta: toInteger(row.id_cuenta),
    tipo: row.tipo,
    saldo: toFloat(row.saldo),
    fecha_creacion: date(row.fecha_creacion),
    estado: row.estado = 'True',
    moneda: row.moneda,
    limite_diario: toFloat(row.limite_diario)
});

// ─── PASO 6: Cargar TRANSACCIONES ───
LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/data_csv/transacciones.csv' AS row
CREATE (:Transaccion {
    id_transaccion: toInteger(row.id_transaccion),
    monto: toFloat(row.monto),
    fecha: date(row.fecha),
    tipo: row.tipo,
    es_fraudulenta: row.es_fraudulenta = 'True',
    moneda: row.moneda,
    descripcion: row.descripcion,
    canal: row.canal
});

// ─── PASO 7: Crear RELACIONES ───

// TIENE: Usuario -> Cuenta
LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/data_csv/rel_tiene.csv' AS row
MATCH (u:Usuario {id_usuario: toInteger(row.id_usuario)})
MATCH (c:Cuenta {id_cuenta: toInteger(row.id_cuenta)})
CREATE (u)-[:TIENE {
    fecha_asociacion: date(row.fecha_asociacion),
    tipo_relacion: row.tipo_relacion,
    activo: row.activo = 'True'
}]->(c);

// PERTENECE_A: Cuenta -> Usuario
LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/data_csv/rel_tiene.csv' AS row
MATCH (c:Cuenta {id_cuenta: toInteger(row.id_cuenta)})
MATCH (u:Usuario {id_usuario: toInteger(row.id_usuario)})
CREATE (c)-[:PERTENECE_A {
    fecha: date(row.fecha_asociacion),
    principal: row.tipo_relacion = 'Titular',
    estado: row.activo
}]->(u);

// REALIZA: Cuenta -> Transaccion (origen)
LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/data_csv/transacciones.csv' AS row
MATCH (c:Cuenta {id_cuenta: toInteger(row.id_cuenta_origen)})
MATCH (t:Transaccion {id_transaccion: toInteger(row.id_transaccion)})
CREATE (c)-[:REALIZA {
    fecha: date(row.fecha),
    monto: toFloat(row.monto),
    canal: row.canal
}]->(t);

// ORIGEN: Transaccion -> Cuenta
LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/data_csv/transacciones.csv' AS row
MATCH (t:Transaccion {id_transaccion: toInteger(row.id_transaccion)})
MATCH (c:Cuenta {id_cuenta: toInteger(row.id_cuenta_origen)})
CREATE (t)-[:ORIGEN {
    monto: toFloat(row.monto),
    moneda: row.moneda,
    validada: NOT (row.es_fraudulenta = 'True')
}]->(c);

// DESTINO: Transaccion -> Cuenta destino
LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/data_csv/transacciones.csv' AS row
MATCH (t:Transaccion {id_transaccion: toInteger(row.id_transaccion)})
MATCH (c:Cuenta {id_cuenta: toInteger(row.id_cuenta_destino)})
CREATE (t)-[:DESTINO {
    monto: toFloat(row.monto),
    moneda: row.moneda,
    confirmado: NOT (row.es_fraudulenta = 'True')
}]->(c);

// USA: Usuario -> Dispositivo
LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/data_csv/rel_usa.csv' AS row
MATCH (u:Usuario {id_usuario: toInteger(row.id_usuario)})
MATCH (d:Dispositivo {id_dispositivo: toInteger(row.id_dispositivo)})
MERGE (u)-[:USA {
    fecha_uso: date(row.fecha_uso),
    frecuencia: toInteger(row.frecuencia),
    activo: row.activo = 'True'
}]->(d);

// UBICADO_EN: Dispositivo -> Ubicacion
LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/data_csv/rel_ubicado_en.csv' AS row
MATCH (d:Dispositivo {id_dispositivo: toInteger(row.id_dispositivo)})
MATCH (ub:Ubicacion {id_ubicacion: toInteger(row.id_ubicacion)})
CREATE (d)-[:UBICADO_EN {
    fecha: date(row.fecha),
    precision: toFloat(row.precision),
    verificado: row.verificado = 'True'
}]->(ub);

// REALIZADA_DESDE: Transaccion -> Dispositivo
LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/data_csv/transacciones.csv' AS row
MATCH (t:Transaccion {id_transaccion: toInteger(row.id_transaccion)})
MATCH (d:Dispositivo {id_dispositivo: toInteger(row.id_dispositivo)})
CREATE (t)-[:REALIZADA_DESDE {
    ip: row.id_dispositivo + '.0.0.1',
    fecha: date(row.fecha),
    riesgo: CASE WHEN row.es_fraudulenta = 'True' THEN toFloat(random()) * 0.4 + 0.6 ELSE toFloat(random()) * 0.3 END
}]->(d);

// OCURRE_EN: Transaccion -> Ubicacion
LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/data_csv/transacciones.csv' AS row
MATCH (t:Transaccion {id_transaccion: toInteger(row.id_transaccion)})
MATCH (ub:Ubicacion {id_ubicacion: toInteger(row.id_ubicacion)})
CREATE (t)-[:OCURRE_EN {
    fecha: date(row.fecha),
    pais: ub.pais,
    riesgo: CASE WHEN row.es_fraudulenta = 'True' THEN 0.8 ELSE 0.2 END
}]->(ub);

// REGISTRADO_EN: Usuario -> Ubicacion
LOAD CSV WITH HEADERS FROM 'https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/data_csv/rel_registrado_en.csv' AS row
MATCH (u:Usuario {id_usuario: toInteger(row.id_usuario)})
MATCH (ub:Ubicacion {id_ubicacion: toInteger(row.id_ubicacion)})
CREATE (u)-[:REGISTRADO_EN {
    fecha: date(row.fecha),
    tipo: row.tipo,
    verificado: row.verificado = 'True'
}]->(ub);

// ─── VERIFICACIÓN FINAL ───
MATCH (n) RETURN labels(n)[0] as Tipo, count(n) as Total ORDER BY Total DESC;
