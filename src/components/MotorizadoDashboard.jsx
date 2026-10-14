import { useState, useRef } from 'react';
import { 
  Bike, Phone, MapPin, Navigation, Camera, CheckCircle2, AlertTriangle, 
  Clock, Search, RefreshCw, UploadCloud, X, ShieldCheck, Eye, IdCard, MessageCircle, Check
} from 'lucide-react';
import { comprimirFotoEntrega, formatearBytes } from '../utils/imageCompressor';
import { actualizarPedido } from '../services/pedidosService';
import FiltroFechaPremium, { obtenerFechaPedidoLocal } from './FiltroFechaPremium';

const MotorizadoDashboard = ({ 
  pedidos = [], 
  onActualizar, 
  onCerrarSesion, 
  motorizadoActivo = 'todos',
  rolUsuario = 'motorizado'
}) => {
  const esMotorizadoFijo = motorizadoActivo !== 'todos' && Boolean(motorizadoActivo);
  const [filtroMotorizado, setFiltroMotorizado] = useState(esMotorizadoFijo ? motorizadoActivo : 'todos');
  const [prevMotorizadoActivo, setPrevMotorizadoActivo] = useState(motorizadoActivo);
  const [filtroEstado, setFiltroEstado] = useState('pendientes'); // 'todos' | 'pendientes' | 'entregados'
  const [busqueda, setBusqueda] = useState('');

  // El filtro temporal solo está disponible para Admin, Coordinador o Vendedor (no visible para repartidores en ruta)
  const puedeVerFiltroFecha = rolUsuario === 'admin' || rolUsuario === 'vendedor' || (!esMotorizadoFijo && motorizadoActivo === 'todos');
  const [filtroFecha, setFiltroFecha] = useState({
    tipo: 'todos',
    mes: '',
    desde: '',
    hasta: '',
    label: 'Todos los períodos'
  });

  // Helper para verificar filtro de fecha
  const pasaFiltroFecha = (p, fFecha) => {
    if (!fFecha || fFecha.tipo === 'todos') return true;
    const fPedido = obtenerFechaPedidoLocal(p);
    if (!fPedido) return false;

    if (fFecha.tipo === 'mes') {
      return fPedido.startsWith(fFecha.mes);
    }
    if (fFecha.tipo === 'rango' || fFecha.tipo === 'preset') {
      const desde = fFecha.desde || '2020-01-01';
      const hasta = fFecha.hasta || '2099-12-31';
      return fPedido >= desde && fPedido <= hasta;
    }
    return true;
  };

  // Sincronizar filtro cuando cambie la prop motorizadoActivo (patrón oficial de React)
  if (motorizadoActivo && motorizadoActivo !== 'todos' && motorizadoActivo !== prevMotorizadoActivo) {
    setPrevMotorizadoActivo(motorizadoActivo);
    setFiltroMotorizado(motorizadoActivo);
  }
  
  // Modal de entrega con doble foto (Paquete + DNI)
  const [pedidoParaEntregar, setPedidoParaEntregar] = useState(null);
  const [fotoPaquete, setFotoPaquete] = useState(null);
  const [fotoDni, setFotoDni] = useState(null);
  const [procesandoFotoTipo, setProcesandoFotoTipo] = useState(null); // 'paquete' | 'dni' | null
  const [guardandoEntrega, setGuardandoEntrega] = useState(false);
  const [errorModal, setErrorModal] = useState('');
  const fileInputPaqueteRef = useRef(null);
  const fileInputDniRef = useRef(null);

  // Modal de éxito post-entrega con reporte directo a WhatsApp Admin
  const [reporteEntregaExito, setReporteEntregaExito] = useState(null);

  // Modal para ver evidencias registradas (Paquete y DNI con selector de pestaña)
  const [evidenciasParaVer, setEvidenciasParaVer] = useState(null);

  // Filtrar solo pedidos de Lima Metropolitana
  const pedidosLima = pedidos.filter((p) => 
    p.tipo_envio === 'lima_metropolitana' || p.courier === 'motorizado' || p.distrito_lima
  );

  // Pedidos asignados al conductor actual o al filtro seleccionado
  const pedidosRelevantesConductor = esMotorizadoFijo
    ? pedidosLima.filter((p) => p.motorizado_asignado === motorizadoActivo)
    : (filtroMotorizado === 'todos' 
        ? pedidosLima 
        : pedidosLima.filter((p) => p.motorizado_asignado === filtroMotorizado));

  const pedidosFiltrados = pedidosRelevantesConductor.filter((p) => {
    // Filtro temporal (solo si el usuario tiene permiso de ver filtro)
    if (puedeVerFiltroFecha && !pasaFiltroFecha(p, filtroFecha)) {
      return false;
    }

    // Filtro por estado
    if (filtroEstado === 'pendientes') {
      if (p.estado === 'entregado') return false;
    } else if (filtroEstado === 'entregados') {
      if (p.estado !== 'entregado') return false;
    }

    // Filtro de búsqueda
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      const matchCod = p.codigo_seguimiento.toLowerCase().includes(q);
      const matchCli = p.nombre_cliente.toLowerCase().includes(q);
      const matchDis = (p.distrito_lima || '').toLowerCase().includes(q);
      const matchDir = (p.direccion_entrega || '').toLowerCase().includes(q);
      if (!matchCod && !matchCli && !matchDis && !matchDir) return false;
    }

    return true;
  });

  // Métricas rápidas del motorizado (reactivas al corte temporal si está activo)
  const pedidosParaMetricas = puedeVerFiltroFecha
    ? pedidosRelevantesConductor.filter((p) => pasaFiltroFecha(p, filtroFecha))
    : pedidosRelevantesConductor;

  const totalPendientes = pedidosParaMetricas.filter((p) => p.estado !== 'entregado').length;
  const totalEntregadosHoy = pedidosParaMetricas.filter((p) => p.estado === 'entregado').length;

  // Cambiar estado a En Ruta
  const iniciarRuta = async (p) => {
    const nuevoHistorial = [...(p.historial_estados || [])];
    nuevoHistorial.push({
      estado: 'en_transito',
      fecha: new Date().toISOString(),
      detalle: `Motorizado (${p.motorizado_asignado || 'tech mood'}) salió en ruta hacia ${p.distrito_lima}`
    });

    await actualizarPedido(p.id, {
      estado: 'en_transito',
      estado_detalle: `En ruta hacia ${p.distrito_lima}. Entregando en el transcurso del día.`,
      historial_estados: nuevoHistorial
    });

    if (onActualizar) onActualizar();
  };

  // Abrir modal de entrega fotográfica (Doble evidencia: Paquete + DNI)
  const abrirModalEntrega = (p) => {
    setPedidoParaEntregar(p);
    setFotoPaquete(null);
    setFotoDni(null);
    setErrorModal('');
  };

  // Manejar captura / selección de foto por tipo ('paquete' | 'dni')
  const handleSeleccionarFoto = async (e, tipo) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorModal('');
    setProcesandoFotoTipo(tipo);

    try {
      // Compresión inteligente instantánea en el navegador (reduce de ~8MB a ~70KB manteniendo nitidez)
      const resultado = await comprimirFotoEntrega(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.68
      });
      if (tipo === 'paquete') {
        setFotoPaquete(resultado);
      } else if (tipo === 'dni') {
        setFotoDni(resultado);
      }
    } catch (err) {
      console.error(err);
      setErrorModal('No se pudo procesar la foto: ' + err.message);
    } finally {
      setProcesandoFotoTipo(null);
      e.target.value = '';
    }
  };

  // Confirmar entrega con ambas fotos guardadas (Paquete y DNI obligatorios)
  const confirmarEntregaConFoto = async () => {
    if (!pedidoParaEntregar) return;
    if (!fotoPaquete?.base64) {
      setErrorModal('Por favor toma o sube la fotografía del paquete entregado en el domicilio.');
      return;
    }
    if (!fotoDni?.base64) {
      setErrorModal('Por favor toma o sube la fotografía del DNI físico del cliente/receptor.');
      return;
    }

    setGuardandoEntrega(true);
    try {
      const ahora = new Date().toISOString();
      const nuevoHistorial = [...(pedidoParaEntregar.historial_estados || [])];
      nuevoHistorial.push({
        estado: 'entregado',
        fecha: ahora,
        detalle: `Entregado satisfactoriamente por ${pedidoParaEntregar.motorizado_asignado || 'Motorizado tech mood'}. Doble evidencia (Paquete + DNI) registrada.`
      });

      const actualizacion = {
        estado: 'entregado',
        estado_detalle: `Entregado con éxito a domicilio en ${pedidoParaEntregar.distrito_lima}. Evidencias validadas.`,
        foto_entrega: fotoPaquete.base64,
        foto_dni: fotoDni.base64,
        fecha_entregado: ahora,
        historial_estados: nuevoHistorial
      };

      await actualizarPedido(pedidoParaEntregar.id, actualizacion);

      const pedidoCompletado = {
        ...pedidoParaEntregar,
        ...actualizacion
      };

      setPedidoParaEntregar(null);
      // Abrir modal de éxito con acceso directo para reportar al Admin por WhatsApp
      setReporteEntregaExito(pedidoCompletado);
      if (onActualizar) onActualizar();
    } catch (err) {
      console.error(err);
      setErrorModal('Error al registrar la entrega. Intenta nuevamente.');
    } finally {
      setGuardandoEntrega(false);
    }
  };

  // Generar URL para enviar reporte de entrega finalizada directo al WhatsApp del Admin (+51 986601895)
  const generarUrlWhatsAppReporteAdmin = (p) => {
    const esPagado = p.metodo_pago === 'pagado';
    const lineas = [
      `✅ *[REPORTE DE ENTREGA EN DOMICILIO - LIMA EXPRESS]*`,
      `----------------------------------------`,
      `• *Código TM:* ${p.codigo_seguimiento}`,
      `• *Cliente:* ${p.nombre_cliente}`,
      `• *DNI Receptor:* ${p.dni_cliente || 'Validado en foto física'}`,
      `• *Distrito:* ${p.distrito_lima || 'Lima'}`,
      `• *Dirección:* ${p.direccion_entrega || ''}`,
      `• *Condición de Cobro:* ${esPagado ? '💳 PAGADO (Validado con DNI)' : '💵 CONTRAENTREGA COBRADO'}`,
      `• *Repartidor:* ${p.motorizado_asignado || (esMotorizadoFijo ? motorizadoActivo : 'Motorizado tech mood')}`,
      `• *Estado:* ENTREGADO CON ÉXITO`,
      `----------------------------------------`,
      `📸 _Las 2 evidencias (Foto del Paquete y Foto del DNI del receptor) ya fueron registradas en el sistema tech mood._`
    ];
    return `https://api.whatsapp.com/send?phone=51986601895&text=${encodeURIComponent(lineas.join('\n'))}`;
  };

  // Generar URL de Google Maps para navegación directa
  const obtenerUrlGoogleMaps = (p) => {
    const dirCompleta = `${p.direccion_entrega || p.agencia_direccion || ''}, ${p.distrito_lima || ''}, Lima, Peru`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dirCompleta)}`;
  };

  // Generar URL para WhatsApp directo al cliente
  const obtenerUrlWhatsAppCliente = (p) => {
    const tel = p.telefono_cliente.replace(/\D/g, '').replace(/^51/, '');
    const msg = `¡Hola ${p.nombre_cliente}! 👋 Te saluda tu repartidor de tech mood. Tengo tu pedido con código *${p.codigo_seguimiento}* y ya estoy en camino a tu dirección en *${p.distrito_lima}*. Por favor estate atento(a) para recibirlo.`;
    return `https://api.whatsapp.com/send?phone=51${tel}&text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 text-left animate-in fade-in duration-300">
      
      {/* Barra superior del repartidor */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-3xl bg-neutral-900/90 border border-neutral-800 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-black shadow-lg shadow-amber-500/20">
            <Bike className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">Portal de Reparto Express</h2>
              {/* <span className="px-2 py-0.5 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-400 text-[10px] font-bold">
                Lima
              </span> */}
              {esMotorizadoFijo && (
                <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-black flex items-center gap-1 shadow-sm">
                  🛵 {motorizadoActivo}
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400">
              Gestión táctil de rutas, contacto con clientes y cierre con foto de evidencia.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {onActualizar && (
            <button
              onClick={onActualizar}
              className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 text-neutral-300 transition-colors"
              title="Refrescar lista"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          {onCerrarSesion && (
            <button
              onClick={onCerrarSesion}
              className="px-3.5 py-2 rounded-xl bg-red-900/30 border border-red-800 text-red-400 hover:bg-red-900/50 text-xs font-medium transition-colors cursor-pointer"
            >
              Salir
            </button>
          )}
        </div>
      </div>

      {/* Mini Tarjetas de Estado Operativo */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
        <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-amber-400 font-bold block">Por Entregar</span>
            <span className="text-2xl font-black text-white mt-0.5 block">{totalPendientes}</span>
          </div>
          <Clock className="w-6 h-6 text-amber-400 opacity-60" />
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-emerald-400 font-bold block">Entregados</span>
            <span className="text-2xl font-black text-white mt-0.5 block">{totalEntregadosHoy}</span>
          </div>
          <CheckCircle2 className="w-6 h-6 text-emerald-400 opacity-60" />
        </div>
      </div>

      {/* Controles de Filtro Rápidos */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Selector de Conductor: SOLO visible en supervisión general ('todos') */}
          {!esMotorizadoFijo ? (
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-neutral-900 border border-neutral-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFiltroMotorizado('todos')}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  filtroMotorizado === 'todos'
                    ? 'bg-amber-500 text-black font-extrabold shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Todos ({pedidosLima.length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroMotorizado('Motorizado 1')}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  filtroMotorizado === 'Motorizado 1'
                    ? 'bg-amber-500 text-black font-extrabold shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Motorizado 1
              </button>
              <button
                type="button"
                onClick={() => setFiltroMotorizado('Motorizado 2')}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  filtroMotorizado === 'Motorizado 2'
                    ? 'bg-amber-500 text-black font-extrabold shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Motorizado 2
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-extrabold shadow-sm">
              <Bike className="w-4 h-4 text-amber-400" />
              <span>Hoja de Ruta: {motorizadoActivo}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {/* Filtro Temporal Premium: Visible SOLO para Admin y Coordinador/Vendedor */}
            {puedeVerFiltroFecha && (
              <FiltroFechaPremium
                valor={filtroFecha}
                onChange={setFiltroFecha}
                pedidos={pedidosLima}
              />
            )}

            {/* Filtro de Estado */}
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-neutral-900 border border-neutral-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFiltroEstado('pendientes')}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  filtroEstado === 'pendientes'
                    ? 'bg-red-500/20 text-red-300 font-bold border border-red-500/40'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Pendientes
              </button>
              <button
                type="button"
                onClick={() => setFiltroEstado('entregados')}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  filtroEstado === 'entregados'
                    ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Entregados
              </button>
              <button
                type="button"
                onClick={() => setFiltroEstado('todos')}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  filtroEstado === 'todos'
                    ? 'bg-neutral-800 text-white font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Ver Todo
              </button>
            </div>
          </div>
        </div>

        {/* Buscador Rápido */}
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente, distrito, dirección o código TM-..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-neutral-900 border border-neutral-800 text-white text-xs sm:text-sm placeholder-neutral-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Lista de Pedidos de Reparto */}
      <div className="space-y-3">
        {pedidosFiltrados.length === 0 ? (
          <div className="p-10 rounded-3xl bg-neutral-900/40 border border-neutral-800/80 text-center">
            <Bike className="w-10 h-10 text-neutral-600 mx-auto mb-2" />
            <p className="text-white font-bold text-sm">No se encontraron entregas</p>
            <p className="text-neutral-500 text-xs mt-1">
              {filtroEstado === 'pendientes'
                ? (esMotorizadoFijo ? `¡Excelente! No tienes pedidos pendientes asignados a ti hoy.` : '¡Excelente! No tienes pedidos pendientes con este filtro.')
                : 'No hay pedidos que coincidan con la búsqueda actual.'}
            </p>
          </div>
        ) : (
          pedidosFiltrados.map((p) => {
            const estaEntregado = p.estado === 'entregado';
            const estaEnRuta = p.estado === 'en_transito';

            return (
              <div
                key={p.id}
                className={`p-4 sm:p-5 rounded-3xl border transition-all ${
                  estaEntregado
                    ? 'bg-neutral-900/40 border-emerald-500/25 opacity-85'
                    : estaEnRuta
                      ? 'bg-blue-950/20 border-blue-500/40 ring-1 ring-blue-500/20'
                      : 'bg-neutral-900/80 border-neutral-800 hover:border-neutral-700'
                }`}
              >
                {/* Cabecera de la Tarjeta */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-neutral-800/80">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs sm:text-sm font-black text-amber-400">
                      {p.codigo_seguimiento}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-neutral-800 text-neutral-300 font-semibold text-[10px]">
                      {p.distrito_lima || 'Lima'}
                    </span>
                    {p.motorizado_asignado && (
                      <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-[10px]">
                        🛵 {p.motorizado_asignado}
                      </span>
                    )}
                  </div>

                  {/* Badge de Estado */}
                  <div>
                    {estaEntregado ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Entregado
                      </span>
                    ) : estaEnRuta ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 font-bold text-[11px] animate-pulse">
                        <Navigation className="w-3.5 h-3.5" /> En Ruta al Domicilio
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 font-bold text-[11px]">
                        <Clock className="w-3.5 h-3.5" /> En Preparación
                      </span>
                    )}
                  </div>
                </div>

                {/* Banner de Condición de Pago para el Repartidor */}
                {!estaEntregado && (
                  <div className="pt-2">
                    {p.metodo_pago === 'pagado' ? (
                      <div className="p-2 sm:p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>PAGADO</span>
                        </div>
                        <span className="text-[11px] text-emerald-300 font-medium">
                          Solo validar DNI y entregar
                        </span>
                      </div>
                    ) : (
                      <div className="p-2 sm:p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 font-extrabold text-amber-300">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
                          <span>PAGO CONTRAENTREGA</span>
                        </div>
                        <span className="text-[11px] text-amber-200 font-semibold text-right">
                          Esperar confirmación de administración
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Contenido: Datos del Cliente y Domicilio */}
                <div className="py-3 space-y-2 text-xs sm:text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-white font-extrabold text-sm sm:text-base block">
                        {p.nombre_cliente}
                      </span>
                      <span className="text-neutral-400 text-xs font-mono">
                        DNI: {p.dni_cliente} • Tel: {p.telefono_cliente}
                      </span>
                    </div>

                    {/* Botones de Contacto Rápido (Solo disponibles mientras el pedido no esté entregado) */}
                    {!estaEntregado && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <a
                          href={`tel:${p.telefono_cliente}`}
                          className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-xs flex items-center gap-1 transition-colors active:scale-95"
                          title="Llamar al cliente"
                        >
                          <Phone className="w-3.5 h-3.5 text-amber-400" />
                          <span className="hidden sm:inline">Llamar</span>
                        </a>
                        <a
                          href={obtenerUrlWhatsAppCliente(p)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/40 text-[#25D366] font-bold text-xs flex items-center gap-1 transition-colors active:scale-95"
                          title="Escribir al WhatsApp"
                        >
                          <span className="text-xs">💬</span>
                          <span className="hidden sm:inline">WhatsApp</span>
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Dirección y Referencia */}
                  <div className="p-3 rounded-2xl bg-neutral-950/60 border border-neutral-800/90 space-y-1">
                    <div className="flex items-start gap-1.5 text-neutral-200">
                      <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-white block">
                          {p.direccion_entrega || p.agencia_direccion}
                        </span>
                        <span className="text-[11px] text-amber-300/90 font-medium">
                          Distrito: {p.distrito_lima}
                        </span>
                      </div>
                    </div>

                    {p.referencia_entrega && (
                      <p className="text-[11px] text-neutral-400 pl-5.5 italic">
                        <strong className="text-neutral-300">Ref:</strong> {p.referencia_entrega}
                      </p>
                    )}
                  </div>
                </div>

                {/* Acciones del Repartidor */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                  {/* Botón Navegar en Google Maps */}
                  <a
                    href={obtenerUrlGoogleMaps(p)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-xs font-semibold transition-colors"
                  >
                    <Navigation className="w-3.5 h-3.5 text-blue-400" />
                    <span>Ver en Google Maps</span>
                  </a>

                  {/* Botones de Flujo */}
                  <div className="flex items-center gap-2">
                    {!estaEntregado && !estaEnRuta && (
                      <button
                        type="button"
                        onClick={() => iniciarRuta(p)}
                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-blue-500/20"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Iniciar Ruta</span>
                      </button>
                    )}

                    {!estaEntregado && (
                      <button
                        type="button"
                        onClick={() => abrirModalEntrega(p)}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Entregar con Foto</span>
                      </button>
                    )}

                    {estaEntregado && (p.foto_entrega || p.foto_dni) && (
                      <button
                        type="button"
                        onClick={() => setEvidenciasParaVer({
                          foto_entrega: p.foto_entrega,
                          foto_dni: p.foto_dni,
                          tab: p.foto_entrega ? 'paquete' : 'dni'
                        })}
                        className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-emerald-400 text-xs font-bold flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver Evidencias</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ================= MODAL: SUBIR DOBLE FOTO DE ENTREGA COMPRIMIDA (PAQUETE + DNI) ================= */}
      {pedidoParaEntregar && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md overflow-y-auto overscroll-contain p-3 sm:p-4 animate-in fade-in">
          <div className="min-h-full flex items-center justify-center py-6 pb-10 sm:py-8 sm:pb-8">
            <div className="w-full max-w-lg bg-neutral-900 border border-neutral-700 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Registro de Evidencias de Entrega</h3>
                  <p className="text-[11px] text-neutral-400 font-mono">
                    {pedidoParaEntregar.codigo_seguimiento} • {pedidoParaEntregar.nombre_cliente}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPedidoParaEntregar(null)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Recordatorio de Cobro / DNI en Modal de Entrega */}
            {pedidoParaEntregar.metodo_pago === 'pagado' ? (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Pedido <strong>PAGADO</strong>. Valida el DNI físico del receptor y toma ambas fotos.</span>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>RECORDATORIO: PAGO CONTRAENTREGA</span>
                </div>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  Asegúrate de que la administración te haya confirmado el ingreso del dinero a las cuentas antes de cerrar esta entrega.
                </p>
              </div>
            )}

            {errorModal && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorModal}</span>
              </div>
            )}

            {/* Inputs ocultos de fotos */}
            <input
              ref={fileInputPaqueteRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handleSeleccionarFoto(e, 'paquete')}
              className="hidden"
            />
            <input
              ref={fileInputDniRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handleSeleccionarFoto(e, 'dni')}
              className="hidden"
            />

            {/* GRID CON LAS DOS CASILLAS DE EVIDENCIA: PAQUETE Y DNI */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              {/* CASILLA 1: FOTO DEL PAQUETE */}
              <div className="p-3.5 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-amber-400" /> 1. Foto del Paquete
                  </span>
                  {fotoPaquete ? (
                    <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Listo
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-400">Requerido</span>
                  )}
                </div>

                {!fotoPaquete ? (
                  <div
                    onClick={() => fileInputPaqueteRef.current?.click()}
                    className="border-2 border-dashed border-neutral-700 hover:border-amber-500 rounded-xl p-4 text-center cursor-pointer transition-all bg-neutral-900/60 hover:bg-neutral-900 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <p className="text-white font-bold text-xs">Tomar Foto Paquete</p>
                    <p className="text-[10px] text-neutral-400 mt-0.5">En puerta o entregado</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative rounded-xl overflow-hidden border border-neutral-700 bg-black aspect-video flex items-center justify-center">
                      <img
                        src={fotoPaquete.base64}
                        alt="Evidencia Paquete"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setFotoPaquete(null)}
                        className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/80 text-white hover:bg-black transition-colors"
                        title="Cambiar foto de paquete"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-[10px] text-emerald-400 font-semibold flex items-center justify-between px-1">
                      <span>Optimizado:</span>
                      <span className="font-mono">{formatearBytes(fotoPaquete.compressedSize)} (-{fotoPaquete.reductionPercent})</span>
                    </div>
                  </div>
                )}
              </div>

              {/* CASILLA 2: FOTO DEL DNI DEL CLIENTE */}
              <div className="p-3.5 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <IdCard className="w-4 h-4 text-teal-400" /> 2. Foto DNI Receptor
                  </span>
                  {fotoDni ? (
                    <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Listo
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-teal-400">Requerido</span>
                  )}
                </div>

                {!fotoDni ? (
                  <div
                    onClick={() => fileInputDniRef.current?.click()}
                    className="border-2 border-dashed border-neutral-700 hover:border-teal-500 rounded-xl p-4 text-center cursor-pointer transition-all bg-neutral-900/60 hover:bg-neutral-900 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform">
                      <IdCard className="w-5 h-5" />
                    </div>
                    <p className="text-white font-bold text-xs">Tomar Foto DNI</p>
                    <p className="text-[10px] text-neutral-400 mt-0.5">DNI físico del receptor</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative rounded-xl overflow-hidden border border-neutral-700 bg-black aspect-video flex items-center justify-center">
                      <img
                        src={fotoDni.base64}
                        alt="Evidencia DNI"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setFotoDni(null)}
                        className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/80 text-white hover:bg-black transition-colors"
                        title="Cambiar foto de DNI"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-[10px] text-teal-400 font-semibold flex items-center justify-between px-1">
                      <span>Optimizado:</span>
                      <span className="font-mono">{formatearBytes(fotoDni.compressedSize)} (-{fotoDni.reductionPercent})</span>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Spinner si se está procesando alguna foto */}
            {procesandoFotoTipo && (
              <div className="text-center py-1.5 text-xs text-amber-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Comprimiendo {procesandoFotoTipo === 'paquete' ? 'foto de paquete' : 'foto de DNI'}...</span>
              </div>
            )}

            {/* Indicador de estado de fotos */}
            <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] flex items-center justify-between">
              <span className="text-neutral-400">Progreso de evidencias:</span>
              <span className={`font-bold ${fotoPaquete && fotoDni ? 'text-emerald-400' : 'text-amber-400'}`}>
                {fotoPaquete && fotoDni
                  ? '✓ Ambas evidencias listas'
                  : (!fotoPaquete && !fotoDni ? '0 de 2 fotos registradas' : '1 de 2 fotos registradas')}
              </span>
            </div>

            {/* Botones de acción con padding y altura táctil optimizada para celular */}
            <div className="pt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPedidoParaEntregar(null)}
                className="w-1/3 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold cursor-pointer transition-colors active:scale-95"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarEntregaConFoto}
                disabled={guardandoEntrega || !fotoPaquete || !fotoDni}
                className="w-2/3 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black text-xs transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer active:scale-95 flex items-center justify-center gap-2"
              >
                {guardandoEntrega ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Finalizando y guardando...</span>
                  </>
                ) : (
                  <span>Confirmar y Cerrar Pedido</span>
                )}
              </button>
            </div>

            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: ÉXITO POST-ENTREGA CON ENVÍO DE REPORTE A WHATSAPP ADMIN ================= */}
      {reporteEntregaExito && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md overflow-y-auto overscroll-contain p-4 animate-in fade-in">
          <div className="min-h-full flex items-center justify-center py-6 pb-10 sm:py-8 sm:pb-8">
            <div className="w-full max-w-md bg-neutral-900 border border-emerald-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              
              <div>
                <h3 className="text-base sm:text-lg font-black text-white">¡Entrega Cerrada con Éxito!</h3>
                <p className="text-xs text-neutral-300 mt-1">
                  Las evidencias de paquete y DNI fueron guardadas correctamente en tech mood.
                </p>
              </div>

              {/* Resumen rápido del pedido entregado */}
              <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 text-left text-xs space-y-1.5">
                <div className="flex justify-between items-center pb-1.5 border-b border-neutral-800">
                  <span className="text-white font-mono font-bold">{reporteEntregaExito.codigo_seguimiento}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    ENTREGADO
                  </span>
                </div>
                <div className="text-white font-bold">{reporteEntregaExito.nombre_cliente}</div>
                <div className="text-neutral-400 text-[11px]">📍 {reporteEntregaExito.distrito_lima} • {reporteEntregaExito.direccion_entrega}</div>
                <div className="text-[11px] font-semibold text-amber-300">
                  {reporteEntregaExito.metodo_pago === 'pagado' ? '💳 Pago Previo (Validado con DNI)' : '💵 Pago Contraentrega Recibido'}
                </div>
              </div>

              {/* Botón WhatsApp directo al Admin */}
              <div className="space-y-2.5 pt-2">
                <a
                  href={generarUrlWhatsAppReporteAdmin(reporteEntregaExito)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-4 rounded-2xl bg-[#25D366] hover:bg-[#20ba5a] text-black font-black text-xs flex items-center justify-center gap-2 transition-all shadow-xl shadow-[#25D366]/25 cursor-pointer active:scale-95"
                >
                  <MessageCircle className="w-4 h-4 fill-black" />
                  <span>Enviar Reporte a Admin (WhatsApp)</span>
                </a>

                <button
                  type="button"
                  onClick={() => setReporteEntregaExito(null)}
                  className="w-full py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer active:scale-95"
                >
                  Cerrar y Continuar Rutas
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: VISOR DE EVIDENCIAS REGISTRADAS (PAQUETE Y DNI) ================= */}
      {evidenciasParaVer && (
        <div 
          onClick={() => setEvidenciasParaVer(null)}
          className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md overflow-y-auto overscroll-contain p-3 sm:p-4 animate-in fade-in"
        >
          <div className="min-h-full flex items-center justify-center py-6 pb-20 sm:py-8 sm:pb-8">
            <div 
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-lg w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-4 overflow-hidden space-y-3"
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-neutral-800">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> Evidencias de Entrega
                </span>
                <button 
                  onClick={() => setEvidenciasParaVer(null)}
                  className="p-1 rounded-lg text-neutral-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Pestañas si existen ambas fotos */}
              {evidenciasParaVer.foto_entrega && evidenciasParaVer.foto_dni && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEvidenciasParaVer(prev => ({ ...prev, tab: 'paquete' }))}
                    className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      evidenciasParaVer.tab === 'paquete'
                        ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300 shadow-sm'
                        : 'bg-neutral-800/80 hover:bg-neutral-800 text-neutral-400'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Foto Paquete</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEvidenciasParaVer(prev => ({ ...prev, tab: 'dni' }))}
                    className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      evidenciasParaVer.tab === 'dni'
                        ? 'bg-teal-500/20 border border-teal-500/50 text-teal-300 shadow-sm'
                        : 'bg-neutral-800/80 hover:bg-neutral-800 text-neutral-400'
                    }`}
                  >
                    <IdCard className="w-3.5 h-3.5" />
                    <span>Foto DNI</span>
                  </button>
                </div>
              )}

              <div className="rounded-2xl overflow-hidden border border-neutral-800 bg-black flex items-center justify-center">
                <img
                  src={
                    evidenciasParaVer.tab === 'dni'
                      ? (evidenciasParaVer.foto_dni || evidenciasParaVer.foto_entrega)
                      : (evidenciasParaVer.foto_entrega || evidenciasParaVer.foto_dni)
                  }
                  alt="Evidencia fotográfica"
                  className="w-full max-h-[65vh] object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default MotorizadoDashboard;
