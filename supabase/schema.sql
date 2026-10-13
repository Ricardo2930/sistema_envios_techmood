-- =========================================================================
-- ESQUEMA COMPLETO DE BASE DE DATOS: SISTEMA DE ENVÍOS Y RASTREO TECH MOOD
-- =========================================================================
-- Incluye soporte para Envíos Nacionales (Shalom, Olva, Urbano) y 
-- Envíos Locales Lima Metropolitana con Motorizados (M1/M2), fotos y KPIs.
-- =========================================================================

-- 1. Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Crear tabla principal de pedidos
CREATE TABLE IF NOT EXISTS public.pedidos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo_seguimiento VARCHAR(25) NOT NULL UNIQUE, -- Ej: TM-849201
    nombre_cliente VARCHAR(150) NOT NULL,
    dni_cliente VARCHAR(15) NOT NULL,
    telefono_cliente VARCHAR(20) NOT NULL,
    
    -- Tipo de envío: provincia (agencias) o lima_metropolitana (motorizado)
    tipo_envio VARCHAR(30) NOT NULL DEFAULT 'provincia' 
        CHECK (tipo_envio IN ('provincia', 'lima_metropolitana')),

    courier VARCHAR(20) NOT NULL CHECK (courier IN ('shalom', 'olva', 'urbano', 'motorizado')),
    agencia_nombre TEXT NULL,
    agencia_direccion TEXT NULL,
    agencia_ubigeo VARCHAR(100) NULL,
    fecha_prevista DATE NOT NULL,
    
    -- Datos específicos para Lima Metropolitana (Motorizado)
    distrito_lima VARCHAR(100) NULL,
    direccion_entrega TEXT NULL,
    referencia_entrega TEXT NULL,
    motorizado_asignado VARCHAR(100) NULL,        -- 'Motorizado 1' | 'Motorizado 2'
    foto_entrega TEXT NULL,                       -- Evidencia fotográfica comprimida

    -- Asignación oficial emitida en Shalom Pro / Courier Provincia
    numero_guia VARCHAR(50) NULL,                 -- Ej: 001-098234
    codigo_seguridad VARCHAR(20) NULL,            -- Clave de 4 dígitos Shalom para consulta
    link_rastreo TEXT NULL,                       -- Link directo oficial de rastreo
    tipo_mercaderia VARCHAR(30) DEFAULT 'PAQUETE XS', 
    
    -- Estado logístico (incluye 'asignado' para motorizados Lima Express y 'en_origen' para agencias courier)
    estado VARCHAR(30) NOT NULL DEFAULT 'registrado' 
        CHECK (estado IN ('registrado', 'asignado', 'en_preparacion', 'en_origen', 'en_transito', 'en_agencia', 'entregado', 'incidencia')),
    estado_detalle TEXT DEFAULT 'Pedido recibido en el sistema tech mood',
    historial_estados JSONB DEFAULT '[]'::jsonb,
    
    -- Control de notificaciones
    notificado_cliente BOOLEAN DEFAULT FALSE,
    notificado_admin BOOLEAN DEFAULT FALSE,
    
    -- Fecha exacta de entrega (se registra automáticamente al cambiar estado a 'entregado')
    fecha_entregado TIMESTAMPTZ NULL,
    
    -- Auditoría (hora local de Perú)
    creado_en TIMESTAMPTZ DEFAULT timezone('America/Lima'::text, now()) NOT NULL,
    actualizado_en TIMESTAMPTZ DEFAULT timezone('America/Lima'::text, now()) NOT NULL
);

-- 3. Índices de optimización
CREATE INDEX IF NOT EXISTS idx_pedidos_codigo ON public.pedidos(codigo_seguimiento);
CREATE INDEX IF NOT EXISTS idx_pedidos_dni ON public.pedidos(dni_cliente);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON public.pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_tipo_envio ON public.pedidos(tipo_envio);
CREATE INDEX IF NOT EXISTS idx_pedidos_distrito ON public.pedidos(distrito_lima);
CREATE INDEX IF NOT EXISTS idx_pedidos_motorizado ON public.pedidos(motorizado_asignado);
CREATE INDEX IF NOT EXISTS idx_pedidos_entregado ON public.pedidos(fecha_entregado) WHERE fecha_entregado IS NOT NULL;

-- 4. Asegurar compatibilidad y columnas adicionales si la tabla ya existía
ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS pedidos_courier_check;
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_courier_check CHECK (courier IN ('shalom', 'olva', 'urbano', 'motorizado'));

ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS pedidos_estado_check;
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_estado_check CHECK (estado IN ('registrado', 'asignado', 'en_preparacion', 'en_origen', 'en_transito', 'en_agencia', 'entregado', 'incidencia'));

ALTER TABLE public.pedidos ALTER COLUMN agencia_nombre DROP NOT NULL;
ALTER TABLE public.pedidos ALTER COLUMN agencia_direccion DROP NOT NULL;

ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS tipo_envio VARCHAR(30) DEFAULT 'provincia';
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS distrito_lima VARCHAR(100) NULL;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS direccion_entrega TEXT NULL;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS referencia_entrega TEXT NULL;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS motorizado_asignado VARCHAR(100) NULL;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS foto_entrega TEXT NULL;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS fecha_entregado TIMESTAMPTZ NULL;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS link_rastreo TEXT NULL;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS tipo_mercaderia VARCHAR(30) DEFAULT 'PAQUETE XS';

-- 5. Trigger automático para actualizar timestamp en cada UPDATE
CREATE OR REPLACE FUNCTION update_pedidos_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = timezone('America/Lima'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pedidos_timestamp ON public.pedidos;
CREATE TRIGGER trigger_pedidos_timestamp
    BEFORE UPDATE ON public.pedidos
    FOR EACH ROW
    EXECUTE FUNCTION update_pedidos_timestamp();

-- 6. Seguridad a Nivel de Fila (RLS)
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura publica de pedidos" ON public.pedidos;
CREATE POLICY "Permitir lectura publica de pedidos"
    ON public.pedidos
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Permitir creacion de pedidos desde la web" ON public.pedidos;
CREATE POLICY "Permitir creacion de pedidos desde la web"
    ON public.pedidos
    FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion de pedidos" ON public.pedidos;
CREATE POLICY "Permitir actualizacion de pedidos"
    ON public.pedidos
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir eliminacion de pedidos" ON public.pedidos;
CREATE POLICY "Permitir eliminacion de pedidos"
    ON public.pedidos
    FOR DELETE
    USING (true);
