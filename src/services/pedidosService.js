import { supabase, isSupabaseConfigured } from '../lib/supabase';

const LOCAL_STORAGE_KEY = 'techmood_pedidos_local_v2';

// Pedidos iniciales de demostración completos para que el panel y los KPIs funcionen desde el primer instante
const PEDIDOS_DEMO = [];

// Helper para obtener pedidos de LocalStorage
function getLocalPedidos() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Helper para guardar en LocalStorage
function saveLocalPedidos(pedidos) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(pedidos));
  } catch (e) {
    console.error('Error guardando en localStorage:', e);
  }
}

// Generador de código único con prefijo TM- y 6 dígitos
export function generarCodigoSeguimiento() {
  const aleatorio = Math.floor(100000 + Math.random() * 900000);
  return `TM-${aleatorio}`;
}

// Helper para validar formato UUID
export function esUuidValido(id) {
  if (typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// Lista exhaustiva de columnas del esquema en Supabase para evitar PGRST102 en inserciones masivas
const COLUMNAS_PEDIDO_SUPABASE = [
  'codigo_seguimiento',
  'nombre_cliente',
  'dni_cliente',
  'telefono_cliente',
  'tipo_envio',
  'courier',
  'agencia_nombre',
  'agencia_direccion',
  'agencia_ubigeo',
  'fecha_prevista',
  'distrito_lima',
  'direccion_entrega',
  'referencia_entrega',
  'motorizado_asignado',
  'foto_entrega',
  'numero_guia',
  'codigo_seguridad',
  'link_rastreo',
  'tipo_mercaderia',
  'metodo_pago',
  'estado',
  'estado_detalle',
  'historial_estados',
  'notificado_cliente',
  'notificado_admin',
  'fecha_entregado'
];

// Verificar estado de conexión real con Supabase
export async function verificarEstadoSupabase() {
  if (!isSupabaseConfigured) {
    return { estado: 'desconectado', mensaje: 'Sin credenciales en .env', count: 0 };
  }
  try {
    const { count, error } = await supabase
      .from('pedidos')
      .select('*', { count: 'exact', head: true });

    if (error) {
      if (error.code === 'PGRST205' || (error.message && error.message.includes('schema cache'))) {
        return { 
          estado: 'falta_tabla', 
          count: 0,
          mensaje: 'Tabla pedidos aún no existe en Supabase. Ejecuta supabase/schema.sql en el SQL Editor.' 
        };
      }
      return { 
        estado: 'error', 
        count: 0,
        mensaje: error.message || 'Error consultando Supabase' 
      };
    }

    return { 
      estado: 'conectado', 
      count: count || 0,
      mensaje: `Supabase Conectado (${count || 0} órdenes en la nube)` 
    };
  } catch (err) {
    return { 
      estado: 'error', 
      count: 0,
      mensaje: err.message || 'Fallo de red al conectar con Supabase' 
    };
  }
}

// Sincronizar las órdenes actuales del panel a Supabase de forma segura y normalizada
export async function migrarPedidosLocalesASupabase(pedidosLocales = null) {
  if (!isSupabaseConfigured) return { ok: false, error: 'Supabase no configurado' };
  let origen = pedidosLocales;
  if (!origen || origen.length === 0) {
    origen = getLocalPedidos();
  }
  if (!origen || origen.length === 0) {
    origen = PEDIDOS_DEMO;
  }

  try {
    // Normalizar todos los objetos para que compartan exactamente las mismas claves (requerido por PostgREST)
    const payloads = origen.map((p) => {
      const obj = {};
      COLUMNAS_PEDIDO_SUPABASE.forEach((col) => {
        obj[col] = p[col] !== undefined ? p[col] : null;
      });
      // Asegurar valores por defecto requeridos si vinieran nulos
      if (!obj.tipo_envio) obj.tipo_envio = obj.distrito_lima ? 'lima_metropolitana' : 'provincia';
      if (!obj.courier) obj.courier = obj.tipo_envio === 'lima_metropolitana' ? 'motorizado' : 'shalom';
      if (!obj.estado) obj.estado = 'registrado';
      if (!obj.tipo_mercaderia) obj.tipo_mercaderia = 'PAQUETE XS';
      if (!obj.metodo_pago) obj.metodo_pago = obj.tipo_envio === 'lima_metropolitana' ? 'contraentrega' : 'pagado';
      if (!obj.historial_estados) obj.historial_estados = [];
      if (typeof obj.notificado_cliente !== 'boolean') obj.notificado_cliente = false;
      if (typeof obj.notificado_admin !== 'boolean') obj.notificado_admin = false;
      return obj;
    });

    const { data, error } = await supabase
      .from('pedidos')
      .upsert(payloads, { onConflict: 'codigo_seguimiento' })
      .select();

    if (error) {
      console.error('Error migrando pedidos a Supabase:', error);
      return { ok: false, error: error.message };
    }

    if (data && data.length > 0) {
      saveLocalPedidos(data);
      return { ok: true, count: data.length, data };
    }
    return { ok: true, count: 0 };
  } catch (err) {
    console.error('Fallo en migración a Supabase:', err);
    return { ok: false, error: err.message };
  }
}

// 1. Crear nuevo pedido (Soporta Provincia y Lima Metropolitana)
export async function crearPedido(datos) {
  const codigo = generarCodigoSeguimiento();
  const esLima = datos.tipo_envio === 'lima_metropolitana';

  const nuevoPedido = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `local-${Date.now()}`,
    codigo_seguimiento: codigo,
    tipo_envio: datos.tipo_envio || (datos.distrito_lima ? 'lima_metropolitana' : 'provincia'),
    nombre_cliente: datos.nombre_cliente.trim(),
    dni_cliente: datos.dni_cliente.trim(),
    telefono_cliente: datos.telefono_cliente.trim(),
    courier: esLima ? 'motorizado' : (datos.courier || 'shalom'),
    
    // Agencia (Provincia) o Resumen de Domicilio (Lima)
    agencia_nombre: esLima ? `Domicilio - ${datos.distrito_lima}` : (datos.agencia_nombre || ''),
    agencia_direccion: esLima ? (datos.direccion_entrega || '') : (datos.agencia_direccion || ''),
    agencia_ubigeo: esLima ? `Lima - ${datos.distrito_lima}` : (datos.agencia_ubigeo || ''),
    
    // Campos específicos de Lima Metropolitana
    distrito_lima: datos.distrito_lima || null,
    direccion_entrega: datos.direccion_entrega || null,
    referencia_entrega: datos.referencia_entrega || null,
    motorizado_asignado: datos.motorizado_asignado || null,
    foto_entrega: null,

    fecha_prevista: datos.fecha_prevista,
    numero_guia: null,
    codigo_seguridad: null,
    link_rastreo: null,
    tipo_mercaderia: datos.tipo_mercaderia || 'PAQUETE XS',
    metodo_pago: datos.metodo_pago || (esLima ? 'contraentrega' : 'pagado'),
    estado: (esLima && datos.motorizado_asignado) ? 'asignado' : 'registrado',
    estado_detalle: esLima 
      ? (datos.motorizado_asignado 
          ? `[Lima Express] Paquete preparado y asignado a ${datos.motorizado_asignado} (${datos.motorizado_asignado === 'Motorizado 1' ? 'M1' : datos.motorizado_asignado === 'Motorizado 2' ? 'M2' : datos.motorizado_asignado}) para entrega express en ${datos.distrito_lima}.`
          : `Pedido Lima Express registrado para ${datos.distrito_lima}. Pendiente de despacho.`)
      : 'Pedido registrado en tech mood. Pendiente de emisión de guía.',
    historial_estados: [
      {
        estado: (esLima && datos.motorizado_asignado) ? 'asignado' : 'registrado',
        fecha: new Date().toISOString(),
        detalle: esLima 
          ? (datos.motorizado_asignado
              ? `[Lima Express] Paquete preparado y asignado a ${datos.motorizado_asignado} para entrega en ${datos.distrito_lima}`
              : `Pedido Lima Express registrado en sistema para entrega en ${datos.distrito_lima}`)
          : 'Pedido recibido en el sistema tech mood'
      }
    ],
    fecha_entregado: null,
    creado_en: new Date().toISOString(),
    actualizado_en: new Date().toISOString()
  };

  // Intentar guardar en Supabase si está activo
  if (isSupabaseConfigured) {
    try {
      const payloadSupabase = esUuidValido(nuevoPedido.id) ? nuevoPedido : (() => {
        const { id: _unusedId, ...resto } = nuevoPedido;
        void _unusedId;
        return resto;
      })();

      const { data, error } = await supabase
        .from('pedidos')
        .insert([payloadSupabase])
        .select()
        .single();
      
      if (!error && data) {
        const locales = getLocalPedidos();
        saveLocalPedidos([data, ...locales]);
        return data;
      }
      console.warn('Supabase retornó error al insertar, guardando en local:', error);
    } catch (err) {
      console.warn('Error conectando a Supabase, guardando en local:', err);
    }
  }

  // Guardado en LocalStorage
  const locales = getLocalPedidos();
  const actualizados = [nuevoPedido, ...locales];
  saveLocalPedidos(actualizados);
  return nuevoPedido;
}

// 2. Obtener lista de pedidos (para Admin y Dashboards)
export async function obtenerPedidos() {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('pedidos')
        .select('*')
        .order('creado_en', { ascending: false });
      
      if (!error && data) {
        saveLocalPedidos(data);
        return data;
      }
      console.warn('Error consultando Supabase, usando locales:', error);
    } catch (err) {
      console.warn('Fallo de conexión a Supabase:', err);
    }
  }

  return getLocalPedidos();
}

// 3. Buscar pedido por Código (TM-XXXXXX) o por DNI
export async function buscarPedido(termino) {
  const query = termino.trim().toUpperCase();

  if (isSupabaseConfigured) {
    try {
      const { data: porCodigo, error: err1 } = await supabase
        .from('pedidos')
        .select('*')
        .ilike('codigo_seguimiento', query)
        .maybeSingle();

      if (!err1 && porCodigo) return porCodigo;

      const { data: porDni, error: err2 } = await supabase
        .from('pedidos')
        .select('*')
        .eq('dni_cliente', query.trim())
        .order('creado_en', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!err2 && porDni) return porDni;
    } catch (err) {
      console.warn('Error consultando Supabase:', err);
    }
  }

  const locales = getLocalPedidos();
  const encontrado = locales.find(
    (p) =>
      p.codigo_seguimiento.toUpperCase() === query ||
      p.dni_cliente.trim() === query.replace(/\s+/g, '')
  );

  return encontrado || null;
}

// 4. Actualizar Guía, Estado, Motorizado o Foto de Entrega
export async function actualizarPedido(id, camposActualizados) {
  const ahora = new Date().toISOString();
  const payload = {
    ...camposActualizados,
    actualizado_en: ahora,
    ...(camposActualizados.estado === 'entregado' && !camposActualizados.fecha_entregado
      ? { fecha_entregado: ahora }
      : {})
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('pedidos')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        const locales = getLocalPedidos();
        const index = locales.findIndex((p) => p.id === id);
        if (index !== -1) {
          locales[index] = data;
          saveLocalPedidos(locales);
        }
        return data;
      }

      if (error) {
        console.warn('Advertencia actualizando en Supabase (se persiste localmente):', error.message || error);
        const locales = getLocalPedidos();
        const index = locales.findIndex((p) => p.id === id);
        if (index !== -1) {
          locales[index] = { ...locales[index], ...payload };
          saveLocalPedidos(locales);
          return locales[index];
        }
        return payload;
      }
    } catch (err) {
      console.warn('Fallo al conectar con Supabase (se persiste localmente):', err);
      const locales = getLocalPedidos();
      const index = locales.findIndex((p) => p.id === id);
      if (index !== -1) {
        locales[index] = { ...locales[index], ...payload };
        saveLocalPedidos(locales);
        return locales[index];
      }
      return payload;
    }
  }

  const locales = getLocalPedidos();
  const index = locales.findIndex((p) => p.id === id);
  if (index !== -1) {
    locales[index] = { ...locales[index], ...payload };
    saveLocalPedidos(locales);
    return locales[index];
  }

  return null;
}

// 5. Eliminar pedido
export async function eliminarPedido(id) {
  if (isSupabaseConfigured) {
    try {
      await supabase.from('pedidos').delete().eq('id', id);
    } catch (err) {
      console.warn('Error eliminando de Supabase:', err);
    }
  }

  const locales = getLocalPedidos();
  const filtrados = locales.filter((p) => p.id !== id);
  saveLocalPedidos(filtrados);
  return true;
}
