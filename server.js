// server.js - Backend completo para Sistema de Detección de Fraude Bancario
// Universidad del Valle de Guatemala - CC3089 Base de Datos 2
require('dotenv').config();
const express = require('express');
const neo4j = require('neo4j-driver');
const cors = require('cors');
const multer = require('multer');
const { parse } = require('csv-parse');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configurar multer para subida de CSVs
const upload = multer({ dest: 'uploads/' });

// ─── CONEXIÓN NEO4J ───────────────────────────────────────────
const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
);

const getSession = () => driver.session();

// Helper para convertir resultados Neo4j a objetos JS
const recordToObj = (record) => {
  const obj = {};
  record.keys.forEach(key => {
    const val = record.get(key);
    if (val && val.constructor && val.constructor.name === 'Node') {
      obj[key] = { ...val.properties, labels: val.labels };
    } else if (val && val.constructor && val.constructor.name === 'Relationship') {
      obj[key] = { ...val.properties, type: val.type };
    } else if (neo4j.isInt(val)) {
      obj[key] = val.toNumber();
    } else {
      obj[key] = val;
    }
  });
  return obj;
};

// ════════════════════════════════════════════════════════════
//  USUARIOS - CRUD completo
// ════════════════════════════════════════════════════════════

// GET todos los usuarios (con filtros)
app.get('/api/usuarios', async (req, res) => {
  const session = getSession();
  try {
    const { nombre, estado, limit, skip } = req.query;
    const limitVal = Math.max(1, Math.min(parseInt(limit) || 50, 1000));
    const skipVal = Math.max(0, parseInt(skip) || 0);

    let conditions = [];
    let params = { limit: limitVal, skip: skipVal };

    if (nombre) { conditions.push('toLower(u.nombre) CONTAINS toLower($nombre)'); params.nombre = nombre; }
    if (estado !== undefined) { conditions.push('u.estado = $estado'); params.estado = estado === 'true'; }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      MATCH (u:Usuario) ${where}
      OPTIONAL MATCH (u)-[:TIENE]->(c:Cuenta)
      RETURN u, count(c) as num_cuentas
      ORDER BY u.id_usuario
      SKIP toInteger($skip) LIMIT toInteger($limit)
    `;
    const result = await session.run(query, params);
    const usuarios = result.records.map(r => ({
      ...r.get('u').properties,
      labels: r.get('u').labels,
      num_cuentas: r.get('num_cuentas').toNumber()
    }));
    res.json({ success: true, data: usuarios, total: usuarios.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// GET un usuario por ID
app.get('/api/usuarios/:id', async (req, res) => {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (u:Usuario {id_usuario: $id})
       OPTIONAL MATCH (u)-[:TIENE]->(c:Cuenta)
       OPTIONAL MATCH (u)-[:USA]->(d:Dispositivo)
       OPTIONAL MATCH (u)-[:REGISTRADO_EN]->(ub:Ubicacion)
       RETURN u, collect(DISTINCT c) as cuentas, collect(DISTINCT d) as dispositivos, ub`,
      { id: parseInt(req.params.id) }
    );
    if (!result.records.length) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    const r = result.records[0];
    res.json({
      success: true,
      data: {
        ...r.get('u').properties,
        labels: r.get('u').labels,
        cuentas: r.get('cuentas').map(c => c.properties),
        dispositivos: r.get('dispositivos').map(d => d.properties),
        ubicacion: r.get('ub') ? r.get('ub').properties : null
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// POST crear usuario con 1 label
app.post('/api/usuarios', async (req, res) => {
  const session = getSession();
  try {
    const { nombre, email, fecha_registro, estado, telefono, ocupacion, score_credito } = req.body;
    const result = await session.run(
      `CREATE (u:Usuario {
        id_usuario: toInteger(rand() * 9000000) + 1000000,
        nombre: $nombre,
        email: $email,
        fecha_registro: date($fecha_registro),
        estado: $estado,
        telefono: $telefono,
        ocupacion: $ocupacion,
        score_credito: $score_credito
      }) RETURN u`,
      { nombre, email, fecha_registro, estado: estado ?? true, telefono: telefono ?? '', ocupacion: ocupacion ?? 'No especificado', score_credito: parseInt(score_credito) || 600 }
    );
    res.json({ success: true, data: result.records[0].get('u').properties });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// POST crear usuario con 2+ labels (Usuario + ClienteVIP o Sospechoso)
app.post('/api/usuarios/multi-label', async (req, res) => {
  const session = getSession();
  try {
    const { nombre, email, fecha_registro, estado, telefono, ocupacion, score_credito, labels_extra } = req.body;
    const extraLabels = (labels_extra || []).map(l => `:${l}`).join('');
    const result = await session.run(
      `CREATE (u:Usuario${extraLabels} {
        id_usuario: randomInteger() % 999999 + 100000,
        nombre: $nombre,
        email: $email,
        fecha_registro: date($fecha_registro),
        estado: $estado,
        telefono: $telefono,
        ocupacion: $ocupacion,
        score_credito: $score_credito
      }) RETURN u, labels(u) as todas_labels`,
      { nombre, email, fecha_registro, estado: estado ?? true, telefono: telefono ?? '', ocupacion: ocupacion ?? 'No especificado', score_credito: parseInt(score_credito) || 600 }
    );
    res.json({
      success: true,
      data: {
        ...result.records[0].get('u').properties,
        labels: result.records[0].get('todas_labels')
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// PUT actualizar propiedades de 1 usuario
app.put('/api/usuarios/:id', async (req, res) => {
  const session = getSession();
  try {
    const updates = req.body;
    const setClause = Object.keys(updates).map(k => `u.${k} = $${k}`).join(', ');
    const result = await session.run(
      `MATCH (u:Usuario {id_usuario: $id}) SET ${setClause} RETURN u`,
      { id: parseInt(req.params.id), ...updates }
    );
    if (!result.records.length) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    res.json({ success: true, data: result.records[0].get('u').properties });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// POST agregar propiedades a un nodo existente
app.post('/api/nodos/:tipo/:id/propiedades', async (req, res) => {
  const session = getSession();
  try {
    const { tipo, id } = req.params;
    const propiedades = req.body; // {prop1: valor1, prop2: valor2, ...}
    const propsStr = Object.keys(propiedades).map(k => `n.${k} = $${k}`).join(', ');
    const result = await session.run(
      `MATCH (n:${tipo} {id_${tipo.toLowerCase()}: $id}) SET ${propsStr} RETURN n, labels(n) as labels`,
      { id: parseInt(id), ...propiedades }
    );
    if (!result.records.length) return res.status(404).json({ success: false, error: 'Nodo no encontrado' });
    res.json({ success: true, data: { ...result.records[0].get('n').properties, labels: result.records[0].get('labels') } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// DELETE eliminar propiedades de un nodo
app.delete('/api/nodos/:tipo/:id/propiedades', async (req, res) => {
  const session = getSession();
  try {
    const { tipo, id } = req.params;
    const { propiedades } = req.body; // ["prop1", "prop2", ...]
    const removeClause = propiedades.map(p => `n.${p}`).join(', ');
    const result = await session.run(
      `MATCH (n:${tipo} {id_${tipo.toLowerCase()}: $id}) REMOVE ${removeClause} RETURN n, labels(n) as labels`,
      { id: parseInt(id) }
    );
    if (!result.records.length) return res.status(404).json({ success: false, error: 'Nodo no encontrado' });
    res.json({ success: true, data: { ...result.records[0].get('n').properties, labels: result.records[0].get('labels') } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// POST agregar propiedades a múltiples nodos
app.post('/api/nodos/bulk/propiedades', async (req, res) => {
  const session = getSession();
  try {
    const { tipo, ids, propiedades } = req.body;
    const setClause = Object.keys(propiedades).map(k => `n.${k} = $${k}`).join(', ');
    const result = await session.run(
      `MATCH (n:${tipo}) WHERE n.id_${tipo.toLowerCase()} IN $ids SET ${setClause} RETURN count(n) as updated`,
      { ids: ids.map(id => parseInt(id)), ...propiedades }
    );
    res.json({ success: true, updated: result.records[0].get('updated').toNumber() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// DELETE eliminar propiedades de múltiples nodos
app.delete('/api/nodos/bulk/propiedades', async (req, res) => {
  const session = getSession();
  try {
    const { tipo, ids, propiedades } = req.body;
    const removeClause = propiedades.map(p => `n.${p}`).join(', ');
    const result = await session.run(
      `MATCH (n:${tipo}) WHERE n.id_${tipo.toLowerCase()} IN $ids REMOVE ${removeClause} RETURN count(n) as updated`,
      { ids: ids.map(id => parseInt(id)) }
    );
    res.json({ success: true, updated: result.records[0].get('updated').toNumber() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// POST agregar labels a un nodo existente
app.post('/api/nodos/:tipo/:id/labels', async (req, res) => {
  const session = getSession();
  try {
    const { tipo, id } = req.params;
    const { labels: newLabels } = req.body; // ["ClienteVIP", "Sospechoso", ...]
    const labelStr = newLabels.map(l => `:${l}`).join('');
    const result = await session.run(
      `MATCH (n:${tipo} {id_${tipo.toLowerCase()}: $id}) SET n${labelStr} RETURN labels(n) as all_labels, n`,
      { id: parseInt(id) }
    );
    if (!result.records.length) return res.status(404).json({ success: false, error: 'Nodo no encontrado' });
    res.json({ success: true, data: { labels: result.records[0].get('all_labels'), properties: result.records[0].get('n').properties } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// PUT actualizar múltiples usuarios al mismo tiempo
app.put('/api/usuarios/bulk/update', async (req, res) => {
  const session = getSession();
  try {
    const { filter, updates } = req.body; // filter: {estado: true}, updates: {ocupacion: "Empresario"}
    const setClause = Object.keys(updates).map(k => `u.${k} = $${k}`).join(', ');
    const whereClause = Object.keys(filter).map(k => `u.${k} = $filter_${k}`).join(' AND ');
    const params = { ...updates };
    Object.keys(filter).forEach(k => params[`filter_${k}`] = filter[k]);
    const result = await session.run(
      `MATCH (u:Usuario) WHERE ${whereClause} SET ${setClause} RETURN count(u) as updated`,
      params
    );
    res.json({ success: true, updated: result.records[0].get('updated').toNumber() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// DELETE eliminar 1 usuario
app.delete('/api/usuarios/:id', async (req, res) => {
  const session = getSession();
  try {
    await session.run(
      `MATCH (u:Usuario {id_usuario: $id}) DETACH DELETE u`,
      { id: parseInt(req.params.id) }
    );
    res.json({ success: true, message: 'Usuario eliminado' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// DELETE eliminar múltiples usuarios
app.delete('/api/usuarios/bulk/delete', async (req, res) => {
  const session = getSession();
  try {
    const { ids } = req.body;
    const result = await session.run(
      `MATCH (u:Usuario) WHERE u.id_usuario IN $ids DETACH DELETE u RETURN count(u) as deleted`,
      { ids }
    );
    res.json({ success: true, message: `${ids.length} usuarios eliminados` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// ════════════════════════════════════════════════════════════
//  CUENTAS - CRUD
// ════════════════════════════════════════════════════════════

app.get('/api/cuentas', async (req, res) => {
  const session = getSession();
  try {
    const { tipo, estado, min_saldo, max_saldo, limit, skip } = req.query;
    const limitVal = Math.max(1, Math.min(parseInt(limit) || 50, 1000));
    const skipVal = Math.max(0, parseInt(skip) || 0);

    let conditions = [];
    let params = { limit: limitVal, skip: skipVal };

    if (tipo) { conditions.push('c.tipo = $tipo'); params.tipo = tipo; }
    if (estado !== undefined) { conditions.push('c.estado = $estado'); params.estado = estado === 'true'; }
    if (min_saldo) { conditions.push('c.saldo >= $min_saldo'); params.min_saldo = parseFloat(min_saldo); }
    if (max_saldo) { conditions.push('c.saldo <= $max_saldo'); params.max_saldo = parseFloat(max_saldo); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await session.run(
      `MATCH (c:Cuenta) ${where}
       OPTIONAL MATCH (u:Usuario)-[:TIENE]->(c)
       RETURN c, u.nombre as propietario
       ORDER BY c.id_cuenta SKIP toInteger($skip) LIMIT toInteger($limit)`,
      params
    );
    const cuentas = result.records.map(r => ({
      ...r.get('c').properties,
      propietario: r.get('propietario')
    }));
    res.json({ success: true, data: cuentas });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

app.post('/api/cuentas', async (req, res) => {
  const session = getSession();
  try {
    const { tipo, saldo, fecha_creacion, estado, moneda, limite_diario, id_usuario } = req.body;
    const result = await session.run(
      `MATCH (u:Usuario {id_usuario: $id_usuario})
       CREATE (c:Cuenta {
         id_cuenta: randomInteger() % 999999 + 100000,
         tipo: $tipo,
         saldo: $saldo,
         fecha_creacion: date($fecha_creacion),
         estado: $estado,
         moneda: $moneda,
         limite_diario: $limite_diario
       })
       CREATE (u)-[:TIENE {fecha_asociacion: date($fecha_creacion), tipo_relacion: 'Titular', activo: true}]->(c)
       CREATE (c)-[:PERTENECE_A {fecha: date($fecha_creacion), principal: true, estado: 'Activa'}]->(u)
       RETURN c`,
      { tipo, saldo: parseFloat(saldo), fecha_creacion, estado: estado ?? true, moneda: moneda || 'GTQ', limite_diario: parseFloat(limite_diario) || 5000, id_usuario: parseInt(id_usuario) }
    );
    res.json({ success: true, data: result.records[0].get('c').properties });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

app.put('/api/cuentas/:id', async (req, res) => {
  const session = getSession();
  try {
    const updates = req.body;
    const setClause = Object.keys(updates).map(k => `c.${k} = $${k}`).join(', ');
    const result = await session.run(
      `MATCH (c:Cuenta {id_cuenta: $id}) SET ${setClause} RETURN c`,
      { id: parseInt(req.params.id), ...updates }
    );
    if (!result.records.length) return res.status(404).json({ success: false, error: 'Cuenta no encontrada' });
    res.json({ success: true, data: result.records[0].get('c').properties });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

app.delete('/api/cuentas/:id', async (req, res) => {
  const session = getSession();
  try {
    await session.run(`MATCH (c:Cuenta {id_cuenta: $id}) DETACH DELETE c`, { id: parseInt(req.params.id) });
    res.json({ success: true, message: 'Cuenta eliminada' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// ════════════════════════════════════════════════════════════
//  TRANSACCIONES - CRUD
// ════════════════════════════════════════════════════════════

app.get('/api/transacciones', async (req, res) => {
  const session = getSession();
  try {
    const { tipo, es_fraudulenta, min_monto, max_monto, fecha_desde, fecha_hasta, limit, skip } = req.query;
    const limitVal = Math.max(1, Math.min(parseInt(limit) || 50, 1000));
    const skipVal = Math.max(0, parseInt(skip) || 0);

    let conditions = [];
    let params = { limit: limitVal, skip: skipVal };

    if (tipo) { conditions.push('t.tipo = $tipo'); params.tipo = tipo; }
    if (es_fraudulenta !== undefined) { conditions.push('t.es_fraudulenta = $es_fraudulenta'); params.es_fraudulenta = es_fraudulenta === 'true'; }
    if (min_monto) { conditions.push('t.monto >= $min_monto'); params.min_monto = parseFloat(min_monto); }
    if (max_monto) { conditions.push('t.monto <= $max_monto'); params.max_monto = parseFloat(max_monto); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await session.run(
      `MATCH (t:Transaccion) ${where}
       OPTIONAL MATCH (t)-[:ORIGEN]->(co:Cuenta)
       OPTIONAL MATCH (t)-[:DESTINO]->(cd:Cuenta)
       RETURN t, co.id_cuenta as origen, cd.id_cuenta as destino
       ORDER BY t.fecha DESC SKIP toInteger($skip) LIMIT toInteger($limit)`,
      params
    );
    const txns = result.records.map(r => ({
      ...r.get('t').properties,
      cuenta_origen: r.get('origen'),
      cuenta_destino: r.get('destino')
    }));
    res.json({ success: true, data: txns });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

app.post('/api/transacciones', async (req, res) => {
  const session = getSession();
  try {
    const { monto, fecha, tipo, moneda, canal, id_cuenta_origen, id_cuenta_destino, id_dispositivo, id_ubicacion } = req.body;
    const result = await session.run(
      `MATCH (co:Cuenta {id_cuenta: $id_cuenta_origen})
       MATCH (cd:Cuenta {id_cuenta: $id_cuenta_destino})
       MATCH (d:Dispositivo {id_dispositivo: $id_dispositivo})
       MATCH (ub:Ubicacion {id_ubicacion: $id_ubicacion})
       CREATE (t:Transaccion {
         id_transaccion: randomInteger() % 9999999 + 1000000,
         monto: $monto,
         fecha: date($fecha),
         tipo: $tipo,
         es_fraudulenta: false,
         moneda: $moneda,
         descripcion: 'TXN-MANUAL',
         canal: $canal
       })
       CREATE (co)-[:REALIZA {fecha: date($fecha), monto: $monto, canal: $canal}]->(t)
       CREATE (t)-[:ORIGEN {monto: $monto, moneda: $moneda, validada: true}]->(co)
       CREATE (t)-[:DESTINO {monto: $monto, moneda: $moneda, confirmado: true}]->(cd)
       CREATE (t)-[:REALIZADA_DESDE {ip: d.ip, fecha: date($fecha), riesgo: 0.1}]->(d)
       CREATE (t)-[:OCURRE_EN {fecha: date($fecha), pais: ub.pais, riesgo: 0.1}]->(ub)
       RETURN t`,
      { monto: parseFloat(monto), fecha, tipo, moneda: moneda || 'GTQ', canal: canal || 'Web', id_cuenta_origen: parseInt(id_cuenta_origen), id_cuenta_destino: parseInt(id_cuenta_destino), id_dispositivo: parseInt(id_dispositivo), id_ubicacion: parseInt(id_ubicacion) }
    );
    res.json({ success: true, data: result.records[0].get('t').properties });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

app.put('/api/transacciones/:id', async (req, res) => {
  const session = getSession();
  try {
    const updates = req.body;
    const setClause = Object.keys(updates).map(k => `t.${k} = $${k}`).join(', ');
    const result = await session.run(
      `MATCH (t:Transaccion {id_transaccion: $id}) SET ${setClause} RETURN t`,
      { id: parseInt(req.params.id), ...updates }
    );
    if (!result.records.length) return res.status(404).json({ success: false, error: 'Transacción no encontrada' });
    res.json({ success: true, data: result.records[0].get('t').properties });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

app.delete('/api/transacciones/:id', async (req, res) => {
  const session = getSession();
  try {
    await session.run(`MATCH (t:Transaccion {id_transaccion: $id}) DETACH DELETE t`, { id: parseInt(req.params.id) });
    res.json({ success: true, message: 'Transacción eliminada' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// DELETE múltiples transacciones
app.delete('/api/transacciones/bulk/delete', async (req, res) => {
  const session = getSession();
  try {
    const { ids } = req.body;
    await session.run(`MATCH (t:Transaccion) WHERE t.id_transaccion IN $ids DETACH DELETE t`, { ids });
    res.json({ success: true, message: `${ids.length} transacciones eliminadas` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// ════════════════════════════════════════════════════════════
//  DISPOSITIVOS
// ════════════════════════════════════════════════════════════

app.get('/api/dispositivos', async (req, res) => {
  const session = getSession();
  try {
    const { tipo, limit, skip } = req.query;
    const limitVal = Math.max(1, Math.min(parseInt(limit) || 50, 1000));
    const skipVal = Math.max(0, parseInt(skip) || 0);
    const where = tipo ? 'WHERE d.tipo = $tipo' : '';
    const result = await session.run(
      `MATCH (d:Dispositivo) ${where} RETURN d ORDER BY d.id_dispositivo SKIP toInteger($skip) LIMIT toInteger($limit)`,
      { tipo, limit: limitVal, skip: skipVal }
    );
    res.json({ success: true, data: result.records.map(r => r.get('d').properties) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// ════════════════════════════════════════════════════════════
//  UBICACIONES
// ════════════════════════════════════════════════════════════

app.get('/api/ubicaciones', async (req, res) => {
  const session = getSession();
  try {
    const result = await session.run(`MATCH (ub:Ubicacion) RETURN ub ORDER BY ub.pais LIMIT 200`);
    res.json({ success: true, data: result.records.map(r => r.get('ub').properties) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// ════════════════════════════════════════════════════════════
//  RELACIONES - Crear / Gestionar
// ════════════════════════════════════════════════════════════

// Crear relación con propiedades entre 2 nodos existentes
app.post('/api/relaciones', async (req, res) => {
  const session = getSession();
  try {
    const { tipo_origen, id_origen, tipo_destino, id_destino, tipo_relacion, propiedades } = req.body;
    const propsStr = Object.keys(propiedades).map(k => `${k}: $${k}`).join(', ');
    const result = await session.run(
      `MATCH (a:${tipo_origen} {id_${tipo_origen.toLowerCase()}: $id_origen})
       MATCH (b:${tipo_destino} {id_${tipo_destino.toLowerCase()}: $id_destino})
       CREATE (a)-[r:${tipo_relacion} {${propsStr}}]->(b)
       RETURN type(r) as tipo, r`,
      { id_origen: parseInt(id_origen), id_destino: parseInt(id_destino), ...propiedades }
    );
    res.json({ success: true, data: result.records[0].get('r').properties });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// Actualizar propiedades de una relación
app.put('/api/relaciones/update', async (req, res) => {
  const session = getSession();
  try {
    const { tipo_origen, id_origen, tipo_destino, id_destino, tipo_relacion, updates } = req.body;
    const setClause = Object.keys(updates).map(k => `r.${k} = $${k}`).join(', ');
    await session.run(
      `MATCH (a:${tipo_origen} {id_${tipo_origen.toLowerCase()}: $id_origen})-[r:${tipo_relacion}]->(b:${tipo_destino} {id_${tipo_destino.toLowerCase()}: $id_destino})
       SET ${setClause}`,
      { id_origen: parseInt(id_origen), id_destino: parseInt(id_destino), ...updates }
    );
    res.json({ success: true, message: 'Relación actualizada' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// Eliminar relación específica
app.delete('/api/relaciones/delete', async (req, res) => {
  const session = getSession();
  try {
    const { tipo_origen, id_origen, tipo_destino, id_destino, tipo_relacion } = req.body;
    await session.run(
      `MATCH (a:${tipo_origen} {id_${tipo_origen.toLowerCase()}: $id_origen})-[r:${tipo_relacion}]->(b:${tipo_destino} {id_${tipo_destino.toLowerCase()}: $id_destino}) DELETE r`,
      { id_origen: parseInt(id_origen), id_destino: parseInt(id_destino) }
    );
    res.json({ success: true, message: 'Relación eliminada' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// Eliminar múltiples relaciones de un tipo
app.delete('/api/relaciones/bulk/delete', async (req, res) => {
  const session = getSession();
  try {
    const { tipo_relacion, filtro } = req.body;
    const result = await session.run(
      `MATCH ()-[r:${tipo_relacion}]->() WHERE r.${filtro.campo} = $valor DELETE r RETURN count(r) as deleted`,
      { valor: filtro.valor }
    );
    res.json({ success: true, deleted: result.records[0].get('deleted').toNumber() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// POST agregar propiedades a una relación específica
app.post('/api/relaciones/:id/propiedades', async (req, res) => {
  const session = getSession();
  try {
    const { tipo_origen, id_origen, tipo_destino, id_destino, tipo_relacion, propiedades } = req.body;
    const setClause = Object.keys(propiedades).map(k => `r.${k} = $${k}`).join(', ');
    const result = await session.run(
      `MATCH (a:${tipo_origen} {id_${tipo_origen.toLowerCase()}: $id_origen})-[r:${tipo_relacion}]->(b:${tipo_destino} {id_${tipo_destino.toLowerCase()}: $id_destino})
       SET ${setClause} RETURN r, type(r) as tipo`,
      { id_origen: parseInt(id_origen), id_destino: parseInt(id_destino), ...propiedades }
    );
    if (!result.records.length) return res.status(404).json({ success: false, error: 'Relación no encontrada' });
    res.json({ success: true, data: result.records[0].get('r').properties });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// DELETE eliminar propiedades de una relación específica
app.delete('/api/relaciones/:id/propiedades', async (req, res) => {
  const session = getSession();
  try {
    const { tipo_origen, id_origen, tipo_destino, id_destino, tipo_relacion, propiedades } = req.body;
    const removeClause = propiedades.map(p => `r.${p}`).join(', ');
    const result = await session.run(
      `MATCH (a:${tipo_origen} {id_${tipo_origen.toLowerCase()}: $id_origen})-[r:${tipo_relacion}]->(b:${tipo_destino} {id_${tipo_destino.toLowerCase()}: $id_destino})
       REMOVE ${removeClause} RETURN r, type(r) as tipo`,
      { id_origen: parseInt(id_origen), id_destino: parseInt(id_destino) }
    );
    if (!result.records.length) return res.status(404).json({ success: false, error: 'Relación no encontrada' });
    res.json({ success: true, data: result.records[0].get('r').properties });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// POST agregar propiedades a múltiples relaciones
app.post('/api/relaciones/bulk/propiedades', async (req, res) => {
  const session = getSession();
  try {
    const { tipo_relacion, filtro, propiedades } = req.body;
    const setClause = Object.keys(propiedades).map(k => `r.${k} = $${k}`).join(', ');
    const result = await session.run(
      `MATCH ()-[r:${tipo_relacion}]->() WHERE r.${filtro.campo} = $filtro_valor SET ${setClause} RETURN count(r) as updated`,
      { filtro_valor: filtro.valor, ...propiedades }
    );
    res.json({ success: true, updated: result.records[0].get('updated').toNumber() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// DELETE eliminar propiedades de múltiples relaciones
app.delete('/api/relaciones/bulk/propiedades', async (req, res) => {
  const session = getSession();
  try {
    const { tipo_relacion, filtro, propiedades } = req.body;
    const removeClause = propiedades.map(p => `r.${p}`).join(', ');
    const result = await session.run(
      `MATCH ()-[r:${tipo_relacion}]->() WHERE r.${filtro.campo} = $filtro_valor REMOVE ${removeClause} RETURN count(r) as updated`,
      { filtro_valor: filtro.valor }
    );
    res.json({ success: true, updated: result.records[0].get('updated').toNumber() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// ════════════════════════════════════════════════════════════
//  VERIFICACIÓN DE INTEGRIDAD DEL GRAFO
// ════════════════════════════════════════════════════════════

// GET verificar si el grafo es conexo
app.get('/api/grafo/conexo', async (req, res) => {
  const session = getSession();
  try {
    const result = await session.run(`
      MATCH (n)
      WITH count(DISTINCT n) as total_nodos
      MATCH (n)-[*]-(m)
      RETURN count(DISTINCT n) as nodos_conectados, total_nodos,
             case when count(DISTINCT n) = total_nodos then true else false end as es_conexo
      LIMIT 1
    `);
    const r = result.records[0];
    res.json({
      success: true,
      data: {
        total_nodos: r.get('total_nodos').toNumber(),
        nodos_conectados: r.get('nodos_conectados').toNumber(),
        es_conexo: r.get('es_conexo'),
        porcentaje_conectado: ((r.get('nodos_conectados').toNumber() / r.get('total_nodos').toNumber()) * 100).toFixed(2) + '%'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// GET obtener información de tipos de relaciones
app.get('/api/relaciones/tipos', async (req, res) => {
  const session = getSession();
  try {
    const result = await session.run(`
      MATCH ()-[r]->()
      RETURN DISTINCT type(r) as tipo, count(r) as cantidad
      ORDER BY cantidad DESC
    `);
    const data = result.records.map(r => ({
      tipo: r.get('tipo'),
      cantidad: r.get('cantidad').toNumber()
    }));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// ════════════════════════════════════════════════════════════
//  CONSULTAS DE DETECCIÓN DE FRAUDE (Cypher avanzadas)
// ════════════════════════════════════════════════════════════

// Consulta 1: Cuentas usando el mismo dispositivo (posible fraude)
app.get('/api/fraude/dispositivo-compartido', async (req, res) => {
  const session = getSession();
  try {
    const result = await session.run(`
      MATCH (u1:Usuario)-[:USA]->(d:Dispositivo)<-[:USA]-(u2:Usuario)
      WHERE u1.id_usuario < u2.id_usuario
      MATCH (u1)-[:TIENE]->(c1:Cuenta)
      MATCH (u2)-[:TIENE]->(c2:Cuenta)
      RETURN d.ip as ip_dispositivo, d.tipo as tipo_dispositivo,
             collect(DISTINCT u1.nombre + ' (' + toString(u1.id_usuario) + ')') as usuarios,
             count(DISTINCT u1) + count(DISTINCT u2) as total_usuarios
      ORDER BY total_usuarios DESC LIMIT 20
    `);
    const data = result.records.map(r => ({
      ip: r.get('ip_dispositivo'),
      tipo: r.get('tipo_dispositivo'),
      usuarios: r.get('usuarios'),
      total_usuarios: r.get('total_usuarios').toNumber()
    }));
    res.json({ success: true, data, descripcion: 'Dispositivos compartidos entre múltiples usuarios' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// Consulta 2: Transacciones fraudulentas - resumen
app.get('/api/fraude/transacciones-sospechosas', async (req, res) => {
  const session = getSession();
  try {
    const result = await session.run(`
      MATCH (t:Transaccion {es_fraudulenta: true})
      OPTIONAL MATCH (t)-[:ORIGEN]->(co:Cuenta)<-[:TIENE]-(uo:Usuario)
      OPTIONAL MATCH (t)-[:DESTINO]->(cd:Cuenta)<-[:TIENE]-(ud:Usuario)
      OPTIONAL MATCH (t)-[:OCURRE_EN]->(ub:Ubicacion)
      RETURN t.id_transaccion as id, t.monto as monto, t.tipo as tipo,
             t.fecha as fecha, t.canal as canal,
             uo.nombre as usuario_origen, ud.nombre as usuario_destino,
             ub.pais as pais, ub.ciudad as ciudad
      ORDER BY t.monto DESC LIMIT 50
    `);
    const data = result.records.map(r => ({
      id: r.get('id'),
      monto: r.get('monto'),
      tipo: r.get('tipo'),
      fecha: r.get('fecha'),
      canal: r.get('canal'),
      usuario_origen: r.get('usuario_origen'),
      usuario_destino: r.get('usuario_destino'),
      pais: r.get('pais'),
      ciudad: r.get('ciudad')
    }));
    res.json({ success: true, data, descripcion: 'Transacciones marcadas como fraudulentas' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// Consulta 3: Transferencias circulares (A→B→A)
app.get('/api/fraude/transferencias-circulares', async (req, res) => {
  const session = getSession();
  try {
    const result = await session.run(`
      MATCH (c1:Cuenta)-[:REALIZA]->(t1:Transaccion)-[:DESTINO]->(c2:Cuenta)
      MATCH (c2)-[:REALIZA]->(t2:Transaccion)-[:DESTINO]->(c1)
      WHERE c1.id_cuenta <> c2.id_cuenta AND t1.id_transaccion <> t2.id_transaccion
      RETURN c1.id_cuenta as cuenta_a, c2.id_cuenta as cuenta_b,
             t1.monto as monto_a_b, t2.monto as monto_b_a,
             t1.fecha as fecha_ida, t2.fecha as fecha_vuelta
      LIMIT 20
    `);
    const data = result.records.map(r => ({
      cuenta_a: r.get('cuenta_a'),
      cuenta_b: r.get('cuenta_b'),
      monto_a_b: r.get('monto_a_b'),
      monto_b_a: r.get('monto_b_a'),
      fecha_ida: r.get('fecha_ida'),
      fecha_vuelta: r.get('fecha_vuelta')
    }));
    res.json({ success: true, data, descripcion: 'Pares de cuentas con transferencias circulares (A→B→A)' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// Consulta 4: Usuarios con más transacciones fraudulentas
app.get('/api/fraude/usuarios-riesgo', async (req, res) => {
  const session = getSession();
  try {
    const result = await session.run(`
      MATCH (u:Usuario)-[:TIENE]->(c:Cuenta)-[:REALIZA]->(t:Transaccion {es_fraudulenta: true})
      RETURN u.id_usuario as id, u.nombre as nombre, u.email as email,
             count(t) as transacciones_fraude,
             sum(t.monto) as monto_total_fraude,
             collect(DISTINCT t.tipo) as tipos_fraude
      ORDER BY transacciones_fraude DESC LIMIT 20
    `);
    const data = result.records.map(r => ({
      id: r.get('id'),
      nombre: r.get('nombre'),
      email: r.get('email'),
      transacciones_fraude: r.get('transacciones_fraude').toNumber(),
      monto_total_fraude: r.get('monto_total_fraude'),
      tipos_fraude: r.get('tipos_fraude')
    }));
    res.json({ success: true, data, descripcion: 'Usuarios con mayor riesgo de fraude' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// Consulta 5: Agregaciones - estadísticas generales
app.get('/api/estadisticas', async (req, res) => {
  const session = getSession();
  try {
    const result = await session.run(`
      MATCH (t:Transaccion)
      WITH count(t) as total_txn,
           sum(CASE WHEN t.es_fraudulenta THEN 1 ELSE 0 END) as txn_fraude,
           sum(t.monto) as monto_total,
           avg(t.monto) as monto_promedio,
           max(t.monto) as monto_max
      MATCH (u:Usuario) WITH total_txn, txn_fraude, monto_total, monto_promedio, monto_max, count(u) as total_usuarios
      MATCH (c:Cuenta) WITH total_txn, txn_fraude, monto_total, monto_promedio, monto_max, total_usuarios, count(c) as total_cuentas
      MATCH (d:Dispositivo) WITH total_txn, txn_fraude, monto_total, monto_promedio, monto_max, total_usuarios, total_cuentas, count(d) as total_dispositivos
      RETURN total_txn, txn_fraude, monto_total, monto_promedio, monto_max, total_usuarios, total_cuentas, total_dispositivos
    `);
    const r = result.records[0];
    res.json({
      success: true,
      data: {
        total_transacciones: r.get('total_txn').toNumber(),
        transacciones_fraude: r.get('txn_fraude').toNumber(),
        monto_total: r.get('monto_total'),
        monto_promedio: r.get('monto_promedio'),
        monto_maximo: r.get('monto_max'),
        total_usuarios: r.get('total_usuarios').toNumber(),
        total_cuentas: r.get('total_cuentas').toNumber(),
        total_dispositivos: r.get('total_dispositivos').toNumber()
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// Consulta 6: Por tipo de transacción
app.get('/api/estadisticas/por-tipo', async (req, res) => {
  const session = getSession();
  try {
    const result = await session.run(`
      MATCH (t:Transaccion)
      RETURN t.tipo as tipo,
             count(t) as total,
             sum(t.monto) as monto_total,
             avg(t.monto) as monto_promedio,
             sum(CASE WHEN t.es_fraudulenta THEN 1 ELSE 0 END) as fraudulentas
      ORDER BY total DESC
    `);
    const data = result.records.map(r => ({
      tipo: r.get('tipo'),
      total: r.get('total').toNumber(),
      monto_total: r.get('monto_total'),
      monto_promedio: r.get('monto_promedio'),
      fraudulentas: r.get('fraudulentas').toNumber()
    }));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// ════════════════════════════════════════════════════════════
//  CARGA DE CSV DESDE FRONTEND
// ════════════════════════════════════════════════════════════

app.post('/api/cargar-csv', upload.single('archivo'), async (req, res) => {
  const session = getSession();
  try {
    const { tipo_nodo } = req.body;
    const filePath = req.file.path;
    const fileContent = fs.readFileSync(filePath, 'utf8');

    const records = await new Promise((resolve, reject) => {
      parse(fileContent, { columns: true, skip_empty_lines: true }, (err, data) => {
        if (err) reject(err); else resolve(data);
      });
    });

    let created = 0;
    for (const row of records) {
      let query = '';
      if (tipo_nodo === 'Usuario') {
        query = `CREATE (:Usuario {
          id_usuario: toInteger($id_usuario), nombre: $nombre, email: $email,
          fecha_registro: date($fecha_registro), estado: $estado = 'True',
          telefono: coalesce($telefono, ''), ocupacion: coalesce($ocupacion, ''),
          score_credito: toInteger(coalesce($score_credito, '600'))
        })`;
      } else if (tipo_nodo === 'Cuenta') {
        query = `CREATE (:Cuenta {
          id_cuenta: toInteger($id_cuenta), tipo: $tipo, saldo: toFloat($saldo),
          fecha_creacion: date($fecha_creacion), estado: $estado = 'True',
          moneda: coalesce($moneda, 'GTQ'), limite_diario: toFloat(coalesce($limite_diario, '5000'))
        })`;
      } else if (tipo_nodo === 'Transaccion') {
        query = `CREATE (:Transaccion {
          id_transaccion: toInteger($id_transaccion), monto: toFloat($monto),
          fecha: date($fecha), tipo: $tipo, es_fraudulenta: $es_fraudulenta = 'True',
          moneda: coalesce($moneda, 'GTQ'), descripcion: coalesce($descripcion, ''), canal: coalesce($canal, 'Web')
        })`;
      }
      if (query) {
        await session.run(query, row);
        created++;
      }
    }

    fs.unlinkSync(filePath); // limpiar archivo temporal
    res.json({ success: true, message: `${created} nodos de tipo ${tipo_nodo} creados exitosamente desde CSV` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally { session.close(); }
});

// ─── HEALTH CHECK ───
app.get('/api/health', async (req, res) => {
  try {
    const session = getSession();
    await session.run('RETURN 1');
    session.close();
    res.json({ success: true, message: 'Conectado a Neo4j ✓', timestamp: new Date() });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Sin conexión a Neo4j: ' + err.message });
  }
});

// ─── INICIAR SERVIDOR ───
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📊 Sistema de Detección de Fraude Bancario - UVG`);
  console.log(`🔗 Neo4j URI: ${process.env.NEO4J_URI}\n`);
});

module.exports = app;
