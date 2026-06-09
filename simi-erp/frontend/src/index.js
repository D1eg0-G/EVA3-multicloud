require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 80;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// ── Conexión PostgreSQL ─────────────────
const pool = new Pool({
  host: process.env.DB_HOST || 'simi-db',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'simidb',
  user: process.env.DB_USER || 'simiuser',
  password: process.env.DB_PASSWORD || 'simipass123',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

pool.connect()
  .then(() => console.log('[DB] Conexión a PostgreSQL establecida'))
  .catch(err => console.error('[DB] Error de conexión:', err.message));

const JWT_SECRET = process.env.JWT_SECRET || 'secreto_desarrollo_local_123';

// ── Middlewares de Acceso Condicional (JWT) ───────────────────
const verifyTempToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Falta token de sesión' });
  try { 
      req.user = jwt.verify(token, JWT_SECRET); 
      next(); 
  } catch (err) { return res.status(403).json({ error: 'Token temporal inválido' }); }
};

const verifyFinalToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'HTTP 401: Acceso denegado' });
  try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (!decoded.mfa_ok) return res.status(403).json({ error: 'HTTP 403: Falta validación MFA' });
      req.user = decoded;
      next();
  } catch (err) { return res.status(403).json({ error: 'HTTP 403: Token expirado o inválido' }); }
};

// ── Rutas API: Autenticación & MFA ───────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
      const { username, password } = req.body;
      const { rows } = await pool.query('SELECT * FROM usuarios WHERE username = $1', [username]);
      const user = rows[0];

      if (!user || user.password !== password) return res.status(401).json({ error: 'Credenciales incorrectas' });

      const tempToken = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '5m' });
      res.json({ tempToken, mfaActivo: user.mfa_activo });
  } catch (e) { res.status(500).json({ error: 'Error del servidor' }); }
});

app.get('/api/auth/mfa/setup', verifyTempToken, async (req, res) => {
  try {
      const secret = speakeasy.generateSecret({ name: `SIMI ERP (${req.user.username})` });
      await pool.query('UPDATE usuarios SET totp_secret = $1 WHERE id = $2', [secret.base32, req.user.id]);
      
      QRCode.toDataURL(secret.otpauth_url, (err, qrUrl) => {
          if (err) return res.status(500).json({ error: 'Error generando QR' });
          res.json({ qrUrl });
      });
  } catch (e) { res.status(500).json({ error: 'Error interno' }); }
});

app.post('/api/auth/mfa/activar', verifyTempToken, async (req, res) => {
  try {
      const { codigo } = req.body;
      const { rows } = await pool.query('SELECT * FROM usuarios WHERE id = $1', [req.user.id]);
      
      const valido = speakeasy.totp.verify({
          secret: rows[0].totp_secret, encoding: 'base32', token: codigo, window: 1
      });
      
      if (!valido) return res.status(401).json({ error: 'Código TOTP incorrecto' });
      
      await pool.query('UPDATE usuarios SET mfa_activo = TRUE WHERE id = $1', [req.user.id]);
      const token = jwt.sign({ id: req.user.id, mfa_ok: true }, JWT_SECRET, { expiresIn: '4h' });
      res.json({ token });
  } catch (e) { res.status(500).json({ error: 'Error interno' }); }
});

app.post('/api/auth/mfa/verify', verifyTempToken, async (req, res) => {
  try {
      const { codigo } = req.body;
      const { rows } = await pool.query('SELECT * FROM usuarios WHERE id = $1', [req.user.id]);
      
      const valido = speakeasy.totp.verify({
          secret: rows[0].totp_secret, encoding: 'base32', token: codigo, window: 1
      });
      
      if (!valido) return res.status(401).json({ error: 'Código TOTP incorrecto' });
      
      const token = jwt.sign({ id: req.user.id, mfa_ok: true }, JWT_SECRET, { expiresIn: '4h' });
      res.json({ token });
  } catch (e) { res.status(500).json({ error: 'Error interno' }); }
});

// ── Rutas API: Productos  ────────────────
app.get('/api/productos', verifyFinalToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM productos ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Error al obtener productos' }); }
});

app.post('/api/productos', verifyFinalToken, async (req, res) => {
  const { nombre, descripcion, precio, stock, categoria } = req.body;
  if (!nombre || precio === undefined) return res.status(400).json({ error: 'Nombre y precio son obligatorios' });
  
  try {
    const result = await pool.query(
      `INSERT INTO productos (nombre, descripcion, precio, stock, categoria) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nombre, descripcion || '', precio, stock || 0, categoria || 'General']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Error al guardar producto' }); }
});

app.delete('/api/productos/:id', verifyFinalToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM productos WHERE id = $1', [req.params.id]);
    res.json({ mensaje: 'Producto eliminado' });
  } catch (err) { res.status(500).json({ error: 'Error al eliminar producto' }); }
});

// ── Healthcheck y Ruta Raíz ───────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER] ERP SIMI corriendo en http://0.0.0.0:${PORT}`);
});