import { useState, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, Lock, Unlock, Search, RefreshCw, Copy, Check,
  Edit3, Trash2, ExternalLink, Package, Truck, Building2, CheckCircle2,
  AlertTriangle, X, Eye, EyeOff, MessageCircle,
  FileSpreadsheet, Bike, BarChart3, Navigation, Camera, MapPin
} from 'lucide-react';
import { obtenerPedidos, actualizarPedido, eliminarPedido, verificarEstadoSupabase } from '../services/pedidosService';
import { descargarExcelMasivoShalom } from '../utils/shalomExcelExport';
import AnalyticsDashboard from './AnalyticsDashboard';
import MotorizadoDashboard from './MotorizadoDashboard';
import CustomSelect from './CustomSelect';

// Hashes criptográficos SHA-256 para validación segura (evita exponer PINs en texto claro en el bundle cliente)
const ADMIN_HASH_FALLBACK = 'f305e71a41957b09ea466b6997f110536025a953e9426f7ba77e5b95d89b4181';
const VENDEDOR_HASH_FALLBACK = '65fce091fd223aa5c83aa6df90475f44b0a131863e529c7d54bebdb4e8b54c22';
const M1_HASH_FALLBACK = '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c';
const M2_HASH_FALLBACK = 'edee29f882543b956620b26d0ee0e7e950399b1c4222f5de05e06425b4c995e9';
const M_ALL_HASH_FALLBACK = 'c1f330d0aff31c1c87403f1e4347bcc21aff7c179908723535f2b31723702525';

async function hashPin(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

const AdminDashboard = ({ onVerRastreo }) => {
  // Estado de autenticación y rol inicializados limpiamente desde sessionStorage
  const [autenticado, setAutenticado] = useState(() => {
    return sessionStorage.getItem('techmood_admin_auth') === 'true';
  });
  const [rolUsuario, setRolUsuario] = useState(() => {
    return sessionStorage.getItem('techmood_rol') || 'admin';
  });
  const [motorizadoLogueado, setMotorizadoLogueado] = useState(() => {
    return sessionStorage.getItem('techmood_motorizado') || 'todos';
  });
  const [pinIngresado, setPinIngresado] = useState('');
  const [errorPin, setErrorPin] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);

  // Pestañas del Panel Admin
  const [tabActivo, setTabActivo] = useState('todos'); // 'todos' | 'provincia' | 'lima' | 'kpis' | 'portal_repartidor'

  // Estado de datos
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroCourier, setFiltroCourier] = useState('todos');
  const [filtroMotorizadoTabla, setFiltroMotorizadoTabla] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [exportandoExcel, setExportandoExcel] = useState(false);

  // Visor de foto de evidencia
  const [fotoParaVer, setFotoParaVer] = useState(null);

  // Avisos toast
  const [toast, setToast] = useState(null);

  // Modal profesional de confirmación de eliminación
  const [pedidoParaEliminar, setPedidoParaEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  // Estado de conexión e información de Supabase
  const [infoSupabase, setInfoSupabase] = useState({ estado: 'verificando', count: 0, mensaje: '' });

  // Registro de avisos de WhatsApp enviados (cliente / admin) con persistencia en localStorage
  const [avisosEnviados, setAvisosEnviados] = useState(() => {
    try {
      const guardados = localStorage.getItem('techmood_avisos_whatsapp');
      return guardados ? JSON.parse(guardados) : {};
    } catch {
      return {};
    }
  });

  const registrarAvisoEnviado = (pedidoId, tipo) => {
    setAvisosEnviados((prev) => {
      const nuevo = {
        ...prev,
        [pedidoId]: {
          ...(prev[pedidoId] || {}),
          [tipo]: true
        }
      };
      try {
        localStorage.setItem('techmood_avisos_whatsapp', JSON.stringify(nuevo));
      } catch (e) {
        console.warn('No se pudo guardar en localStorage', e);
      }
      return nuevo;
    });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Modal de edición de orden
  const [pedidoEditando, setPedidoEditando] = useState(null);
  const [formEdicion, setFormEdicion] = useState({
    numero_guia: '',
    codigo_seguridad: '',
    link_rastreo: '',
    tipo_mercaderia: 'PAQUETE XS',
    distrito_lima: '',
    direccion_entrega: '',
    referencia_entrega: '',
    motorizado_asignado: '',
    estado: 'registrado',
    estado_detalle: ''
  });
  const [guardando, setGuardando] = useState(false);
  const [mostrarCambioManualEstado, setMostrarCambioManualEstado] = useState(false);

  const cargarListaPedidos = useCallback(async (mostrarLoader = false) => {
    if (mostrarLoader) setCargando(true);
    try {
      const lista = await obtenerPedidos();
      const estadoSb = await verificarEstadoSupabase();
      setPedidos(lista || []);
      setInfoSupabase({
        ...estadoSb,
        count: estadoSb.count > 0 ? estadoSb.count : (lista ? lista.length : 0)
      });
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (autenticado) {
      cargarListaPedidos();
    }
  }, [autenticado, cargarListaPedidos]);

  const handleLogin = async (e) => {
    e.preventDefault();
    const pin = pinIngresado.trim();
    if (!pin) {
      setErrorPin('Por favor ingresa tu clave o PIN de acceso.');
      return;
    }

    const hashedInput = await hashPin(pin);
    const envAdminPin = import.meta.env.VITE_ADMIN_PIN;
    const envVendedorPin = import.meta.env.VITE_VENDEDOR_PIN;
    const envM1Pin = import.meta.env.VITE_M1_PIN;
    const envM2Pin = import.meta.env.VITE_M2_PIN;
    const envMAllPin = import.meta.env.VITE_M_ALL_PIN;

    const esAdmin = hashedInput === ADMIN_HASH_FALLBACK || (envAdminPin && pin === envAdminPin);
    const esVendedor = hashedInput === VENDEDOR_HASH_FALLBACK || (envVendedorPin && pin === envVendedorPin);
    const esM1 = hashedInput === M1_HASH_FALLBACK || (envM1Pin && pin === envM1Pin);
    const esM2 = hashedInput === M2_HASH_FALLBACK || (envM2Pin && pin === envM2Pin);
    const esMAll = hashedInput === M_ALL_HASH_FALLBACK || (envMAllPin && pin === envMAllPin);

    if (esAdmin) {
      setAutenticado(true);
      setRolUsuario('admin');
      sessionStorage.setItem('techmood_admin_auth', 'true');
      sessionStorage.setItem('techmood_rol', 'admin');
      setErrorPin('');
    } else if (esVendedor) {
      setAutenticado(true);
      setRolUsuario('vendedor');
      sessionStorage.setItem('techmood_admin_auth', 'true');
      sessionStorage.setItem('techmood_rol', 'vendedor');
      setErrorPin('');
    } else if (esM1) {
      setAutenticado(true);
      setRolUsuario('motorizado');
      setMotorizadoLogueado('Motorizado 1');
      sessionStorage.setItem('techmood_admin_auth', 'true');
      sessionStorage.setItem('techmood_rol', 'motorizado');
      sessionStorage.setItem('techmood_motorizado', 'Motorizado 1');
      setErrorPin('');
    } else if (esM2) {
      setAutenticado(true);
      setRolUsuario('motorizado');
      setMotorizadoLogueado('Motorizado 2');
      sessionStorage.setItem('techmood_admin_auth', 'true');
      sessionStorage.setItem('techmood_rol', 'motorizado');
      sessionStorage.setItem('techmood_motorizado', 'Motorizado 2');
      setErrorPin('');
    } else if (esMAll) {
      setAutenticado(true);
      setRolUsuario('motorizado');
      setMotorizadoLogueado('todos');
      sessionStorage.setItem('techmood_admin_auth', 'true');
      sessionStorage.setItem('techmood_rol', 'motorizado');
      sessionStorage.setItem('techmood_motorizado', 'todos');
      setErrorPin('');
    } else {
      setErrorPin('Clave o PIN incorrecto. Por favor verifica tus credenciales de acceso.');
    }
  };

  const handleLogout = () => {
    setAutenticado(false);
    sessionStorage.removeItem('techmood_admin_auth');
    sessionStorage.removeItem('techmood_rol');
    sessionStorage.removeItem('techmood_motorizado');
    setRolUsuario('admin');
    setMotorizadoLogueado('todos');
    setPinIngresado('');
  };

  // Abrir modal de edición
  const abrirEdicion = (p) => {
    setPedidoEditando(p);
    setMostrarCambioManualEstado(false);
    setFormEdicion({
      numero_guia: p.numero_guia || '',
      codigo_seguridad: p.codigo_seguridad || '',
      link_rastreo: p.link_rastreo || '',
      tipo_mercaderia: p.tipo_mercaderia || 'PAQUETE XS',
      distrito_lima: p.distrito_lima || '',
      direccion_entrega: p.direccion_entrega || '',
      referencia_entrega: p.referencia_entrega || '',
      motorizado_asignado: p.motorizado_asignado || '',
      estado: p.estado || 'registrado',
      estado_detalle: p.estado_detalle || ''
    });
  };

  // Guardar edición
  const handleGuardarEdicion = async (e) => {
    e.preventDefault();
    if (!pedidoEditando) return;

    setGuardando(true);
    try {
      const nuevoHistorial = [...(pedidoEditando.historial_estados || [])];
      
      let estadoFinal = formEdicion.estado;
      let detalleFinal = formEdicion.estado_detalle.trim();

      // Transición automática secuencial:
      // Si la orden estaba en registrado y se ingresó la guía, avanza automáticamente a "en_preparacion"
      if (pedidoEditando.estado === 'registrado' && formEdicion.numero_guia.trim() !== '') {
        estadoFinal = 'en_preparacion';
        if (!detalleFinal) {
          detalleFinal = `[tech mood] Guía asignada (${formEdicion.numero_guia.trim()}). Paquete en empaque y preparación para despacho a agencia origen.`;
        }
      }

      // Para Lima Express: Si la orden estaba en registrado y se asignó motorizado, avanza automáticamente a "asignado"
      const esLimaEditando = pedidoEditando.tipo_envio === 'lima_metropolitana' || pedidoEditando.courier === 'motorizado' || Boolean(pedidoEditando.distrito_lima);
      if (esLimaEditando) {
        if (formEdicion.motorizado_asignado && (pedidoEditando.estado === 'registrado' || pedidoEditando.estado === 'en_preparacion')) {
          estadoFinal = 'asignado';
          const alias = formEdicion.motorizado_asignado === 'Motorizado 1' ? 'M1' : formEdicion.motorizado_asignado === 'Motorizado 2' ? 'M2' : formEdicion.motorizado_asignado;
          if (!detalleFinal || detalleFinal === pedidoEditando.estado_detalle) {
            detalleFinal = `[Lima Express] Paquete preparado y asignado a ${formEdicion.motorizado_asignado} (${alias}) para salida express.`;
          }
        } else if (!formEdicion.motorizado_asignado && pedidoEditando.estado === 'asignado') {
          estadoFinal = 'registrado';
          if (!detalleFinal || detalleFinal === pedidoEditando.estado_detalle) {
            detalleFinal = '[Lima Express] Pendiente de asignación de motorizado.';
          }
        }
      }

      if (estadoFinal !== pedidoEditando.estado) {
        nuevoHistorial.push({
          estado: estadoFinal,
          fecha: new Date().toISOString(),
          detalle: detalleFinal || `Estado actualizado a ${estadoFinal}`
        });
      }

      const res = await actualizarPedido(pedidoEditando.id, {
        numero_guia: formEdicion.numero_guia.trim(),
        codigo_seguridad: formEdicion.codigo_seguridad.trim(),
        link_rastreo: formEdicion.link_rastreo.trim() || null,
        tipo_mercaderia: formEdicion.tipo_mercaderia || 'PAQUETE XS',
        distrito_lima: formEdicion.distrito_lima.trim() || null,
        direccion_entrega: formEdicion.direccion_entrega.trim() || null,
        referencia_entrega: formEdicion.referencia_entrega.trim() || null,
        motorizado_asignado: formEdicion.motorizado_asignado || null,
        estado: estadoFinal,
        estado_detalle: detalleFinal,
        historial_estados: nuevoHistorial
      });

      if (res) {
        setPedidos((prev) =>
          prev.map((item) => (item.id === pedidoEditando.id ? { ...item, ...res } : item))
        );
        setPedidoEditando(null);
        setToast(`Orden ${pedidoEditando.codigo_seguimiento} actualizada con éxito.${estadoFinal !== pedidoEditando.estado ? ` Estado: ${estadoFinal}` : ''}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGuardando(false);
    }
  };

  // Asignar motorizado en 1 clic desde la tabla
  const asignarMotorizadoRapido = async (p, nuevoMotorizado) => {
    if (p.estado === 'entregado') return; // Protección: Orden cerrada, no se puede alterar el motorizado
    const valor = nuevoMotorizado === 'sin_asignar' ? null : nuevoMotorizado;
    
    let nuevoEstado = p.estado;
    let nuevoDetalle;

    // Transición automática: Si se asigna motorizado y la orden no está en ruta/entregada, pasa a 'asignado'
    // Si se retira la asignación (sin asignar), regresa a 'registrado'
    if (valor) {
      if (p.estado === 'registrado' || p.estado === 'en_preparacion' || p.estado === 'asignado') {
        nuevoEstado = 'asignado';
      }
      const alias = valor === 'Motorizado 1' ? 'M1' : valor === 'Motorizado 2' ? 'M2' : valor;
      nuevoDetalle = `[Lima Express] Paquete preparado y asignado a ${valor} (${alias}) para entrega express.`;
    } else {
      if (p.estado === 'asignado') {
        nuevoEstado = 'registrado';
      }
      nuevoDetalle = '[Lima Express] Pendiente de asignación de motorizado.';
    }

    const nuevoHistorial = [...(p.historial_estados || [])];
    if (nuevoEstado !== p.estado || valor !== p.motorizado_asignado) {
      nuevoHistorial.push({
        estado: nuevoEstado,
        fecha: new Date().toISOString(),
        detalle: nuevoDetalle
      });
    }

    const res = await actualizarPedido(p.id, {
      motorizado_asignado: valor,
      estado: nuevoEstado,
      estado_detalle: nuevoDetalle,
      historial_estados: nuevoHistorial
    });

    if (res) {
      setPedidos((prev) =>
        prev.map((item) => (item.id === p.id ? { ...item, ...res } : item))
      );
      const alias = valor === 'Motorizado 1' ? 'M1' : valor === 'Motorizado 2' ? 'M2' : valor;
      setToast(
        valor
          ? `🛵 ${p.codigo_seguimiento} asignado a: ${valor} (Estado: Asignado ${alias})`
          : `⚠️ ${p.codigo_seguimiento} sin asignar (Estado: Registrado)`
      );
    }
  };

  // Helper para renderizar badge de estado unificado y resiliente
  const obtenerBadgeEstado = (p, esLima) => {
    if (p.estado === 'entregado') {
      return {
        texto: 'Entregado',
        clase: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
      };
    }
    if (p.estado === 'en_transito') {
      return {
        texto: esLima ? 'En Ruta' : 'En Tránsito',
        clase: 'bg-blue-500/15 text-blue-400 border border-blue-500/30 font-bold'
      };
    }
    if (p.estado === 'en_agencia') {
      return {
        texto: 'En Agencia Destino',
        clase: 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
      };
    }
    if (p.estado === 'en_origen') {
      return {
        texto: 'En Origen',
        clase: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
      };
    }
    // Para Lima Express: si está asignado o tiene motorizado asignado (y no está en ruta o entregado)
    if (esLima && (p.estado === 'asignado' || Boolean(p.motorizado_asignado))) {
      const alias = p.motorizado_asignado === 'Motorizado 1'
        ? 'M1'
        : p.motorizado_asignado === 'Motorizado 2'
          ? 'M2'
          : (p.motorizado_asignado || 'Reparto');
      return {
        texto: `🛵 Asignado ${alias}`,
        clase: 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm shadow-purple-500/10 font-bold'
      };
    }
    if (p.estado === 'en_preparacion') {
      return {
        texto: 'En Preparación',
        clase: 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
      };
    }
    return {
      texto: 'Registrado',
      clase: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 font-semibold'
    };
  };

  // URL Google Maps
  const obtenerUrlGoogleMaps = (p) => {
    const dirCompleta = `${p.direccion_entrega || p.agencia_direccion || ''}, ${p.distrito_lima || ''}, Lima, Peru`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dirCompleta)}`;
  };

  // URL WhatsApp Cliente (coordinación previa)
  const obtenerUrlWhatsAppCliente = (p) => {
    const tel = p.telefono_cliente.replace(/\D/g, '').replace(/^51/, '');
    const msg = `Hola ${p.nombre_cliente} 👋 Te escribimos de tech mood sobre tu pedido *${p.codigo_seguimiento}*. Tu entrega en *${p.distrito_lima || 'Lima'}* está en proceso de despacho.`;
    return `https://api.whatsapp.com/send?phone=51${tel}&text=${encodeURIComponent(msg)}`;
  };

  // Generadores oficiales de mensajes de WhatsApp para cierre de orden entregada
  const generarLinkWhatsAppEntregaCliente = (p) => {
    const tel = p.telefono_cliente.replace(/\D/g, '').replace(/^51/, '');
    const esLima = p.tipo_envio === 'lima_metropolitana' || p.courier === 'motorizado' || Boolean(p.distrito_lima);
    
    const msg = esLima
      ? [
          `¡Hola ${p.nombre_cliente}! 👋`,
          ``,
          `Te confirmamos que tu pedido tech mood (*${p.codigo_seguimiento}*) ya fue *ENTREGADO CON ÉXITO* en tu domicilio en *${p.distrito_lima}* (${p.direccion_entrega || ''}).`,
          ``,
          `🎉 ¡Esperamos que disfrutes tu compra! Muchas gracias por confiar en tech mood.`,
          `Si tienes alguna consulta, con gusto te atenderemos.`
        ].join('\n')
      : [
          `¡Hola ${p.nombre_cliente}! 👋`,
          ``,
          `Te confirmamos que tu pedido tech mood (*${p.codigo_seguimiento}*) con guía *${p.numero_guia || 'asignada'}* (${p.courier.toUpperCase()}) ya figura como *ENTREGADO CON ÉXITO* en la agencia *${p.agencia_nombre}*.`,
          ``,
          `🎉 ¡Esperamos que disfrutes tu compra! Muchas gracias por confiar en tech mood.`,
          `Si tienes alguna consulta, con gusto te atenderemos.`
        ].join('\n');

    return `https://api.whatsapp.com/send?phone=51${tel}&text=${encodeURIComponent(msg)}`;
  };

  const generarLinkWhatsAppEntregaAdmin = (p) => {
    const esLima = p.tipo_envio === 'lima_metropolitana' || p.courier === 'motorizado' || Boolean(p.distrito_lima);
    
    const msg = esLima
      ? [
          `✅ *[ENTREGA SATISFACTORIA CONFIRMADA - LIMA EXPRESS]*`,
          `----------------------------------------`,
          `• *Código tech mood:* ${p.codigo_seguimiento}`,
          `• *Cliente:* ${p.nombre_cliente} (Tel: ${p.telefono_cliente})`,
          `• *DNI:* ${p.dni_cliente}`,
          `• *Distrito:* ${p.distrito_lima}`,
          `• *Dirección:* ${p.direccion_entrega || ''}`,
          `• *Repartidor:* ${p.motorizado_asignado || 'tech mood Motorizado'}`,
          `• *Estado:* ENTREGADO (Orden Cerrada)`,
          `----------------------------------------`,
          `_tech mood Logistics Back-Office_`
        ].join('\n')
      : [
          `✅ *[ENTREGA SATISFACTORIA CONFIRMADA]*`,
          `----------------------------------------`,
          `• *Código tech mood:* ${p.codigo_seguimiento}`,
          `• *Cliente:* ${p.nombre_cliente} (Tel: ${p.telefono_cliente})`,
          `• *DNI:* ${p.dni_cliente}`,
          `• *Courier:* ${p.courier.toUpperCase()}`,
          `• *Guía Oficial:* ${p.numero_guia || 'Sin emitir'}`,
          `• *Agencia Recojo:* ${p.agencia_nombre}`,
          `• *Estado:* ENTREGADO (Orden Cerrada)`,
          `----------------------------------------`,
          `_tech mood Logistics Back-Office_`
        ].join('\n');

    return `https://api.whatsapp.com/send?phone=51986601895&text=${encodeURIComponent(msg)}`;
  };

  // Helper: Construye o devuelve la URL oficial directa para rastreo (sin formularios que llenar)
  const obtenerUrlRastreoDirecto = (p) => {
    // 1. Si tiene link_rastreo manual ingresado, se usa con prioridad absoluta
    if (p.link_rastreo && p.link_rastreo.trim() !== '') {
      return p.link_rastreo.trim();
    }

    // 2. Shalom: solo se utiliza el link manual generado desde Shalom Pro
    if (p.courier === 'shalom') {
      return null;
    }

    // 3. Olva Courier: link directo con parámetro de guía
    if (p.courier === 'olva' && p.numero_guia) {
      return `https://tracking.olvacourier.com/?q=${encodeURIComponent(p.numero_guia.trim())}`;
    }

    // 4. Urbano Express: link directo con parámetro de guía
    if (p.courier === 'urbano' && p.numero_guia) {
      return `https://www.urbanoexpress.com/tracking?guides=${encodeURIComponent(p.numero_guia.trim())}`;
    }

    return null;
  };

  // 1. Consulta oficial en 1 clic (Abre el portal oficial directo con la guía/código ya consultado)
  const consultarEnCourier = (p) => {
    const url = obtenerUrlRastreoDirecto(p);

    if (p.courier === 'shalom' && !url) {
      alert('Para rastrear este pedido en Shalom, primero ingresa el enlace de rastreo de Shalom Pro haciendo clic en Editar (ícono de lápiz).');
      abrirEdicion(p);
      return;
    }

    if (!url) {
      alert(`Para consultar el rastreo oficial de ${p.courier.toUpperCase()}, primero debes asignar un Número de Guía.`);
      abrirEdicion(p);
      return;
    }

    if (p.numero_guia) {
      navigator.clipboard.writeText(p.numero_guia);
    }

    window.open(url, '_blank', 'noopener,noreferrer');
    setToast(`🚀 Abriendo rastreo directo de ${p.courier.toUpperCase()}...`);
  };

  // Cambio rápido de estado
  const cambiarEstadoRapido = async (p, nuevoEstado) => {
    if (p.estado === 'entregado') {
      alert('Esta orden ya figura como ENTREGADA y está cerrada en el sistema.');
      return;
    }

    const esLima = p.tipo_envio === 'lima_metropolitana' || p.courier === 'motorizado' || Boolean(p.distrito_lima);
    const guiaTexto = p.numero_guia ? ` con guía ${p.numero_guia}` : '';
    const nuevoDetalle = 
      nuevoEstado === 'en_origen'
        ? `[Seguimiento ${p.courier.toUpperCase()}] Paquete admitido y recepcionado en agencia courier de origen (Lima)${guiaTexto}.`
        : nuevoEstado === 'en_transito' 
          ? (esLima
              ? `[Lima Express] ${p.motorizado_asignado || 'Motorizado tech mood'} en ruta hacia ${p.distrito_lima}`
              : `[Seguimiento ${p.courier.toUpperCase()}] Despachado y en tránsito nacional${guiaTexto}`)
          : nuevoEstado === 'en_agencia'
            ? `[Seguimiento ${p.courier.toUpperCase()}] Paquete disponible para recojo en agencia ${p.agencia_nombre}`
            : (esLima
                ? `[Lima Express] ENTREGADO con éxito en domicilio. Orden finalizada y cerrada.`
                : `[Seguimiento ${p.courier.toUpperCase()}] ENTREGADO con éxito en agencia. Orden finalizada y cerrada.`);

    const nuevoHistorial = [...(p.historial_estados || [])];
    nuevoHistorial.push({
      estado: nuevoEstado,
      fecha: new Date().toISOString(),
      detalle: nuevoDetalle
    });

    const res = await actualizarPedido(p.id, {
      estado: nuevoEstado,
      estado_detalle: nuevoDetalle,
      historial_estados: nuevoHistorial
    });

    if (res) {
      setPedidos((prev) =>
        prev.map((item) => (item.id === p.id ? { ...item, ...res } : item))
      );
      if (nuevoEstado === 'entregado') {
        setToast(`🎉 ¡${p.codigo_seguimiento} marcada como ENTREGADA! Orden cerrada. Usa los botones verdes para notificar por WhatsApp.`);
      } else {
        const nombreEstado = 
          nuevoEstado === 'en_origen' ? '3. En Origen (Agencia Lima)' :
          nuevoEstado === 'en_agencia' ? '5. En Agencia Destino' : 
          (esLima ? 'En Ruta' : '4. En Tránsito');
        setToast(`Estado de ${p.codigo_seguimiento} actualizado a: ${nombreEstado}`);
      }
    }
  };

  const solicitarEliminarPedido = (pedido) => {
    setPedidoParaEliminar(pedido);
  };

  const confirmarEliminarPedido = async () => {
    if (!pedidoParaEliminar) return;
    setEliminando(true);
    try {
      await eliminarPedido(pedidoParaEliminar.id);
      setPedidos((prev) => prev.filter((p) => p.id !== pedidoParaEliminar.id));
      setToast(`🗑️ Pedido ${pedidoParaEliminar.codigo_seguimiento} eliminado definitivamente.`);
      setPedidoParaEliminar(null);
    } catch (err) {
      console.error(err);
      alert('Error al eliminar el pedido.');
    } finally {
      setEliminando(false);
    }
  };

  // Métricas
  const total = pedidos.length;
  const totalLima = pedidos.filter((p) => p.tipo_envio === 'lima_metropolitana' || p.courier === 'motorizado' || p.distrito_lima).length;
  const totalProvincia = total - totalLima;
  const sinGuia = pedidos.filter((p) => (p.tipo_envio !== 'lima_metropolitana' && p.courier !== 'motorizado') && !p.numero_guia).length;
  const enTransito = pedidos.filter((p) => p.estado === 'en_transito').length;
  const entregados = pedidos.filter((p) => p.estado === 'entregado').length;

  // Órdenes Shalom pendientes de emisión de guía
  const shalomPendientes = pedidos.filter(
    (p) => p.courier === 'shalom' && (!p.numero_guia || p.numero_guia.trim() === '')
  );

  const handleExportarShalom = async () => {
    if (shalomPendientes.length === 0) {
      alert('No hay órdenes de Shalom pendientes de emisión de guía para exportar.');
      return;
    }
    setExportandoExcel(true);
    try {
      await descargarExcelMasivoShalom(shalomPendientes);
      setToast(`📥 Plantilla Excel descargada con ${shalomPendientes.length} órdenes de Shalom.`);
    } catch (err) {
      console.error(err);
      alert('Error generando la plantilla Excel: ' + err.message);
    } finally {
      setExportandoExcel(false);
    }
  };

  // Filtrado de lista según pestañas y controles
  const pedidosFiltrados = pedidos.filter((p) => {
    const esDeLima = p.tipo_envio === 'lima_metropolitana' || p.courier === 'motorizado' || Boolean(p.distrito_lima);

    // Filtro por pestaña activa
    if (tabActivo === 'provincia' && esDeLima) return false;
    if (tabActivo === 'lima' && !esDeLima) return false;

    // Filtro por estado
    if (filtroEstado !== 'todos') {
      if (filtroEstado === 'sin_guia' && (esDeLima || p.numero_guia)) return false;
      if (filtroEstado === 'asignado') {
        const esAsignado = p.estado === 'asignado' || (esDeLima && Boolean(p.motorizado_asignado) && p.estado !== 'en_transito' && p.estado !== 'entregado');
        if (!esAsignado) return false;
      } else if (filtroEstado === 'registrado') {
        const esRegistrado = p.estado === 'registrado' && (!esDeLima || !p.motorizado_asignado);
        if (!esRegistrado) return false;
      } else if (filtroEstado !== 'sin_guia' && p.estado !== filtroEstado) {
        return false;
      }
    }

    // Filtro por courier
    if (filtroCourier !== 'todos' && p.courier !== filtroCourier) return false;

    // Filtro por motorizado
    if (filtroMotorizadoTabla !== 'todos') {
      if (filtroMotorizadoTabla === 'sin_asignar' && p.motorizado_asignado) return false;
      if (filtroMotorizadoTabla !== 'sin_asignar' && p.motorizado_asignado !== filtroMotorizadoTabla) return false;
    }

    // Filtro por búsqueda
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      const matchCodigo = p.codigo_seguimiento.toLowerCase().includes(q);
      const matchCliente = p.nombre_cliente.toLowerCase().includes(q);
      const matchDni = p.dni_cliente.includes(q);
      const matchGuia = (p.numero_guia || '').toLowerCase().includes(q);
      const matchDistrito = (p.distrito_lima || '').toLowerCase().includes(q);
      if (!matchCodigo && !matchCliente && !matchDni && !matchGuia && !matchDistrito) return false;
    }
    return true;
  });

  // SI ESTÁ LOGUEADO CON ROL MOTORIZADO, MOSTRAR DIRECTAMENTE EL PORTAL DEL REPARTIDOR
  if (autenticado && rolUsuario === 'motorizado') {
    return (
      <MotorizadoDashboard 
        pedidos={pedidos}
        onActualizar={cargarListaPedidos}
        onCerrarSesion={handleLogout}
        motorizadoActivo={motorizadoLogueado}
      />
    );
  }

  // PANTALLA DE ACCESO POR CREDENCIALES (ADMIN / VENDEDOR / REPARTIDORES)
  if (!autenticado) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-16 animate-in fade-in duration-300">
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/10">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold text-white mb-1 tracking-tight">Acceso al Sistema TechMood</h3>
          <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
            Ingresa tus credenciales de Administrador, Coordinador o de Repartidor Motorizado.
          </p>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-[11px] font-semibold text-neutral-400 mb-1.5 uppercase tracking-wider">
                Contraseña o PIN de Acceso
              </label>
              <div className="relative">
                <input
                  type={mostrarPassword ? 'text' : 'password'}
                  maxLength={40}
                  value={pinIngresado}
                  onChange={(e) => {
                    setPinIngresado(e.target.value);
                    setErrorPin('');
                  }}
                  placeholder="**********"
                  className="w-full px-4 pr-12 py-3 bg-neutral-950 border border-neutral-700 rounded-xl text-white font-mono text-sm sm:text-base focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-inner"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword(!mostrarPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  title={mostrarPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {mostrarPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {errorPin && (
                <div className="mt-2.5 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errorPin}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              <Unlock className="w-4 h-4" />
              <span>Ingresar al Sistema</span>
            </button>
          </form>

          <p className="text-[11px] text-neutral-500 mt-6 pt-4 border-t border-neutral-800/80">
            🔒 Área interna restringida para personal autorizado de tech mood.
          </p>

        </div>
      </div>
    );
  }

  // SI SE SELECCIONA LA PESTAÑA DE ESTADÍSTICAS Y KPIS (EXCLUSIVO ADMIN)
  if (tabActivo === 'kpis' && rolUsuario === 'admin') {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Barra de regreso y navegación */}
        <div className="flex items-center justify-between pb-3 border-b border-amber-600/40">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTabActivo('todos')}
              className="px-3.5 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-xs font-semibold text-neutral-300 flex items-center gap-1.5"
            >
              <span>← Volver a Tabla de Pedidos</span>
            </button>
            <span className="text-sm font-bold text-white">Módulo Analítico</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={cargarListaPedidos}
              className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white"
              title="Refrescar datos"
            >
              <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-xl bg-red-900/30 border border-red-800 text-red-400 hover:bg-red-900/50 text-xs font-medium transition-colors cursor-pointer"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>

        <AnalyticsDashboard pedidos={pedidos} />
      </div>
    );
  }

  // SI SE SELECCIONA LA PESTAÑA DEL PORTAL REPARTIDOR DESDE EL ADMIN
  if (tabActivo === 'portal_repartidor') {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-amber-600/40">
          <button
            onClick={() => setTabActivo('todos')}
            className="px-3.5 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-xs font-semibold text-neutral-300 flex items-center gap-1.5"
          >
            <span>← Volver al Panel Admin Central</span>
          </button>
          <span className="text-xs text-neutral-400">Modo Repartidor</span>
        </div>
        <MotorizadoDashboard 
          pedidos={pedidos}
          onActualizar={cargarListaPedidos}
          onCerrarSesion={() => setTabActivo('todos')}
          motorizadoActivo="todos"
        />
      </div>
    );
  }

  // Opciones enriquecidas para filtro de Estados (sin números arbitrarios, con iconos y micro-badges)
  const opcionesFiltroEstado = [
    { value: 'todos', label: 'Todos los Estados', dotColor: 'bg-neutral-400' },
    { value: 'sin_guia', label: 'Pendientes de Guía', icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />, badge: 'Alerta', badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
    { value: 'registrado', label: 'Registrados', dotColor: 'bg-slate-400' },
    { value: 'asignado', label: 'Asignados (Motorizado)', icon: <Bike className="w-3.5 h-3.5 text-amber-400" /> },
    { value: 'en_preparacion', label: 'En Preparación (Almacén)', icon: <Package className="w-3.5 h-3.5 text-yellow-400" /> },
    { value: 'en_origen', label: 'En Origen (Agencia)', icon: <Building2 className="w-3.5 h-3.5 text-cyan-400" /> },
    { value: 'en_transito', label: 'En Tránsito / En Ruta', icon: <Truck className="w-3.5 h-3.5 text-blue-400" /> },
    { value: 'en_agencia', label: 'En Agencia Destino', icon: <MapPin className="w-3.5 h-3.5 text-purple-400" /> },
    { value: 'entregado', label: 'Entregados', icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />, badge: 'Completado', badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  ];

  // Opciones enriquecidas para filtro de Couriers (con colores corporativos)
  const opcionesFiltroCourier = [
    { value: 'todos', label: 'Todos los Couriers', dotColor: 'bg-neutral-400' },
    { value: 'shalom', label: 'Shalom Empresarial', dotColor: 'bg-red-500', badge: 'Provincia', badgeClass: 'bg-red-500/15 text-red-300 border-red-500/30' },
    { value: 'olva', label: 'Olva Courier', dotColor: 'bg-amber-400', badge: 'Provincia', badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
    { value: 'urbano', label: 'Urbano Express', dotColor: 'bg-purple-500', badge: 'Provincia', badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
    { value: 'motorizado', label: 'Motorizado Express', icon: <Bike className="w-3.5 h-3.5 text-teal-400" />, badge: 'Lima', badgeClass: 'bg-teal-500/15 text-teal-300 border-teal-500/30' },
  ];

  // Opciones enriquecidas para filtro de Motorizados
  const opcionesFiltroMotorizado = [
    { value: 'todos', label: 'Todos los Motorizados', dotColor: 'bg-neutral-400' },
    { value: 'Motorizado 1', label: 'Motorizado 1', icon: <Bike className="w-3.5 h-3.5 text-amber-400" /> },
    { value: 'Motorizado 2', label: 'Motorizado 2', icon: <Bike className="w-3.5 h-3.5 text-amber-400" /> },
    { value: 'sin_asignar', label: 'Sin Asignar', icon: <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />, badge: 'Pendiente', badgeClass: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30' },
  ];

  // PANTALLA PRINCIPAL DEL ADMIN DASHBOARD
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 animate-in fade-in duration-300">
      
      {/* Barra superior de estado */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-amber-600/40">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-white">Panel de Gestión Logística</h2>
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 ${
              rolUsuario === 'admin'
                ? 'bg-amber-500/15 border border-amber-500/40 text-amber-300'
                : 'bg-blue-500/15 border border-blue-500/30 text-blue-400'
            }`}>
              {rolUsuario === 'admin' ? '🛡️ Administrador' : '📋 Coordinador de Ventas'}
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Gestión integral de envíos nacionales (Shalom/Olva/Urbano) y entregas locales en Lima con motorizados.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Indicador de Estado de Supabase */}
          <div 
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 ${
              infoSupabase.estado === 'conectado'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : infoSupabase.estado === 'falta_tabla'
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                  : 'bg-neutral-800 border-neutral-700 text-neutral-400'
            }`}
            title={infoSupabase.mensaje}
          >
            <span className={`w-2 h-2 rounded-full ${
              infoSupabase.estado === 'conectado'
                ? 'bg-emerald-400 animate-pulse'
                : infoSupabase.estado === 'falta_tabla'
                  ? 'bg-amber-400'
                  : 'bg-neutral-500'
            }`} />
            <span>
              {infoSupabase.estado === 'conectado'
                ? `Supabase (${infoSupabase.count || pedidos.length} en nube)`
                : infoSupabase.estado === 'falta_tabla'
                  ? '⚠️ Falta crear tabla en Supabase'
                  : 'Modo Local'}
            </span>
          </div>

          <button
            onClick={cargarListaPedidos}
            disabled={cargando}
            className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
            title="Refrescar lista"
          >
            <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-xl bg-red-900/30 border border-red-800 text-red-400 hover:bg-red-900/50 text-xs font-medium transition-colors cursor-pointer"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* NAVEGACIÓN POR PESTAÑAS SEGMENTADAS (TODOS | PROVINCIA | LIMA | KPIS | PORTAL) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-neutral-950/80 border border-neutral-800 text-xs font-bold overflow-x-auto no-scrollbar w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setTabActivo('todos')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              tabActivo === 'todos'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-md'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Todos los Envíos ({total})</span>
          </button>

          <button
            type="button"
            onClick={() => setTabActivo('provincia')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              tabActivo === 'provincia'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Provincia / Agencias ({totalProvincia})</span>
          </button>

          <button
            type="button"
            onClick={() => setTabActivo('lima')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              tabActivo === 'lima'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <Bike className="w-3.5 h-3.5" />
            <span>Lima Metropolitana ({totalLima})</span>
          </button>
        </div>

        {/* Acceso a Módulos Especiales */}
        <div className="flex items-center gap-2">
          {rolUsuario === 'admin' && (
            <button
              type="button"
              onClick={() => setTabActivo('kpis')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-900 border border-amber-500/40 hover:border-amber-400 text-amber-300 font-bold text-xs transition-all shadow-sm"
            >
              <BarChart3 className="w-4 h-4 text-amber-400" />
              <span>Estadísticas & KPIs</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setTabActivo('portal_repartidor')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-900 border border-neutral-700 hover:border-neutral-500 text-neutral-300 hover:text-white font-bold text-xs transition-all"
          >
            <Bike className="w-4 h-4 text-blue-400" />
            <span>Vista Repartidor</span>
          </button>
        </div>
      </div>

      {/* METRICAS / KPIS RÁPIDOS (INTERACTIVOS CON FILTRADO EN 1 CLIC) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        
        {/* 1. Total Órdenes */}
        <div
          onClick={() => setFiltroEstado('todos')}
          className={`col-span-2 sm:col-span-1 group relative p-4 rounded-2xl border transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-lg backdrop-blur-sm select-none bg-gradient-to-br from-neutral-800/40 via-neutral-900/80 to-neutral-950 ${
            filtroEstado === 'todos' && tabActivo === 'todos'
              ? 'border-neutral-500 ring-2 ring-neutral-400/30 shadow-md shadow-neutral-900/50'
              : 'border-neutral-800 hover:border-neutral-700'
          }`}
          title="Ver todos los envíos (restablecer filtro)"
        >
          <div className="flex items-center justify-between pb-2">
            <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-bold block truncate">
              {tabActivo === 'lima' ? 'Envíos Lima' : tabActivo === 'provincia' ? 'Envíos Provincia' : 'Total Órdenes'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-neutral-800/80 border border-neutral-700/60 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Package className="w-4 h-4 text-neutral-300" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {tabActivo === 'lima' ? totalLima : tabActivo === 'provincia' ? totalProvincia : total}
          </p>
          <p className="text-[10px] text-neutral-500 font-medium mt-1 truncate">
            Órdenes en gestión activa
          </p>
        </div>

        {/* 2. Por Emitir Guía */}
        <div
          onClick={() => setFiltroEstado(filtroEstado === 'sin_guia' ? 'todos' : 'sin_guia')}
          className={`group relative p-4 rounded-2xl border transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-lg backdrop-blur-sm select-none bg-gradient-to-br from-amber-500/10 via-neutral-900/80 to-neutral-950 ${
            filtroEstado === 'sin_guia'
              ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-lg shadow-amber-500/20'
              : 'border-amber-500/30 hover:border-amber-400/60 hover:shadow-amber-500/10'
          }`}
          title="Filtrar pedidos pendientes de guía"
        >
          <div className="flex items-center justify-between pb-2">
            <span className="text-[11px] uppercase tracking-wider text-amber-400 font-bold block truncate">
              Por Emitir Guía
            </span>
            <div className="relative w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              {sinGuia > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              )}
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight">
            {sinGuia}
          </p>
          <p className="text-[10px] text-amber-500/80 font-medium mt-1 truncate">
            {sinGuia === 0 ? 'Al día sin demoras ✓' : 'Requiere emitir guía'}
          </p>
        </div>

        {/* 3. En Ruta / Tránsito */}
        <div
          onClick={() => setFiltroEstado(filtroEstado === 'en_transito' ? 'todos' : 'en_transito')}
          className={`group relative p-4 rounded-2xl border transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-lg backdrop-blur-sm select-none bg-gradient-to-br from-blue-500/10 via-neutral-900/80 to-neutral-950 ${
            filtroEstado === 'en_transito'
              ? 'border-blue-400 ring-2 ring-blue-400/40 shadow-lg shadow-blue-500/20'
              : 'border-blue-500/25 hover:border-blue-400/60 hover:shadow-blue-500/10'
          }`}
          title="Filtrar pedidos en tránsito / ruta"
        >
          <div className="flex items-center justify-between pb-2">
            <span className="text-[10px] xs:text-[11px] uppercase tracking-wider text-blue-400 font-bold block truncate">
              En Ruta / Tránsito
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Truck className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-blue-400 tracking-tight">
            {enTransito}
          </p>
          <p className="text-[10px] text-blue-400/70 font-medium mt-1 truncate">
            Despachos en movimiento
          </p>
        </div>

        {/* 4. Reparto Lima */}
        <div
          onClick={() => setTabActivo(tabActivo === 'lima' ? 'todos' : 'lima')}
          className={`group relative p-4 rounded-2xl border transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-lg backdrop-blur-sm select-none bg-gradient-to-br from-teal-500/10 via-neutral-900/80 to-neutral-950 ${
            tabActivo === 'lima'
              ? 'border-teal-400 ring-2 ring-teal-400/40 shadow-lg shadow-teal-500/20'
              : 'border-teal-500/25 hover:border-teal-400/60 hover:shadow-teal-500/10'
          }`}
          title="Filtrar vista exclusiva de Lima Metropolitana"
        >
          <div className="flex items-center justify-between pb-2">
            <span className="text-[11px] uppercase tracking-wider text-teal-400 font-bold block truncate">
              Reparto Lima
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Bike className="w-4 h-4 text-teal-400" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-teal-300 tracking-tight">
            {totalLima}
          </p>
          <p className="text-[10px] text-teal-400/70 font-medium mt-1 truncate">
            Motorizados M1 / M2
          </p>
        </div>

        {/* 5. Entregados */}
        <div
          onClick={() => setFiltroEstado(filtroEstado === 'entregado' ? 'todos' : 'entregado')}
          className={`group relative p-4 rounded-2xl border transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-lg backdrop-blur-sm select-none bg-gradient-to-br from-emerald-500/10 via-neutral-900/80 to-neutral-950 ${
            filtroEstado === 'entregado'
              ? 'border-emerald-400 ring-2 ring-emerald-400/40 shadow-lg shadow-emerald-500/20'
              : 'border-emerald-500/25 hover:border-emerald-400/60 hover:shadow-emerald-500/10'
          }`}
          title="Filtrar pedidos entregados y cerrados"
        >
          <div className="flex items-center justify-between pb-2">
            <span className="text-[11px] uppercase tracking-wider text-emerald-400 font-bold block truncate">
              Entregados
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight">
            {entregados}
          </p>
          <p className="text-[10px] text-emerald-400/70 font-medium mt-1 truncate">
            {total > 0 ? `${Math.round((entregados / total) * 100)}% de efectividad` : '0% completado'}
          </p>
        </div>

      </div>

      {/* FILTROS Y BÚSQUEDA */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800 relative z-30">
        
        {/* Buscador */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por código TM, cliente, DNI, distrito o N° de Guía..."
            className="w-full pl-10 pr-4 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Filtros rápidos: Cuadrícula 2x2 en móvil y flex horizontal en escritorio */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 text-xs relative z-30 w-full sm:w-auto">
          <CustomSelect
            value={filtroEstado}
            onChange={setFiltroEstado}
            options={opcionesFiltroEstado}
            placeholder="Todos los Estados"
            className="w-full sm:w-auto"
          />

          {/* Filtro por Courier (si no está en vista exclusiva de Lima) */}
          {tabActivo !== 'lima' && (
            <CustomSelect
              value={filtroCourier}
              onChange={setFiltroCourier}
              options={opcionesFiltroCourier}
              placeholder="Todos los Couriers"
              className="w-full sm:w-auto"
            />
          )}

          {/* Filtro por Motorizado (si está en vista de Lima o Todos) */}
          {tabActivo !== 'provincia' && (
            <CustomSelect
              value={filtroMotorizadoTabla}
              onChange={setFiltroMotorizadoTabla}
              options={opcionesFiltroMotorizado}
              placeholder="Todos los Motorizados"
              className="w-full sm:w-auto"
            />
          )}

          {/* Botón Descarga Carga Masiva Shalom Pro */}
          {tabActivo !== 'lima' && (
            <button
              type="button"
              onClick={handleExportarShalom}
              disabled={exportandoExcel || shalomPendientes.length === 0}
              className={`px-3 py-2 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap col-span-2 sm:col-auto w-full sm:w-auto ${
                shalomPendientes.length > 0
                  ? 'bg-gradient-to-r from-teal-500/20 to-emerald-500/20 border-green-500/40 hover:border-green-400 text-green-300 hover:text-white shadow-sm shadow-green-500/10'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-500 cursor-not-allowed opacity-60'
              }`}
              title={
                shalomPendientes.length > 0
                  ? `Exportar ${shalomPendientes.length} órdenes de Shalom a la plantilla Excel de Shalom Pro`
                  : 'No hay órdenes de Shalom pendientes de emisión de guía'
              }
            >
              <FileSpreadsheet className="w-4 h-4 text-green-400 shrink-0" />
              <span className="truncate">
                {exportandoExcel 
                  ? 'Generando...' 
                  : `Masivo Shalom (${shalomPendientes.length})`}
              </span>
            </button>
          )}
        </div>

      </div>

      {/* TABLA DE ÓRDENES (VISTA ESCRITORIO) */}
      <div className="hidden md:block bg-neutral-900/80 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-950/80 text-neutral-400 uppercase tracking-wider font-semibold border-b border-neutral-800">
              <tr className="text-center">
                <th className="py-3.5 px-4">Código / Fecha</th>
                <th className="py-3.5 px-4">Cliente / DNI</th>
                <th className="py-3.5 px-4">Modalidad</th>
                <th className="py-3.5 px-4">Destino / Dirección</th>
                <th className="py-3.5 px-4">Asignación / Guía</th>
                <th className="py-3.5 px-4">Estado</th>
                <th className="py-3.5 px-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/80">
              {pedidosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-500">
                    No se encontraron órdenes con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                pedidosFiltrados.map((p) => {
                  const esLima = p.tipo_envio === 'lima_metropolitana' || p.courier === 'motorizado' || Boolean(p.distrito_lima);

                  return (
                    <tr key={p.id} className="hover:bg-neutral-800/30 transition-colors">
                      
                      {/* Código / Fecha */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono font-bold text-amber-400">{p.codigo_seguimiento}</div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">
                          Reg: {new Date(p.creado_en).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {p.fecha_prevista && (
                          <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                            Prev: {p.fecha_prevista}
                          </div>
                        )}
                        {p.fecha_entregado && (
                          <div className="text-[10px] text-emerald-400 font-mono font-medium mt-0.5 flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            {new Date(p.fecha_entregado).toLocaleDateString('es-PE', {
                              day: '2-digit', month: '2-digit',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </div>
                        )}
                      </td>

                      {/* Cliente / DNI */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white">{p.nombre_cliente}</div>
                        <div className="text-[11px] text-neutral-400 flex items-center gap-2 mt-0.5">
                          <span>DNI: {p.dni_cliente}</span>
                          <span>•</span>
                          <span>Tel: {p.telefono_cliente}</span>
                        </div>
                      </td>

                      {/* Modalidad: Provincia vs Lima */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {esLima ? (
                          <span className="px-2.5 py-1 rounded-lg border font-bold text-[11px] uppercase bg-cyan-500/15 text-cyan-400 border-cyan-500/30 flex items-center gap-1 w-fit">
                            <Bike className="w-3 h-3" />
                            <span>Lima Express</span>
                          </span>
                        ) : (
                          <span className={`px-2.5 py-1 rounded-lg border font-bold text-[11px] uppercase ${
                            p.courier === 'shalom'
                              ? 'bg-red-500/15 text-red-400 border-red-500/30'
                              : p.courier === 'olva'
                                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                : 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                          }`}>
                            {p.courier}
                          </span>
                        )}
                      </td>

                      {/* Destino / Dirección */}
                      <td className="py-3.5 px-4 max-w-[220px]">
                        {esLima ? (
                          <div>
                            <div className="font-bold text-white truncate flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-red-400 shrink-0" />
                              <span>{p.distrito_lima || 'Lima Metropolitana'}</span>
                            </div>
                            <div className="text-[11px] text-neutral-400" title={p.direccion_entrega}>
                              {p.direccion_entrega || p.agencia_direccion}
                            </div>
                            {p.referencia_entrega && (
                              <div className="text-[10px] text-neutral-500 truncate italic">
                                Ref: {p.referencia_entrega}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="font-semibold text-neutral-200 flex items-center gap-1" title={p.agencia_nombre}>
                              <MapPin className="w-3 h-3 text-red-400 shrink-0" />
                              <span>{p.agencia_nombre}</span>
                            </div>
                            <div className="text-[11px] text-neutral-500 truncate" title={p.agencia_direccion}>
                              {p.agencia_direccion}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Asignación (Motorizado) o Guía Courier */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {esLima ? (
                          <div className="space-y-1">
                            {/* Selector rápido de Motorizado */}
                            <select
                              value={p.motorizado_asignado || 'sin_asignar'}
                              onChange={(e) => asignarMotorizadoRapido(p, e.target.value)}
                              disabled={p.estado === 'entregado'}
                              className={`bg-neutral-950 border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${
                                p.estado === 'entregado'
                                  ? 'border-neutral-800 text-neutral-400 cursor-not-allowed opacity-75'
                                  : 'border-neutral-700 text-amber-300 focus:border-amber-500'
                              }`}
                              title={p.estado === 'entregado' ? 'Orden entregada y cerrada (motorizado fijado)' : 'Asignar motorizado'}
                            >
                              <option value="sin_asignar">⚠️ Sin Asignar</option>
                              <option value="Motorizado 1">🛵 Motorizado 1</option>
                              <option value="Motorizado 2">🛵 Motorizado 2</option>
                            </select>

                            {/* Enlaces rápidos: Maps y WhatsApp */}
                            <div className="flex items-center gap-1.5 pt-0.5">
                              <a
                                href={obtenerUrlGoogleMaps(p)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 font-medium"
                                title="Ver en Google Maps"
                              >
                                <Navigation className="w-2.5 h-2.5" />
                                <span>Maps</span>
                              </a>
                              <span className="text-neutral-600">•</span>
                              {p.estado === 'entregado' ? (
                                <span
                                  className="text-[10px] text-neutral-500 cursor-not-allowed flex items-center gap-0.5 font-medium opacity-60"
                                  title="WhatsApp de despacho desactivado (pedido ya entregado)"
                                >
                                  <span>WhatsApp</span>
                                </span>
                              ) : (
                                <a
                                  href={obtenerUrlWhatsAppCliente(p)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 font-medium"
                                  title="Escribir WhatsApp a cliente"
                                >
                                  <span>WhatsApp</span>
                                </a>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div>
                            {p.numero_guia ? (
                              <div>
                                <span className="font-mono font-bold text-white">{p.numero_guia}</span>
                                {p.codigo_seguridad && (
                                  <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[10px]">
                                    Clave: {p.codigo_seguridad}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-amber-400/90 italic font-medium flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Sin emitir</span>
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {(() => {
                          const badge = obtenerBadgeEstado(p, esLima);
                          return (
                            <span className={`px-2.5 py-1 rounded-full text-[11px] ${badge.clase}`}>
                              {badge.texto}
                            </span>
                          );
                        })()}
                        
                        {/* Indicador de Foto de Entrega */}
                        {p.foto_entrega && (
                          <div className="mt-1">
                            <button
                              type="button"
                              onClick={() => setFotoParaVer(p.foto_entrega)}
                              className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Camera className="w-3 h-3" />
                              <span>Ver Evidencia</span>
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 justify-center">
                          {p.estado === 'entregado' ? (
                            <>
                              {/* Botón WhatsApp Aviso Cliente */}
                              {avisosEnviados[p.id]?.cliente ? (
                                <span
                                  className="p-1.5 px-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 text-xs font-semibold inline-flex items-center gap-1 cursor-not-allowed opacity-80"
                                  title="Aviso de entrega ya enviado al cliente"
                                >
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>✔️ Aviso Enviado</span>
                                </span>
                              ) : (
                                <a
                                  href={generarLinkWhatsAppEntregaCliente(p)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => registrarAvisoEnviado(p.id, 'cliente')}
                                  className="p-1.5 px-2 rounded-lg bg-[#25D366]/20 border border-[#25D366]/40 hover:bg-[#25D366]/30 text-[#25D366] text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 shadow-sm"
                                  title="Enviar confirmación de entrega al cliente por WhatsApp"
                                >
                                  <MessageCircle className="w-3.5 h-3.5 fill-[#25D366]" />
                                  <span>Aviso Cliente</span>
                                </a>
                              )}

                              {/* Botón WhatsApp Aviso Admin */}
                              {avisosEnviados[p.id]?.admin ? (
                                <span
                                  className="p-1.5 px-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 text-xs font-semibold inline-flex items-center gap-1 cursor-not-allowed opacity-80"
                                  title="Reporte de entrega ya enviado a tech mood Admin"
                                >
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>✔️ Admin Avisado</span>
                                </span>
                              ) : (
                                <a
                                  href={generarLinkWhatsAppEntregaAdmin(p)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => registrarAvisoEnviado(p.id, 'admin')}
                                  className="p-1.5 px-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 shadow-sm"
                                  title="Enviar reporte de entrega completada a tech mood Admin"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Aviso Admin</span>
                                </a>
                              )}

                              {/* Botón 1-Clic: Rastrear en portal oficial del courier */}
                              {!esLima && (
                                <button
                                  type="button"
                                  onClick={() => consultarEnCourier(p)}
                                  className="p-1.5 px-2 rounded-lg bg-blue-500/15 border border-blue-500/30 hover:bg-blue-500/25 text-blue-300 text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1"
                                  title="Consultar rastreo oficial del courier"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>Rastrear</span>
                                </button>
                              )}

                              {/* Ver detalles / Rastreador (Disponible en orden cerrada) */}
                              {onVerRastreo && (
                                <button
                                  type="button"
                                  onClick={() => onVerRastreo(p.codigo_seguimiento)}
                                  className="p-1.5 rounded-lg bg-neutral-800 border border-neutral-700 hover:border-amber-500 text-amber-400 transition-colors cursor-pointer"
                                  title="Ver detalles de la orden"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Eliminar orden entregada (Sin botón editar por estar cerrada) */}
                              <button
                                type="button"
                                onClick={() => solicitarEliminarPedido(p)}
                                className="p-1.5 rounded-lg bg-neutral-800 border border-neutral-700 hover:border-red-500 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                                title="Eliminar orden entregada"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              {/* Botón 1-Clic: Rastrear en portal oficial del courier */}
                              {/* Visible a partir de EN ORIGEN (cuando ya se dejó en agencia origen y la guía/link está activa) */}
                              {!esLima && (p.estado === 'en_origen' || p.estado === 'en_transito' || p.estado === 'en_agencia') && (
                                <button
                                  type="button"
                                  onClick={() => consultarEnCourier(p)}
                                  className="p-1.5 px-2 rounded-lg bg-blue-500/15 border border-blue-500/30 hover:bg-blue-500/25 text-blue-300 text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1"
                                  title={
                                    p.courier === 'shalom'
                                      ? (p.link_rastreo ? 'Abrir rastreo directo de Shalom Pro' : 'Configurar link de Shalom Pro para rastrear')
                                      : (p.numero_guia ? `Abrir rastreo directo de ${p.courier.toUpperCase()} con guía ${p.numero_guia}` : `Asignar guía de ${p.courier.toUpperCase()} para rastrear`)
                                  }
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>Rastrear</span>
                                </button>
                              )}

                              {/* SECUENCIA LIMA METROPOLITANA */}
                              {esLima && (p.estado === 'asignado' || p.estado === 'en_preparacion' || (p.estado === 'registrado' && p.motorizado_asignado)) && (
                                <button
                                  type="button"
                                  onClick={() => cambiarEstadoRapido(p, 'en_transito')}
                                  className="p-1.5 px-2 rounded-lg bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 text-amber-300 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                                  title="Poner en Ruta de Reparto"
                                >
                                  <Bike className="w-3.5 h-3.5" />
                                  <span>A Ruta</span>
                                </button>
                              )}

                              {esLima && p.estado === 'en_transito' && (
                                <button
                                  type="button"
                                  onClick={() => cambiarEstadoRapido(p, 'entregado')}
                                  className="p-1.5 px-2 rounded-lg bg-emerald-500/25 border border-emerald-500/50 hover:bg-emerald-500/35 text-emerald-300 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 shadow-sm shadow-emerald-500/10"
                                  title="Marcar como Entregado en Domicilio"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Entregar</span>
                                </button>
                              )}

                              {/* SECUENCIA PROVINCIA (COURIERS: SHALOM / OLVA / URBANO) */}
                              {/* 1. REGISTRADO: No tiene botón rápido. Se requiere presionar Editar para asignar Guía y Clave. */}

                              {/* 2. PREPARACIÓN -> A ORIGEN (Cuando se deja paquete en agencia courier origen en Lima) */}
                              {!esLima && p.estado === 'en_preparacion' && (
                                <button
                                  type="button"
                                  onClick={() => cambiarEstadoRapido(p, 'en_origen')}
                                  className="p-1.5 px-2 rounded-lg bg-cyan-500/15 border border-cyan-500/35 hover:bg-cyan-500/25 text-cyan-300 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 shadow-sm shadow-cyan-500/10"
                                  title="Marcar como Dejado y Admitido en Agencia Courier de Origen"
                                >
                                  <Building2 className="w-3.5 h-3.5" />
                                  <span>A Origen</span>
                                </button>
                              )}

                              {/* 3. EN ORIGEN -> A TRÁNSITO (Courier despacha paquete en camión hacia destino) */}
                              {!esLima && p.estado === 'en_origen' && (
                                <button
                                  type="button"
                                  onClick={() => cambiarEstadoRapido(p, 'en_transito')}
                                  className="p-1.5 px-2 rounded-lg bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 text-amber-300 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                                  title="Marcar como Despachado en Tránsito Nacional"
                                >
                                  <Truck className="w-3.5 h-3.5" />
                                  <span>A Tránsito</span>
                                </button>
                              )}

                              {/* 4. EN TRÁNSITO -> EN AGENCIA DESTINO (Arriba a agencia destino lista para recojo) */}
                              {!esLima && p.estado === 'en_transito' && (
                                <button
                                  type="button"
                                  onClick={() => cambiarEstadoRapido(p, 'en_agencia')}
                                  className="p-1.5 px-2 rounded-lg bg-purple-500/20 border border-purple-500/40 hover:bg-purple-500/30 text-purple-300 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                                  title="Marcar como Disponible en Agencia de Destino"
                                >
                                  <Building2 className="w-3.5 h-3.5" />
                                  <span>En Agencia</span>
                                </button>
                              )}

                              {/* 5. EN AGENCIA -> ENTREGAR (Cliente retira con DNI / Cierra orden) */}
                              {!esLima && p.estado === 'en_agencia' && (
                                <button
                                  type="button"
                                  onClick={() => cambiarEstadoRapido(p, 'entregado')}
                                  className="p-1.5 px-2.5 rounded-lg bg-emerald-500/25 border border-emerald-500/50 hover:bg-emerald-500/35 text-emerald-300 text-xs font-bold transition-all shadow-sm shadow-emerald-500/10 cursor-pointer inline-flex items-center gap-1"
                                  title="Marcar como Entregado con Éxito (Cierra la orden)"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Entregar</span>
                                </button>
                              )}

                              {/* Botón Asignar / Editar */}
                              <button
                                type="button"
                                onClick={() => abrirEdicion(p)}
                                className="p-1.5 rounded-lg bg-neutral-800 border border-neutral-700 hover:border-neutral-500 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                                title="Editar Orden o Asignación"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {/* Ver en vista cliente */}
                              {onVerRastreo && (
                                <button
                                  type="button"
                                  onClick={() => onVerRastreo(p.codigo_seguimiento)}
                                  className="p-1.5 rounded-lg bg-neutral-800 border border-neutral-700 hover:border-amber-500 text-amber-400 transition-colors cursor-pointer"
                                  title="Ver en rastreador de cliente"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Eliminar */}
                              <button
                                type="button"
                                onClick={() => solicitarEliminarPedido(p)}
                                className="p-1.5 rounded-lg bg-neutral-800 border border-neutral-700 hover:border-red-500 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                                title="Eliminar orden"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* LISTA DE TARJETAS DE PEDIDO (VISTA MÓVIL OPTIMIZADA) */}
      <div className="block md:hidden space-y-3">
        {pedidosFiltrados.length === 0 ? (
          <div className="p-8 rounded-2xl bg-neutral-900/60 border border-neutral-800 text-center text-neutral-500 text-xs">
            No se encontraron órdenes con los filtros seleccionados.
          </div>
        ) : (
          pedidosFiltrados.map((p) => {
            const esLima = p.tipo_envio === 'lima_metropolitana' || p.courier === 'motorizado' || Boolean(p.distrito_lima);
            const badge = obtenerBadgeEstado(p, esLima);
            const estaEntregado = p.estado === 'entregado';

            return (
              <div
                key={`mobile-${p.id}`}
                className="p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800 shadow-xl space-y-3"
              >
                {/* 1. Cabecera de la tarjeta: Código, Modalidad y Estado */}
                <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-neutral-800/80">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-black text-sm text-amber-400">
                        {p.codigo_seguimiento}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (navigator.clipboard) {
                            navigator.clipboard.writeText(p.codigo_seguimiento);
                            setToast(`Código ${p.codigo_seguimiento} copiado`);
                          }
                        }}
                        className="p-1 rounded text-neutral-500 hover:text-white transition-colors"
                        title="Copiar código"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-[10px] text-neutral-500 block mt-0.5">
                      Reg: {new Date(p.creado_en).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badge.clase}`}>
                      {badge.texto}
                    </span>
                    {esLima ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                        <Bike className="w-2.5 h-2.5" /> Lima Express
                      </span>
                    ) : (
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${
                        p.courier === 'shalom'
                          ? 'bg-red-500/15 text-red-300 border-red-500/30'
                          : p.courier === 'olva'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                      }`}>
                        {p.courier}
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. Cliente y Destino */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-neutral-500 uppercase font-bold block">Cliente</span>
                    <span className="font-bold text-white block truncate">{p.nombre_cliente}</span>
                    <div className="text-[11px] text-neutral-400 mt-0.5">
                      <span>DNI: {p.dni_cliente}</span>
                      <span className="block text-neutral-400">Tel: {p.telefono_cliente}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-neutral-500 uppercase font-bold block">Destino</span>
                    <div className="flex items-center gap-1 text-white font-semibold truncate">
                      <MapPin className="w-3 h-3 text-red-400 shrink-0" />
                      <span className="truncate">{esLima ? p.distrito_lima || 'Lima' : p.agencia_nombre}</span>
                    </div>
                    <span className="text-[10px] text-neutral-400 block truncate" title={esLima ? p.direccion_entrega : p.agencia_direccion}>
                      {esLima ? p.direccion_entrega || 'Sin dirección' : p.agencia_direccion}
                    </span>
                  </div>
                </div>

                {/* 3. Asignación (Motorizado o Guía Courier) */}
                <div className="p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800/80 flex items-center justify-between text-xs">
                  {esLima ? (
                    <div className="flex items-center justify-between w-full gap-2">
                      <span className="text-[11px] text-neutral-400 font-semibold">Motorizado:</span>
                      <select
                        value={p.motorizado_asignado || 'sin_asignar'}
                        onChange={(e) => asignarMotorizadoRapido(p, e.target.value)}
                        disabled={estaEntregado}
                        className={`bg-neutral-900 border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${
                          estaEntregado
                            ? 'border-neutral-800 text-neutral-400 cursor-not-allowed opacity-75'
                            : 'border-neutral-700 text-amber-300 focus:border-amber-500'
                        }`}
                      >
                        <option value="sin_asignar">⚠️ Sin Asignar</option>
                        <option value="Motorizado 1">🛵 Motorizado 1</option>
                        <option value="Motorizado 2">🛵 Motorizado 2</option>
                      </select>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[11px] text-neutral-400 font-semibold">Guía Oficial:</span>
                      {p.numero_guia ? (
                        <div className="flex items-center gap-1.5 font-mono font-bold text-white text-xs">
                          <span>{p.numero_guia}</span>
                          {p.codigo_seguridad && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px]">
                              Clave: {p.codigo_seguridad}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-amber-400 italic font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Sin emitir
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Evidencia fotográfica si existe */}
                {p.foto_entrega && (
                  <div className="pt-0.5">
                    <button
                      type="button"
                      onClick={() => setFotoParaVer(p.foto_entrega)}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Ver Foto de Entrega (Evidencia)</span>
                    </button>
                  </div>
                )}

                {/* 4. Barra de Acciones Táctiles */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-1.5 border-t border-neutral-800/60">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Botón WhatsApp Cliente */}
                    {estaEntregado ? (
                      avisosEnviados[p.id]?.cliente ? (
                        <span className="px-2 py-1 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 text-[11px] font-semibold inline-flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Aviso Enviado</span>
                        </span>
                      ) : (
                        <a
                          href={generarLinkWhatsAppEntregaCliente(p)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => registrarAvisoEnviado(p.id, 'cliente')}
                          className="px-2 py-1 rounded-xl bg-[#25D366]/20 border border-[#25D366]/40 text-[#25D366] text-[11px] font-bold inline-flex items-center gap-1"
                        >
                          <MessageCircle className="w-3 h-3 fill-[#25D366]" />
                          <span>Aviso Cliente</span>
                        </a>
                      )
                    ) : (
                      <a
                        href={obtenerUrlWhatsAppCliente(p)}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1"
                      >
                        <MessageCircle className="w-3 h-3" /> WhatsApp
                      </a>
                    )}

                    {/* Google Maps si es Lima */}
                    {esLima && (
                      <a
                        href={obtenerUrlGoogleMaps(p)}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[11px] font-semibold flex items-center gap-1"
                      >
                        <Navigation className="w-3 h-3" /> Maps
                      </a>
                    )}

                    {/* Rastrear Courier si es Provincia */}
                    {!esLima && p.numero_guia && (
                      <button
                        type="button"
                        onClick={() => consultarEnCourier(p)}
                        className="px-2 py-1 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[11px] font-semibold flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" /> Rastrear
                      </button>
                    )}
                  </div>

                  {/* Acciones de Flujo (Avanzar estado, Editar, Ver, Eliminar) */}
                  <div className="flex items-center gap-1">
                    {!estaEntregado && (
                      <>
                        {/* Botones de Secuencia de Estado */}
                        {esLima && (p.estado === 'asignado' || p.estado === 'en_preparacion' || (p.estado === 'registrado' && p.motorizado_asignado)) && (
                          <button
                            type="button"
                            onClick={() => cambiarEstadoRapido(p, 'en_transito')}
                            className="px-2 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold flex items-center gap-1"
                          >
                            <Bike className="w-3 h-3" /> A Ruta
                          </button>
                        )}

                        {esLima && p.estado === 'en_transito' && (
                          <button
                            type="button"
                            onClick={() => cambiarEstadoRapido(p, 'entregado')}
                            className="px-2 py-1 rounded-xl bg-emerald-500/25 border border-emerald-500/50 text-emerald-300 text-[11px] font-bold flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Entregar
                          </button>
                        )}

                        {!esLima && p.estado === 'en_preparacion' && (
                          <button
                            type="button"
                            onClick={() => cambiarEstadoRapido(p, 'en_origen')}
                            className="px-2 py-1 rounded-xl bg-cyan-500/15 border border-cyan-500/35 text-cyan-300 text-[11px] font-bold flex items-center gap-1"
                          >
                            <Building2 className="w-3 h-3" /> A Origen
                          </button>
                        )}

                        {!esLima && p.estado === 'en_origen' && (
                          <button
                            type="button"
                            onClick={() => cambiarEstadoRapido(p, 'en_transito')}
                            className="px-2 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold flex items-center gap-1"
                          >
                            <Truck className="w-3 h-3" /> A Tránsito
                          </button>
                        )}

                        {!esLima && p.estado === 'en_transito' && (
                          <button
                            type="button"
                            onClick={() => cambiarEstadoRapido(p, 'en_agencia')}
                            className="px-2 py-1 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[11px] font-bold flex items-center gap-1"
                          >
                            <Building2 className="w-3 h-3" /> En Agencia
                          </button>
                        )}

                        {!esLima && p.estado === 'en_agencia' && (
                          <button
                            type="button"
                            onClick={() => cambiarEstadoRapido(p, 'entregado')}
                            className="px-2 py-1 rounded-xl bg-emerald-500/25 border border-emerald-500/50 text-emerald-300 text-[11px] font-bold flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Entregar
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => abrirEdicion(p)}
                          className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700"
                          title="Editar"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}

                    {onVerRastreo && (
                      <button
                        type="button"
                        onClick={() => onVerRastreo(p.codigo_seguimiento)}
                        className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-amber-400 border border-neutral-700"
                        title="Ver detalles"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => solicitarEliminarPedido(p)}
                      className="p-1.5 rounded-xl bg-neutral-800 hover:bg-red-950/60 text-neutral-400 hover:text-red-400 border border-neutral-700 hover:border-red-500"
                      title="Eliminar pedido"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* MODAL DE EDICIÓN DE ORDEN */}
      {pedidoEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative my-auto max-h-[92vh] flex flex-col">
            
            <div className="flex items-center justify-between pb-3.5 border-b border-neutral-800 shrink-0">
              <div>
                <h3 className="text-base font-bold text-white">
                  Editar Orden {pedidoEditando.codigo_seguimiento}
                </h3>
                <p className="text-xs text-neutral-400">
                  Cliente: {pedidoEditando.nombre_cliente} • Modalidad: {pedidoEditando.tipo_envio === 'lima_metropolitana' ? 'Lima Express' : pedidoEditando.courier.toUpperCase()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPedidoEditando(null)}
                className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGuardarEdicion} className="space-y-4 mt-4 text-xs overflow-y-auto pr-1 flex-1">
              
              {/* Si es de Lima Metropolitana, mostrar campos de asignación y dirección */}
              {pedidoEditando.tipo_envio === 'lima_metropolitana' || pedidoEditando.courier === 'motorizado' ? (
                <>
                  <div>
                    <label className="block font-semibold text-amber-400 mb-1.5">
                      Motorizado Asignado:
                    </label>
                    <select
                      value={formEdicion.motorizado_asignado}
                      onChange={(e) => setFormEdicion({ ...formEdicion, motorizado_asignado: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-amber-500"
                    >
                      <option value="">Sin Asignar</option>
                      <option value="Motorizado 1">Motorizado 1</option>
                      <option value="Motorizado 2">Motorizado 2</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-300 mb-1.5">
                      Distrito de Lima:
                    </label>
                    <input
                      type="text"
                      value={formEdicion.distrito_lima}
                      onChange={(e) => setFormEdicion({ ...formEdicion, distrito_lima: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-300 mb-1.5">
                      Dirección Exacta:
                    </label>
                    <input
                      type="text"
                      value={formEdicion.direccion_entrega}
                      onChange={(e) => setFormEdicion({ ...formEdicion, direccion_entrega: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-300 mb-1.5">
                      Referencia del Domicilio:
                    </label>
                    <input
                      type="text"
                      value={formEdicion.referencia_entrega}
                      onChange={(e) => setFormEdicion({ ...formEdicion, referencia_entrega: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* N° de Guía para Provincia */}
                  <div>
                    <label className="block font-semibold text-neutral-300 mb-1.5">
                      Número de Guía Oficial ({pedidoEditando.courier.toUpperCase()}):
                    </label>
                    <input
                      type="text"
                      value={formEdicion.numero_guia}
                      onChange={(e) => setFormEdicion({ ...formEdicion, numero_guia: e.target.value })}
                      placeholder="Ej: 001-89421"
                      className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {pedidoEditando.courier === 'shalom' && (
                    <div>
                      <label className="block font-semibold text-amber-400 mb-1.5">
                        Clave de Seguridad Shalom (Voucher):
                      </label>
                      <input
                        type="text"
                        maxLength={8}
                        value={formEdicion.codigo_seguridad}
                        onChange={(e) => setFormEdicion({ ...formEdicion, codigo_seguridad: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  )}

                  {pedidoEditando.courier === 'shalom' && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="font-semibold text-amber-400">
                          Link Directo de Rastreo (Shalom Pro):
                        </label>
                        {formEdicion.link_rastreo && (
                          <a
                            href={formEdicion.link_rastreo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 font-normal cursor-pointer"
                            title="Probar enlace en nueva pestaña"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Probar Link</span>
                          </a>
                        )}
                      </div>
                      <input
                        type="url"
                        value={formEdicion.link_rastreo}
                        onChange={(e) => setFormEdicion({ ...formEdicion, link_rastreo: e.target.value })}
                        placeholder="https://shalom.com.pe/rastrea/..."
                        className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                      />
                      <span className="text-[11px] text-neutral-400 mt-1 block">
                        Pega aquí el enlace que entrega Shalom Pro. Al presionar <strong className="text-white">Rastrear</strong>, se abrirá directo sin rellenar datos.
                      </span>
                    </div>
                  )}

                  {/* Tipo de Mercadería Shalom Pro */}
                  {pedidoEditando.courier === 'shalom' && (
                    <div>
                      <label className="block font-semibold text-amber-400 mb-1.5">
                        Tipo de Mercadería (Carga Masiva Shalom Pro):
                      </label>
                      <select
                        value={formEdicion.tipo_mercaderia || 'PAQUETE XS'}
                        onChange={(e) => setFormEdicion({ ...formEdicion, tipo_mercaderia: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-amber-500"
                      >
                        <option value="SOBRE">SOBRE</option>
                        <option value="PAQUETE XXS">PAQUETE XXS</option>
                        <option value="PAQUETE XS">PAQUETE XS</option>
                        <option value="PAQUETE S">PAQUETE S</option>
                        <option value="PAQUETE M">PAQUETE M</option>
                        <option value="PAQUETE L">PAQUETE L</option>
                      </select>
                      <span className="text-[11px] text-neutral-400 mt-1 block">
                        Se exportará en la Columna H de la plantilla oficial de carga masiva de Shalom.
                      </span>
                    </div>
                  )}

                  {/* Link de Rastreo Directo Olva Courier */}
                  {pedidoEditando.courier === 'olva' && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="font-semibold text-neutral-300">
                          Link de Rastreo Directo (Olva Courier):
                        </label>
                        {(formEdicion.link_rastreo || formEdicion.numero_guia) && (
                          <a
                            href={formEdicion.link_rastreo || `https://tracking.olvacourier.com/?q=${encodeURIComponent(formEdicion.numero_guia.trim())}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 font-normal cursor-pointer"
                            title="Probar enlace en nueva pestaña"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Probar Link</span>
                          </a>
                        )}
                      </div>
                      <input
                        type="url"
                        value={formEdicion.link_rastreo}
                        onChange={(e) => setFormEdicion({ ...formEdicion, link_rastreo: e.target.value })}
                        placeholder={`https://tracking.olvacourier.com/?q=${formEdicion.numero_guia ? formEdicion.numero_guia.trim() : '{guia}'}`}
                        className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                      />
                      <span className="text-[11px] text-neutral-400 mt-1 block">
                        {formEdicion.link_rastreo 
                          ? 'Usando link personalizado.' 
                          : `Automático con la guía: https://tracking.olvacourier.com/?q=${formEdicion.numero_guia || '{guia}'}`}
                      </span>
                    </div>
                  )}

                  {/* Link de Rastreo Directo Urbano Express */}
                  {pedidoEditando.courier === 'urbano' && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="font-semibold text-neutral-300">
                          Link de Rastreo Directo (Urbano Express):
                        </label>
                        {(formEdicion.link_rastreo || formEdicion.numero_guia) && (
                          <a
                            href={formEdicion.link_rastreo || `https://www.urbanoexpress.com/tracking?guides=${encodeURIComponent(formEdicion.numero_guia.trim())}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 font-normal cursor-pointer"
                            title="Probar enlace en nueva pestaña"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Probar Link</span>
                          </a>
                        )}
                      </div>
                      <input
                        type="url"
                        value={formEdicion.link_rastreo}
                        onChange={(e) => setFormEdicion({ ...formEdicion, link_rastreo: e.target.value })}
                        placeholder={`https://www.urbanoexpress.com/tracking?guides=${formEdicion.numero_guia ? formEdicion.numero_guia.trim() : '{guia}'}`}
                        className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                      />
                      <span className="text-[11px] text-neutral-400 mt-1 block">
                        {formEdicion.link_rastreo 
                          ? 'Usando link personalizado.' 
                          : `Automático con la guía: https://www.urbanoexpress.com/tracking?guides=${formEdicion.numero_guia || '{guia}'}`}
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Información y Control Secuencial del Estado */}
              <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-300">Estado en la Secuencia:</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    formEdicion.estado === 'entregado'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : formEdicion.estado === 'en_agencia'
                        ? 'bg-purple-500/20 text-purple-400 border-purple-500/40'
                        : formEdicion.estado === 'en_transito'
                          ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                          : formEdicion.estado === 'en_origen'
                            ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                            : formEdicion.estado === 'asignado'
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm shadow-purple-500/10'
                              : formEdicion.estado === 'en_preparacion'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
                  }`}>
                    {formEdicion.estado === 'registrado' && '1. Registrado (Sin emitir)'}
                    {formEdicion.estado === 'asignado' && `2. Asignado (${formEdicion.motorizado_asignado === 'Motorizado 1' ? 'M1' : formEdicion.motorizado_asignado === 'Motorizado 2' ? 'M2' : formEdicion.motorizado_asignado || 'Motorizado'})`}
                    {formEdicion.estado === 'en_preparacion' && '2. En Preparación (Almacén)'}
                    {formEdicion.estado === 'en_origen' && '3. En Origen (Agencia Lima)'}
                    {formEdicion.estado === 'en_transito' && '4. En Tránsito (En viaje)'}
                    {formEdicion.estado === 'en_agencia' && '5. En Agencia Destino'}
                    {formEdicion.estado === 'entregado' && '6. Entregado con Éxito'}
                    {formEdicion.estado === 'incidencia' && 'Incidencia / Observación'}
                  </span>
                </div>

                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  {formEdicion.estado === 'registrado' ? (
                    <span>
                      💡 <strong className="text-amber-400">Avance secuencial automático:</strong> Al asignar el N° de Guía (y clave si es Shalom) y guardar, el sistema pasará la orden a <strong className="text-white">2. En Preparación</strong>. Luego, cuando lleves el paquete al courier en Lima, presionarás <strong className="text-cyan-400">[A Origen]</strong> en la tabla.
                    </span>
                  ) : (
                    <span>
                      🔒 <strong className="text-neutral-300">Control de Secuencia:</strong> Para mantener el orden y evitar saltos o retrocesos accidentales, el estado avanza paso a paso desde los botones directos de la tabla principal.
                    </span>
                  )}
                </p>

                {/* Ajuste manual opcional para casos excepcionales (Admin override) */}
                <div className="pt-1 border-t border-neutral-900">
                  <button
                    type="button"
                    onClick={() => setMostrarCambioManualEstado(!mostrarCambioManualEstado)}
                    className="text-[10px] text-neutral-500 hover:text-amber-400 transition-colors cursor-pointer underline flex items-center gap-1"
                  >
                    <span>{mostrarCambioManualEstado ? '▲ Ocultar cambio manual forzado' : '▼ ¿Necesitas forzar un cambio de estado manual o reportar incidencia?'}</span>
                  </button>

                  {mostrarCambioManualEstado && (
                    <div className="mt-2 pt-2 border-t border-neutral-800 animate-in fade-in">
                      <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                        Forzar selección de estado (Excepcional):
                      </label>
                      <select
                        value={formEdicion.estado}
                        onChange={(e) => setFormEdicion({ ...formEdicion, estado: e.target.value })}
                        className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500"
                      >
                        <option value="registrado">1. Registrado (Sin emitir)</option>
                        <option value="asignado">2. Asignado (Motorizado Express)</option>
                        <option value="en_preparacion">2. En Preparación (Almacén)</option>
                        <option value="en_origen">3. En Origen (Agencia Lima)</option>
                        <option value="en_transito">4. En Tránsito / En Ruta</option>
                        <option value="en_agencia">5. En Agencia Destino</option>
                        <option value="entregado">6. Entregado con Éxito</option>
                        <option value="incidencia">Incidencia / Observación</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Detalle o nota de estado */}
              <div>
                <label className="block font-semibold text-neutral-300 mb-1.5">
                  Detalle informativo visible para el cliente:
                </label>
                <input
                  type="text"
                  value={formEdicion.estado_detalle}
                  onChange={(e) => setFormEdicion({ ...formEdicion, estado_detalle: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800 sticky bottom-0 bg-neutral-900/95 backdrop-blur-sm py-2 mt-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setPedidoEditando(null)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {guardando ? 'Guardando...' : 'Guardar y Actualizar'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ================= MODAL: VISOR DE FOTO DE EVIDENCIA ================= */}
      {fotoParaVer && (
        <div 
          onClick={() => setFotoParaVer(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="relative max-w-lg w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-4 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-3">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Comprobante de Entrega
              </span>
              <button 
                onClick={() => setFotoParaVer(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={fotoParaVer}
              alt="Evidencia fotográfica"
              className="w-full max-h-[70vh] object-contain rounded-2xl bg-black"
            />
          </div>
        </div>
      )}

      {/* ================= MODAL PROFESIONAL: CONFIRMACIÓN DE ELIMINACIÓN ================= */}
      {pedidoParaEliminar && (
        <div 
          onClick={() => !eliminando && setPedidoParaEliminar(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-sm w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-2xl shadow-black/80 overflow-hidden space-y-4"
          >
            {/* Header del modal con icono de advertencia */}
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-white">¿Eliminar orden definitivamente?</h3>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  Estás a punto de borrar la orden <strong className="text-amber-400 font-mono">{pedidoParaEliminar.codigo_seguimiento}</strong>
                  {pedidoParaEliminar.nombre_cliente ? ` de ${pedidoParaEliminar.nombre_cliente}` : ''}.
                </p>
              </div>
            </div>

            {/* Aviso de confirmación */}
            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80 text-[11px] text-neutral-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Esta acción no se puede deshacer y se borrará tanto de tu pantalla como de Supabase.</span>
            </div>

            {/* Botones de acción */}
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setPedidoParaEliminar(null)}
                disabled={eliminando}
                className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarEliminarPedido}
                disabled={eliminando}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md shadow-red-600/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {eliminando ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Sí, eliminar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast flotante de notificaciones */}
      {toast && (
        <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-neutral-900/95 border border-amber-500/50 text-white text-xs font-semibold shadow-2xl shadow-black/80 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
