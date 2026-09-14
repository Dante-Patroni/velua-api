-- =====================================================================
--  VELUA · Cosmética natural artesanal
--  Esquema de base de datos MySQL 8+
--
--  Convenciones:
--    · InnoDB + utf8mb4 (soporta acentos y emojis en descripciones)
--    · Dinero en DECIMAL(12,2). NUNCA FLOAT.
--    · Timestamps en UTC, se formatean en el front.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS velua
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE velua;


-- ---------------------------------------------------------------------
--  CATÁLOGO
-- ---------------------------------------------------------------------

CREATE TABLE categorias (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(80)   NOT NULL,
  slug          VARCHAR(80)   NOT NULL,
  descripcion   VARCHAR(300)  NULL,
  imagen_url    VARCHAR(500)  NULL,
  orden         SMALLINT      NOT NULL DEFAULT 0,
  activa        BOOLEAN       NOT NULL DEFAULT TRUE,
  creado_en     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_categorias_slug (slug)
) ENGINE=InnoDB;


CREATE TABLE productos (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  categoria_id      INT UNSIGNED  NOT NULL,
  nombre            VARCHAR(140)  NOT NULL,
  slug              VARCHAR(160)  NOT NULL,
  descripcion_corta VARCHAR(300)  NULL,   -- para las tarjetas del listado
  descripcion       TEXT          NULL,   -- ficha completa
  ingredientes      TEXT          NULL,   -- listado INCI
  modo_uso          TEXT          NULL,
  activo            BOOLEAN       NOT NULL DEFAULT TRUE,
  destacado         BOOLEAN       NOT NULL DEFAULT FALSE,
  creado_en         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                  ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_productos_slug (slug),
  KEY ix_productos_categoria (categoria_id),
  KEY ix_productos_activo (activo, destacado),
  CONSTRAINT fk_productos_categoria
    FOREIGN KEY (categoria_id) REFERENCES categorias (id)
    ON DELETE RESTRICT
) ENGINE=InnoDB;


-- Toda venta ocurre sobre una VARIANTE, nunca sobre el producto directo.
-- Un producto sin variantes reales igual lleva una variante única
-- (ej. "Único"). Esto evita bifurcar la lógica del carrito.
CREATE TABLE variantes (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  producto_id   INT UNSIGNED  NOT NULL,
  nombre        VARCHAR(80)   NOT NULL,   -- "50 ml", "Lavanda", "Pack x3"
  sku           VARCHAR(60)   NULL,
  precio        DECIMAL(12,2) NOT NULL,
  precio_anterior DECIMAL(12,2) NULL,     -- para mostrar tachado en ofertas
  stock         INT           NOT NULL DEFAULT 0,
  peso_gramos   INT UNSIGNED  NULL,       -- útil si después integran correo
  activa        BOOLEAN       NOT NULL DEFAULT TRUE,
  creado_en     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_variantes_sku (sku),
  KEY ix_variantes_producto (producto_id),
  CONSTRAINT fk_variantes_producto
    FOREIGN KEY (producto_id) REFERENCES productos (id)
    ON DELETE CASCADE,
  CONSTRAINT ck_variantes_precio  CHECK (precio >= 0),
  CONSTRAINT ck_variantes_stock   CHECK (stock  >= 0)
) ENGINE=InnoDB;


CREATE TABLE imagenes_producto (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  producto_id INT UNSIGNED NOT NULL,
  url         VARCHAR(500) NOT NULL,
  alt         VARCHAR(200) NULL,
  orden       SMALLINT     NOT NULL DEFAULT 0,  -- orden 0 = imagen principal
  CONSTRAINT fk_imagenes_producto
    FOREIGN KEY (producto_id) REFERENCES productos (id)
    ON DELETE CASCADE,
  KEY ix_imagenes_producto (producto_id, orden)
) ENGINE=InnoDB;


-- ---------------------------------------------------------------------
--  ENVÍOS
--  Tarifa plana por zona. Suficiente hasta que el volumen justifique
--  integrar la API de Andreani o Correo Argentino.
-- ---------------------------------------------------------------------

CREATE TABLE zonas_envio (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(100)  NOT NULL,   -- "Río Cuarto", "Interior Córdoba"
  costo         DECIMAL(12,2) NOT NULL,
  demora_texto  VARCHAR(80)   NULL,       -- "24 a 48 hs hábiles"
  activa        BOOLEAN       NOT NULL DEFAULT TRUE,
  orden         SMALLINT      NOT NULL DEFAULT 0,
  CONSTRAINT ck_zonas_costo CHECK (costo >= 0)
) ENGINE=InnoDB;


-- ---------------------------------------------------------------------
--  PEDIDOS
--  Los ítems guardan nombre y precio COPIADOS, no referenciados.
--  Con la inflación argentina los precios se tocan seguido, y el
--  historial de ventas no puede reescribirse solo.
-- ---------------------------------------------------------------------

CREATE TABLE pedidos (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  numero            VARCHAR(20)   NOT NULL,   -- visible al cliente: VLA-000123

  -- Datos del comprador (compra sin registro obligatorio)
  cliente_nombre    VARCHAR(140)  NOT NULL,
  cliente_email     VARCHAR(180)  NOT NULL,
  cliente_telefono  VARCHAR(40)   NOT NULL,
  cliente_documento VARCHAR(20)   NULL,

  -- Entrega
  metodo_entrega    ENUM('envio','retiro') NOT NULL DEFAULT 'envio',
  zona_envio_id     INT UNSIGNED  NULL,
  direccion_calle   VARCHAR(180)  NULL,
  direccion_numero  VARCHAR(20)   NULL,
  direccion_extra   VARCHAR(120)  NULL,       -- piso, depto, entre calles
  direccion_ciudad  VARCHAR(120)  NULL,
  direccion_provincia VARCHAR(80) NULL,
  direccion_cp      VARCHAR(20)   NULL,

  -- Importes (calculados SIEMPRE en el backend, nunca desde el front)
  subtotal          DECIMAL(12,2) NOT NULL,
  costo_envio       DECIMAL(12,2) NOT NULL DEFAULT 0,
  total             DECIMAL(12,2) NOT NULL,

  -- Estados: el de pago lo maneja el webhook, el de preparación la admin
  estado_pago       ENUM('pendiente','aprobado','rechazado','devuelto','cancelado')
                    NOT NULL DEFAULT 'pendiente',
  estado_pedido     ENUM('nuevo','en_preparacion','enviado','entregado','cancelado')
                    NOT NULL DEFAULT 'nuevo',

  -- Mercado Pago
  mp_preference_id  VARCHAR(80)   NULL,
  mp_payment_id     VARCHAR(80)   NULL,
  mp_metodo         VARCHAR(60)   NULL,       -- "visa", "account_money"

  seguimiento       VARCHAR(120)  NULL,       -- código de despacho
  notas_cliente     VARCHAR(500)  NULL,
  notas_internas    VARCHAR(500)  NULL,

  creado_en         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                  ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_pedidos_numero (numero),
  KEY ix_pedidos_estado_pago (estado_pago),
  KEY ix_pedidos_creado (creado_en),
  KEY ix_pedidos_email (cliente_email),
  KEY ix_pedidos_mp_payment (mp_payment_id),
  CONSTRAINT fk_pedidos_zona
    FOREIGN KEY (zona_envio_id) REFERENCES zonas_envio (id)
    ON DELETE SET NULL
) ENGINE=InnoDB;


CREATE TABLE pedido_items (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pedido_id       INT UNSIGNED  NOT NULL,
  variante_id     INT UNSIGNED  NULL,        -- referencia blanda, puede borrarse

  -- Snapshot: así se veía el producto el día de la compra
  nombre_producto VARCHAR(140)  NOT NULL,
  nombre_variante VARCHAR(80)   NOT NULL,
  sku             VARCHAR(60)   NULL,
  precio_unitario DECIMAL(12,2) NOT NULL,
  cantidad        SMALLINT UNSIGNED NOT NULL,
  subtotal        DECIMAL(12,2) NOT NULL,

  KEY ix_items_pedido (pedido_id),
  CONSTRAINT fk_items_pedido
    FOREIGN KEY (pedido_id) REFERENCES pedidos (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_items_variante
    FOREIGN KEY (variante_id) REFERENCES variantes (id)
    ON DELETE SET NULL,
  CONSTRAINT ck_items_cantidad CHECK (cantidad > 0)
) ENGINE=InnoDB;


-- ---------------------------------------------------------------------
--  IDEMPOTENCIA DE WEBHOOKS
--  Mercado Pago reenvía notificaciones. Sin esta tabla terminás
--  descontando stock dos veces por el mismo pago.
--  Insertá ACÁ PRIMERO: si el UNIQUE falla, ya fue procesado, cortás.
-- ---------------------------------------------------------------------

CREATE TABLE mp_notificaciones (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payment_id    VARCHAR(80)  NOT NULL,
  topic         VARCHAR(40)  NULL,
  pedido_id     INT UNSIGNED NULL,
  payload       JSON         NULL,
  procesado_en  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_mp_payment (payment_id),
  CONSTRAINT fk_mp_pedido
    FOREIGN KEY (pedido_id) REFERENCES pedidos (id)
    ON DELETE SET NULL
) ENGINE=InnoDB;


-- ---------------------------------------------------------------------
--  BOTÓN DE ARREPENTIMIENTO · Resolución 424/2020
--  Obligatorio en toda tienda online argentina. Link visible desde la
--  home, sin registro previo, y hay 24 hs para devolver el número
--  de trámite al consumidor.
-- ---------------------------------------------------------------------

CREATE TABLE arrepentimientos (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo          VARCHAR(30)  NOT NULL,     -- ARR-2026-000045
  pedido_numero   VARCHAR(20)  NULL,         -- lo escribe el cliente
  nombre          VARCHAR(140) NOT NULL,
  email           VARCHAR(180) NOT NULL,
  telefono        VARCHAR(40)  NULL,
  motivo          VARCHAR(600) NULL,         -- opcional por ley
  estado          ENUM('recibido','en_gestion','resuelto') NOT NULL DEFAULT 'recibido',
  creado_en       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_arrepentimientos_codigo (codigo)
) ENGINE=InnoDB;


-- ---------------------------------------------------------------------
--  ADMINISTRACIÓN
-- ---------------------------------------------------------------------

CREATE TABLE usuarios (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre         VARCHAR(120) NOT NULL,
  email          VARCHAR(180) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,      -- bcrypt
  rol            ENUM('admin','operador') NOT NULL DEFAULT 'operador',
  activo         BOOLEAN      NOT NULL DEFAULT TRUE,
  ultimo_acceso  TIMESTAMP    NULL,
  creado_en      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_usuarios_email (email)
) ENGINE=InnoDB;


-- ---------------------------------------------------------------------
--  DATOS INICIALES
-- ---------------------------------------------------------------------

INSERT INTO categorias (nombre, slug, descripcion, orden) VALUES
  ('Facial',     'facial',     'Cremas, serums y limpiadores',        1),
  ('Corporal',   'corporal',   'Manteca corporal, aceites y exfoliantes', 2),
  ('Jabones',    'jabones',    'Jabones artesanales en frío',         3),
  ('Capilar',    'capilar',    'Shampoo sólido y acondicionadores',   4),
  ('Kits',       'kits',       'Combos y cajas de regalo',            5);

INSERT INTO zonas_envio (nombre, costo, demora_texto, orden) VALUES
  ('Río Cuarto y alrededores', 0.00,    'Entrega en el día o al siguiente', 1),
  ('Provincia de Córdoba',     0.00,    '2 a 4 días hábiles',               2),
  ('Resto del país',           0.00,    '3 a 7 días hábiles',               3);
-- Los costos van en 0 a propósito: cargalos desde el panel con
-- las tarifas reales del momento.
