CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password TEXT NOT NULL,
  totp_secret TEXT,
  mfa_activo BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS productos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  descripcion TEXT,
  precio NUMERIC(10,2) NOT NULL,
  stock INTEGER DEFAULT 0,
  categoria VARCHAR(60),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar usuario administrador de prueba (admin / admin123)
INSERT INTO usuarios (username, password) VALUES ('admin', 'admin123') ON CONFLICT DO NOTHING;