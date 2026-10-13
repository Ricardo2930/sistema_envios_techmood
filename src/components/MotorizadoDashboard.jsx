import { useState, useRef } from 'react';
import { 
  Bike, Phone, MapPin, Navigation, Camera, CheckCircle2, AlertTriangle, 
  Clock, Search, RefreshCw, UploadCloud, X, ShieldCheck, Eye
} from 'lucide-react';
import { comprimirFotoEntrega, formatearBytes } from '../utils/imageCompressor';
import { actualizarPedido } from '../services/pedidosService';

const MotorizadoDashboard = ({ pedidos = [], onActualizar, onCerrarSesion, motorizadoActivo = 'todos' }) => {
  const esMotorizadoFijo = motorizadoActivo !== 'todos' && Boolean(motorizadoActivo);
  const [filtroMotorizado, setFiltroMotorizado] = useState(esMotorizadoFijo ? motorizadoActivo : 'todos');
  const [prevMotorizadoActivo, setPrevMotorizadoActivo] = useState(motorizadoActivo);
  const [filtroEstado, setFiltroEstado] = useState('pendientes'); // 'todos' | 'pendientes' | 'entregados'
  const [busqueda, setBusqueda] = useState('');

  // Sincronizar filtro cuando cambie la prop motorizadoActivo (patrón oficial de React)
  if (motorizadoActivo && motorizadoActivo !== 'todos' && motorizadoActivo !== prevMotorizadoActivo) {
    setPrevMotorizadoActivo(motorizadoActivo);
    setFiltroMotorizado(motorizadoActivo);
  }
  
  // Modal de entrega con foto
  const [pedidoParaEntregar, setPedidoParaEntregar] = useState(null);
  const [fotoComprimida, setFotoComprimida] = useState(null);
  const [procesandoFoto, setProcesandoFoto] = useState(false);
  const [guardandoEntrega, setGuardandoEntrega] = useState(false);
  const [errorModal, setErrorModal] = useState('');
  const fileInputRef = useRef(null);

  // Modal para ver foto ya entregada
  const [fotoParaVer, setFotoParaVer] = useState(null);

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

  // Métricas rápidas del motorizado (calculadas exclusivamente sobre los pedidos que le corresponden)
  const totalPendientes = pedidosRelevantesConductor.filter((p) => p.estado !== 'entregado').length;
  const totalEntregadosHoy = pedidosRelevantesConductor.filter((p) => p.estado === 'entregado').length;

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

  // Abrir modal de entrega fotográfica
  const abrirModalEntrega = (p) => {
    setPedidoParaEntregar(p);
    setFotoComprimida(null);
    setErrorModal('');
  };

  // Manejar captura / selección de foto
  const handleSeleccionarFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorModal('');
    setProcesandoFoto(true);

    try {
      // Compresión inteligente instantánea en el navegador (reduce de ~8MB a ~80KB)
      const resultado = await comprimirFotoEntrega(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.68
      });
      setFotoComprimida(resultado);
    } catch (err) {
      console.error(err);
      setErrorModal('No se pudo procesar la foto: ' + err.message);
    } finally {
      setProcesandoFoto(false);
    }
  };

  // Confirmar entrega con foto guardada
  const confirmarEntregaConFoto = async () => {
    if (!pedidoParaEntregar) return;
    if (!fotoComprimida?.base64) {
      setErrorModal('Por favor toma o sube una fotografía del paquete entregado como evidencia.');
      return;
    }

    setGuardandoEntrega(true);
    try {
      const ahora = new Date().toISOString();
      const nuevoHistorial = [...(pedidoParaEntregar.historial_estados || [])];
      nuevoHistorial.push({
        estado: 'entregado',
        fecha: ahora,
        detalle: `Entregado satisfactoriamente por ${pedidoParaEntregar.motorizado_asignado || 'Motorizado tech mood'}. Evidencia registrada.`
      });

      await actualizarPedido(pedidoParaEntregar.id, {
        estado: 'entregado',
        estado_detalle: `Entregado con éxito a domicilio en ${pedidoParaEntregar.distrito_lima}.`,
        foto_entrega: fotoComprimida.base64,
        fecha_entregado: ahora,
        historial_estados: nuevoHistorial
      });

      setPedidoParaEntregar(null);
      if (onActualizar) onActualizar();
    } catch (err) {
      console.error(err);
      setErrorModal('Error al registrar la entrega. Intenta nuevamente.');
    } finally {
      setGuardandoEntrega(false);
    }
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

                    {/* Botones de Contacto Rápido */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={`tel:${p.telefono_cliente}`}
                        className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-xs flex items-center gap-1 transition-colors"
                        title="Llamar al cliente"
                      >
                        <Phone className="w-3.5 h-3.5 text-amber-400" />
                        <span className="hidden sm:inline">Llamar</span>
                      </a>
                      <a
                        href={obtenerUrlWhatsAppCliente(p)}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/40 text-[#25D366] font-bold text-xs flex items-center gap-1 transition-colors"
                        title="Escribir al WhatsApp"
                      >
                        <span className="text-xs">💬</span>
                        <span className="hidden sm:inline">WhatsApp</span>
                      </a>
                    </div>
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

                    {estaEntregado && p.foto_entrega && (
                      <button
                        type="button"
                        onClick={() => setFotoParaVer(p.foto_entrega)}
                        className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-emerald-400 text-xs font-bold flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver Evidencia Fotográfica</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ================= MODAL: SUBIR FOTO DE ENTREGA COMPRIMIDA ================= */}
      {pedidoParaEntregar && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Evidencia de Entrega</h3>
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

            {/* Recordatorio de Cobro en Modal de Entrega */}
            {pedidoParaEntregar.metodo_pago === 'pagado' ? (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Pedido <strong>PAGADO PREVIAMENTE</strong>. Valida el DNI titular y toma la foto de entrega.</span>
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

            {/* Input para seleccionar o tomar foto */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleSeleccionarFoto}
              className="hidden"
            />

            {!fotoComprimida ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-neutral-700 hover:border-amber-500 rounded-2xl p-8 text-center cursor-pointer transition-all bg-neutral-950/40 hover:bg-neutral-950/80 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <p className="text-white font-bold text-sm">Tomar Foto o Seleccionar de Galería</p>
                <p className="text-xs text-neutral-400 mt-1 max-w-xs mx-auto">
                  Toma foto del paquete entregado en puerta o fachada como evidencia de entrega.
                </p>
                <span className="inline-block mt-3 px-3 py-1 rounded-full bg-neutral-800 text-neutral-300 text-[11px] font-semibold">
                  Compresión automática ultrarrápida (95% ahorro)
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Previsualización de la foto comprimida */}
                <div className="relative rounded-2xl overflow-hidden border border-neutral-700 bg-black aspect-video flex items-center justify-center">
                  <img
                    src={fotoComprimida.base64}
                    alt="Evidencia"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFotoComprimida(null);
                      }}
                      className="p-1.5 rounded-full bg-black/70 text-white hover:bg-black"
                      title="Tomar otra foto"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Badge de Compresión Inteligente */}
                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-xs space-y-1">
                  <div className="flex items-center justify-between text-neutral-300">
                    <span>Tamaño original:</span>
                    <span className="font-mono">{formatearBytes(fotoComprimida.originalSize)}</span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-400 font-bold">
                    <span>Tamaño ultra-comprimido:</span>
                    <span className="font-mono">{formatearBytes(fotoComprimida.compressedSize)} (-{fotoComprimida.reductionPercent})</span>
                  </div>
                  <p className="text-[10px] text-neutral-500 pt-1 border-t border-neutral-800">
                    ✓ Imagen optimizada para no saturar memoria ni consumir datos del repartidor.
                  </p>
                </div>
              </div>
            )}

            {procesandoFoto && (
              <div className="text-center py-2 text-xs text-amber-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Optimizando y comprimiendo foto...</span>
              </div>
            )}

            {/* Botones de acción */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPedidoParaEntregar(null)}
                className="w-1/3 py-2.5 rounded-xl bg-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarEntregaConFoto}
                disabled={guardandoEntrega || !fotoComprimida}
                className="w-2/3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black text-xs transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
              >
                {guardandoEntrega ? 'Finalizando...' : 'Confirmar y Cerrar Pedido'}
              </button>
            </div>

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
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Evidencia Fotográfica Registrada
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
              alt="Evidencia de entrega"
              className="w-full max-h-[70vh] object-contain rounded-2xl bg-black"
            />
          </div>
        </div>
      )}

    </div>
  );
};

export default MotorizadoDashboard;
