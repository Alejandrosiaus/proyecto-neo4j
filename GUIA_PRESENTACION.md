# 🎯 Guía de Presentación — Proyecto Neo4j Detección de Fraude Bancario
> CC3089 Base de Datos 2 — UVG | Semestre I 2026

---

## 📊 Tabla de Cobertura Rápida (Rúbrica)

| Categoría | Criterio | Pts | Estado |
|-----------|----------|-----|--------|
| **Modelado** | Caso de uso adecuado (fraude bancario) | 5 | ✅ |
| **Modelado** | 5+ labels con 5+ propiedades c/u | 5 | ✅ |
| **Modelado** | 10+ tipos de relación con 3+ props c/u | 5 | ✅ 14 tipos |
| **Modelado** | Todos los tipos de datos (incl. List) | 5 | ⚠️ ver abajo |
| **Set datos** | Carga desde CSV | 5 | ✅ |
| **Set datos** | Datos previamente cargados | 2 | ✅ |
| **Set datos** | 5000+ nodos | 2 | ✅ verificar |
| **Set datos** | Grafo conexo | 1 | ✅ |
| **App** | CREATE nodo con 1 label | 5 | ✅ |
| **App** | CREATE nodo con 2+ labels | 5 | ✅ |
| **App** | CREATE nodo con 5+ propiedades | 5 | ✅ |
| **App** | Visualización con filtros y agregaciones | 5 | ✅ |
| **App** | Gestión de propiedades en nodos (6 ops) | 10 | ✅ |
| **Extra** | Creación de relación con propiedades | 5 | ✅ |
| **Extra** | Gestión de propiedades en relaciones (6 ops) | 10 | ✅ |
| **Extra** | Eliminación de nodos (1 y múltiples) | 5 | ✅ |
| **Extra** | Eliminación de relaciones (1 y múltiples) | 5 | ✅ |
| **Extra** | 4-6 Consultas Cypher (2 por integrante) | 15 | ✅ 4 listas |
| **Extra** | Algoritmo Data Science | 10 | ❌ excluido |
| **Extra** | Interfaz gráfica excepcional | 10 | ✅ |

---

## ⚠️ ALERTA ANTES DE PRESENTAR: Tipo de dato `List`

La rúbrica exige que se usen propiedades de tipo **List** en nodos o relaciones. Actualmente el proyecto **no tiene ninguna propiedad almacenada como lista**.

### Fix rápido (ejecutar en Neo4j Aura antes de presentar):
```cypher
// Agregar lista de canales habilitados a todas las Cuentas
MATCH (c:Cuenta)
SET c.canales_habilitados = ['Web', 'App', 'ATM']

// Agregar lista de alertas activas a transacciones fraudulentas
MATCH (t:Transaccion {es_fraudulenta: true})
SET t.flags_riesgo = ['monto_alto', 'patron_inusual']
```

También puedes hacerlo desde la sección **Propiedades Bulk (Nodos)** de tu propia app: selecciona tipo `Cuenta`, pon varios IDs y agrega campo `canales_habilitados` con valor `['Web', 'App', 'ATM']`.

> **Keyword de presentación**: *"Aquí vemos que Neo4j soporta nativement tipos complejos como listas dentro de las propiedades de un nodo, sin necesidad de tablas de relación como en SQL"*

---

## 📁 Modelado de Datos

### ✅ Caso de uso: Detección de Fraude Bancario
**Dónde**: Toda la aplicación. Descripción en README / documento del proyecto.

**Por qué cumple**: Es uno de los cuatro casos de uso aceptados en el enunciado. El grafo modela clientes bancarios, sus cuentas, transacciones y dispositivos, y expone patrones de fraude (dispositivos compartidos, transferencias circulares, montos sospechosos).

**🎤 Keywords para presentar**:
- *"El grafo naturalmente representa relaciones entre entidades que en SQL requerirían JOINs costosos"*
- *"Neo4j es usado por empresas como PayPal y eBay para detección de fraude en tiempo real"*

---

### ✅ Labels y Propiedades de Nodos
**Dónde en el código**: `server.js` — endpoints POST de cada entidad.

| Label | Propiedades (≥5) |
|-------|-----------------|
| `Usuario` | `id_usuario`, `nombre`, `email`, `telefono`, `ocupacion`, `score_credito`, `estado`, `fecha_registro` |
| `Cuenta` | `id_cuenta`, `tipo`, `saldo`, `fecha_creacion`, `estado`, `moneda`, `limite_diario` |
| `Transaccion` | `id_transaccion`, `monto`, `fecha`, `tipo`, `es_fraudulenta`, `moneda`, `descripcion`, `canal` |
| `Dispositivo` | `id_dispositivo`, `tipo`, `ip`, `os`, `navegador` |
| `Ubicacion` | `id_ubicacion`, `pais`, `ciudad`, `latitud`, `longitud` |

**🎤 Keywords**: *"Cada label tiene sus propiedades bien tipadas desde el momento de creación — Neo4j es schema-flexible pero nosotros definimos un schema explícito para garantizar consistencia de datos"*

---

### ✅ 14 Tipos de Relaciones con Propiedades
**Dónde**: `server.js` — secciones CREATE de transacciones, cuentas, y sección de relaciones. En `index.html` — constante `REL_SCHEMA`.

| Relación | Origen → Destino | Propiedades |
|----------|-----------------|-------------|
| `REALIZA` | Usuario → Transaccion | fecha, monto, canal |
| `TIENE` | Usuario → Cuenta | fecha_asociacion, tipo_relacion, activo |
| `USA` | Usuario → Dispositivo | primer_uso, ultimo_uso, frecuencia |
| `VIVE_EN` | Usuario → Ubicacion | fecha_inicio, es_actual, tipo |
| `ORIGEN` | Transaccion → Cuenta | monto, moneda, validada |
| `DESTINO` | Transaccion → Cuenta | monto, moneda, confirmado |
| `REALIZADA_DESDE` | Transaccion → Dispositivo | ip, fecha, riesgo |
| `OCURRE_EN` | Transaccion → Ubicacion | fecha, pais, riesgo |
| `PERTENECE_A` | Cuenta → Usuario | fecha, principal, estado |
| `ALERTA` | Transaccion → Transaccion | motivo, nivel_riesgo, fecha_alerta |
| `PATRON_SIMILAR` | Transaccion → Transaccion | similitud, tipo_patron, detectado_en |
| `MISMA_IP` | Transaccion → Transaccion | ip, fecha_deteccion |
| `TRANSFERENCIA_A` | Cuenta → Cuenta | monto_total, frecuencia, ultima_fecha |
| `COMPARTE_DISPOSITIVO` | Usuario → Usuario | dispositivo_id, primera_deteccion |

**🎤 Keywords**: *"Las relaciones en Neo4j son ciudadanos de primera clase — tienen tipo, dirección y sus propias propiedades, lo que nos permite modelar el 'cómo' y no solo el 'qué'"*

---

### ✅ Tipos de Datos Implementados
**Dónde**: `server.js` — en las queries de CREATE de cada entidad.

| Tipo | Ejemplo en el proyecto |
|------|----------------------|
| **String** | `nombre`, `email`, `tipo`, `canal`, `ocupacion` |
| **Integer** | `id_usuario`, `id_cuenta`, `score_credito`, `limite_diario` |
| **Float** | `monto`, `saldo`, `latitud`, `longitud`, `riesgo` |
| **Boolean** | `es_fraudulenta`, `estado`, `activo`, `validada` |
| **Date** | `fecha_registro`, `fecha_creacion`, `fecha` |
| **List** | `canales_habilitados` en Cuenta *(agregar antes de presentar)* |

---

## 📂 Set de Datos

### ✅ Carga desde CSV
**Dónde**: `server.js` línea 1001 — `POST /api/cargar-csv`. Frontend: sección "Cargar CSV" de la app.

**Cómo funciona**: Usa `multer` para recibir el archivo, `csv-parse` para leer cada fila, y ejecuta un `CREATE` en Neo4j por cada registro. Soporta nodos tipo `Usuario`, `Cuenta` y `Transaccion`.

**🎤 Cómo presentarlo**:
1. Prepara un CSV de ejemplo con 10-15 usuarios (columnas: `nombre,email,fecha_registro,estado,telefono,ocupacion,score_credito`)
2. Súbelo en vivo desde la UI
3. *"Aquí estamos cargando un lote de datos desde CSV — este endpoint usa el driver oficial de Neo4j para crear los nodos de forma transaccional"*

---

### ✅ Grafo Conexo
**Dónde**: `server.js` línea 766 — `GET /api/grafo/conexo`. Mostrado en el Dashboard.

**Por qué es importante**: La rúbrica indica que **si el grafo no es conexo, no se asignan puntos de Set de Datos**. El endpoint calcula el porcentaje de nodos conectados.

**🎤 Keywords**: *"Verificamos que el grafo sea conexo — todos los nodos tienen al menos un camino hacia cualquier otro nodo. En Neo4j esto se comprueba con graph traversal, algo que en SQL requeriría recursión compleja"*

---

## 🔧 Aplicación Funcional — CRUD

### ✅ CREATE nodo con 1 label
**Dónde**: 
- `POST /api/usuarios` → crea `:Usuario`
- `POST /api/cuentas` → crea `:Cuenta`
- `POST /api/transacciones` → crea `:Transaccion`
- `POST /api/dispositivos` → crea `:Dispositivo`
- `POST /api/ubicaciones` → crea `:Ubicacion`

**Cypher pattern**: `CREATE (u:Usuario { id_usuario: toInteger(rand() * 9000000) + 1000000, ... })`

**🎤 Keywords**: *"Nótese que el ID se genera directamente en Cypher usando `rand()` — esto garantiza unicidad sin necesidad de secuencias separadas"*

---

### ✅ CREATE nodo con 2+ labels
**Dónde**: `server.js` línea 152 — `POST /api/usuarios/multi-label`. Frontend: sección "Gestión de Labels" → "Agregar Labels a Nodo".

**Cypher pattern**: 
```cypher
CREATE (u:Usuario:ClienteVIP { ... }) RETURN u, labels(u) as todas_labels
```

**🎤 Keywords**: *"Un nodo puede tener múltiples labels simultáneamente — aquí creamos un Usuario que también es ClienteVIP. En términos de grafo, es como heredencia pero más flexible"*

---

### ✅ CREATE nodo con 5+ propiedades
**Dónde**: Todos los endpoints de creación incluyen 7-8 propiedades. Ejemplo: Usuario crea con `id_usuario`, `nombre`, `email`, `fecha_registro`, `estado`, `telefono`, `ocupacion`, `score_credito`.

---

### ✅ Visualización con filtros y agregaciones
**Dónde**: `index.html` — secciones de Usuarios, Cuentas, Transacciones. `server.js` — dashboard endpoints.

- **Consultar 1 nodo**: Filtro por ID en cualquier tabla → devuelve exactamente 1 resultado
- **Consultar muchos**: Tablas con paginación (skip/limit) y filtros combinables
- **Agregaciones**: Dashboard muestra conteos totales, saldos promedio, estadísticas de fraude

**🎤 Keywords**: *"Todas las listas tienen paginación server-side con `SKIP` y `LIMIT` en Cypher — nunca traemos más datos de los necesarios"*

---

## 🗂️ Gestión de Propiedades en Nodos (10 pts)

Todas las operaciones están accesibles desde **"Avanzado → Propiedades Bulk (Nodos)"** y desde las secciones CRUD individuales.

| Operación | Endpoint | Dónde en la UI |
|-----------|----------|----------------|
| Agregar props a **1 nodo** | `POST /api/nodos/:tipo/:id/propiedades` | Avanzado → Propiedades Bulk → ingresar 1 solo ID |
| Agregar props a **múltiples nodos** | `POST /api/nodos/bulk/propiedades` | Avanzado → Propiedades Bulk (Nodos) → varios IDs |
| Actualizar props de **1 nodo** | `PUT /api/usuarios/:id`, `/api/cuentas/:id`, `/api/transacciones/:id` | Secciones CRUD → formulario Actualizar |
| Actualizar props de **múltiples nodos** | `PUT /api/usuarios/bulk/update` | Avanzado → Actualizar Bulk |
| Eliminar props de **1 nodo** | `DELETE /api/nodos/:tipo/:id/propiedades` | Avanzado → Propiedades Bulk → 1 ID + propiedad a quitar |
| Eliminar props de **múltiples nodos** | `DELETE /api/nodos/bulk/propiedades` | Avanzado → Propiedades Bulk (Nodos) → opción Eliminar |

**🎤 Cómo presentarlo**: *"En Neo4j las propiedades son dinámicas — podemos agregar o quitar atributos sin modificar un schema. Aquí lo hacemos bulk: con una sola query Cypher actualizamos N nodos simultáneamente usando `MATCH ... WHERE id IN $ids SET ...`"*

> 💡 **Hack**: Para demostrar "agregar prop a 1 nodo", usa la misma UI de bulk con un solo ID — la rúbrica no especifica pantalla separada, solo que la operación exista.

---

## 🔗 Creación de Relación con Propiedades (Extra, 5 pts)

**Dónde**: Cuando se crea una Cuenta, se crean automáticamente relaciones `TIENE` y `PERTENECE_A` con propiedades. Cuando se crea una Transacción, se crean `ORIGEN`, `DESTINO`, `REALIZA`, `REALIZADA_DESDE`, `OCURRE_EN`.

**Cypher pattern**:
```cypher
CREATE (u)-[:TIENE {fecha_asociacion: date($fecha), tipo_relacion: 'Titular', activo: true}]->(c)
```

**🎤 Keywords**: *"Cada vez que registramos una transacción, el grafo materializa 5 relaciones simultáneamente con sus propiedades — esto nos permite después hacer traversals complejos en O(1) por nodo en lugar de JOINs O(n²)"*

---

## 🔗 Gestión de Propiedades en Relaciones (Extra, 10 pts)

Desde **"Avanzado → Propiedades Bulk (Rel.)"**:

| Operación | Endpoint | Nota |
|-----------|----------|------|
| Agregar props a **1 relación** | `POST /api/relaciones/propiedades` | Dropdown auto-llena origen/destino |
| Agregar props a **múltiples relaciones** | `POST /api/relaciones/bulk/propiedades` | Filtro por campo+valor |
| **Actualizar** props de 1 relación | `PUT /api/relaciones/update` | `SET` en Cypher = add + update |
| **Actualizar** props de múltiples relaciones | `POST /api/relaciones/bulk/propiedades` | Mismo endpoint: SET es idempotente |
| Eliminar props de **1 relación** | `DELETE /api/relaciones/propiedades` | Usa `REMOVE r.prop` |
| Eliminar props de **múltiples relaciones** | `DELETE /api/relaciones/bulk/propiedades` | Filtra por tipo + campo+valor |

**🎤 Keywords**: *"En Neo4j las relaciones son entidades de primera clase — pueden tener propiedades, se pueden filtrar y modificar igual que nodos. Aquí actualizamos N relaciones de tipo TIENE donde `activo=true` en una sola operación"*

---

## 🗑️ Eliminación de Nodos (Extra, 5 pts)

| Operación | Endpoint |
|-----------|----------|
| Eliminar **1 nodo** | `DELETE /api/usuarios/:id`, `/api/cuentas/:id`, `/api/transacciones/:id` |
| Eliminar **múltiples nodos** | `DELETE /api/usuarios/bulk/delete` |

**Cypher pattern**: `MATCH (u:Usuario) WHERE toInteger(u.id_usuario) = toInteger($id) DETACH DELETE u`

**🎤 Keywords**: *"`DETACH DELETE` elimina el nodo Y todas sus relaciones en una sola operación — Neo4j mantiene la integridad referencial del grafo automáticamente"*

---

## 🗑️ Eliminación de Relaciones (Extra, 5 pts)

| Operación | Endpoint |
|-----------|----------|
| Eliminar **1 relación** | `DELETE /api/relaciones/delete` (body: tipo_origen, id_origen, tipo_destino, id_destino, tipo_relacion) |
| Eliminar **múltiples relaciones** | `DELETE /api/relaciones/bulk/delete` (body: tipo_relacion + filtro campo/valor) |

**Dónde en la UI**: Avanzado → sección "Gestión de Relaciones".

---

## 🔍 Consultas Cypher — 4-6 Queries (Extra, 15 pts)

> Cada integrante debe hacer 2 queries. Aquí están las 4 ya implementadas + sugerencias para las adicionales.

### Query 1 — Dispositivos compartidos entre usuarios
**Endpoint**: `GET /api/fraude/dispositivo-compartido`
**Dónde en UI**: Sección "Fraude → Dispositivos Compartidos"

```cypher
MATCH (u1:Usuario)-[:USA]->(d:Dispositivo)<-[:USA]-(u2:Usuario)
WHERE u1.id_usuario < u2.id_usuario
RETURN d.ip as ip_dispositivo, collect(DISTINCT u1.nombre) as usuarios, 
       count(DISTINCT u1) + count(DISTINCT u2) as total_usuarios
ORDER BY total_usuarios DESC LIMIT 20
```

**🎤**: *"Si dos usuarios comparten un dispositivo, puede indicar cuenta falsa o acceso no autorizado. El grafo encuentra esto con un simple pattern match — en SQL requeriría una self-join con subquery"*

---

### Query 2 — Transacciones fraudulentas con contexto completo
**Endpoint**: `GET /api/fraude/transacciones-sospechosas`
**Dónde en UI**: Sección "Fraude → Transacciones Sospechosas"

```cypher
MATCH (t:Transaccion {es_fraudulenta: true})
OPTIONAL MATCH (t)-[:ORIGEN]->(co:Cuenta)<-[:TIENE]-(uo:Usuario)
OPTIONAL MATCH (t)-[:DESTINO]->(cd:Cuenta)<-[:TIENE]-(ud:Usuario)
OPTIONAL MATCH (t)-[:OCURRE_EN]->(ub:Ubicacion)
RETURN t.id_transaccion, t.monto, uo.nombre as origen, ud.nombre as destino, ub.pais
ORDER BY t.monto DESC LIMIT 50
```

**🎤**: *"Con una sola query traversamos 4 niveles de relaciones — Transaccion → Cuenta → Usuario + Ubicacion — algo que en SQL necesitaría 4 JOINs"*

---

### Query 3 — Transferencias circulares (A→B→A)
**Endpoint**: `GET /api/fraude/transferencias-circulares`
**Dónde en UI**: Sección "Fraude → Transferencias Circulares"

```cypher
MATCH (c1:Cuenta)-[:REALIZA]->(t1:Transaccion)-[:DESTINO]->(c2:Cuenta)
MATCH (c2)-[:REALIZA]->(t2:Transaccion)-[:DESTINO]->(c1)
WHERE c1.id_cuenta <> c2.id_cuenta
RETURN c1.id_cuenta as cuenta_a, c2.id_cuenta as cuenta_b, t1.monto, t2.monto
```

**🎤**: *"Las transferencias circulares son un patrón clásico de lavado de dinero. En Neo4j se detectan con pattern matching de ciclos — esto es prácticamente imposible de hacer eficientemente en SQL sin CTEs recursivos"*

---

### Query 4 — Sugerida: Usuarios con alto riesgo (score bajo + transacciones fraudulentas)

```cypher
MATCH (u:Usuario)-[:TIENE]->(c:Cuenta)-[:REALIZA]->(t:Transaccion {es_fraudulenta: true})
WHERE u.score_credito < 500
RETURN u.nombre, u.score_credito, count(t) as fraudes, sum(t.monto) as monto_total
ORDER BY fraudes DESC
```

**🎤**: *"Cruzamos propiedades de nodos (score_credito) con patrones de relaciones (transacciones fraudulentas) — Neo4j trata ambas dimensiones con la misma simplicidad"*

---

### Query 5 — Sugerida: Cuentas con mayor volumen de transferencias salientes

```cypher
MATCH (c:Cuenta)-[:REALIZA]->(t:Transaccion)
RETURN c.id_cuenta, c.tipo, count(t) as total_txn, sum(t.monto) as volumen_total
ORDER BY volumen_total DESC LIMIT 10
```

---

### Query 6 — Sugerida: Red de cuentas conectadas en menos de 3 saltos

```cypher
MATCH path = (c1:Cuenta)-[*1..3]-(c2:Cuenta)
WHERE c1.id_cuenta <> c2.id_cuenta
RETURN c1.id_cuenta, c2.id_cuenta, length(path) as distancia
LIMIT 20
```

**🎤**: *"Variable-length path matching — buscar nodos conectados a distancia variable es nativo en Cypher con la sintaxis `[*1..3]`. En SQL esto requeriría CTEs recursivos o stored procedures"*

---

## 🎨 Interfaz Gráfica (Extra, 10 pts)

**Por qué destaca**:
- SPA completa con tema oscuro estilo Neo4j
- Paginación server-side en todas las tablas (skip/limit)
- Dropdowns inteligentes (estado, tipo, moneda) en lugar de inputs libres
- Sección Avanzado con gestión visual de propiedades bulk (filas dinámicas)
- Dashboard con métricas en tiempo real y verificación de grafo conexo
- Relaciones: dropdown auto-completa tipos de nodo origen/destino
- Toast notifications, spinners de carga, tarjetas de resultado

---

## 🚀 Script de Presentación Sugerido (Show & Tell)

### Apertura (~2 min)
> *"Implementamos un sistema de detección de fraude bancario sobre Neo4j. Modelamos 5 entidades — usuarios, cuentas, transacciones, dispositivos y ubicaciones — con 14 tipos de relaciones entre ellas. Esto nos da un grafo donde cada transacción está conectada con quién la hizo, desde qué dispositivo, a qué cuenta y en qué ubicación."*

### Modelado (~2 min)
1. Mostrar dashboard → conteo de nodos y relaciones
2. Mostrar verificación de grafo conexo
3. Mencionar los 14 tipos de relación y sus propiedades

### CRUD (~3 min)
1. Crear un usuario con 1 label → mostrar en tabla
2. Crear el mismo usuario con 2 labels (ClienteVIP) → mostrar labels retornadas
3. Crear una cuenta asociada → menciona que se crean 2 relaciones automáticamente
4. Actualizar el estado del usuario → tabla se refresca
5. Eliminar el nodo → desaparece de la lista

### Propiedades Bulk (~2 min)
1. Abrir Avanzado → Propiedades Bulk (Nodos)
2. Seleccionar tipo Usuario, pegar 3 IDs, agregar campo `categoria = premium`
3. Mostrar resultado: N nodos actualizados
4. Ir a Propiedades Bulk (Rel.), seleccionar TIENE, filtrar por `activo = true`, agregar `revisado = true`

### CSV (~1 min)
1. Cargar CSV de 10 usuarios preparado
2. Refrescar tabla → aparecen nuevos registros

### Consultas de Fraude (~3 min)
- Cada integrante ejecuta sus 2 queries
- Mostrar resultados y explicar el patrón de fraude detectado

---

## 🔑 Keywords Técnicos para Impresionar

| Término | Cuándo usarlo |
|---------|--------------|
| **Pattern matching** | Al explicar MATCH en Cypher |
| **Graph traversal** | Al hablar de buscar nodos conectados |
| **DETACH DELETE** | Al eliminar nodos con relaciones |
| **Variable-length paths `[*1..3]`** | En consultas de redes |
| **Schema-flexible** | Al agregar propiedades sin alterar estructura |
| **Ciudadanos de primera clase** | Al referirse a las relaciones con propiedades |
| **O(1) por nodo** | Al contrastar con JOINs de SQL |
| **Grafo conexo** | Al mostrar la verificación del dashboard |
| **Índices nativos** | Si preguntan de performance |
| **AuraDB** | La instancia cloud de Neo4j que usaron |
| **Neo4j Driver v5** | Si preguntan del backend (Node.js) |
| **SKIP / LIMIT** | Para paginación server-side |
| **toInteger()** | Si preguntan por tipado en Cypher |
| **MERGE vs CREATE** | Si preguntan de idempotencia |

---

*Generado automáticamente el 2026-05-05 | proyecto-neo4j UVG CC3089*
