import { useState, useEffect, useCallback } from 'react';
import { 
  Search, Package, Truck, Building2, CheckCircle2, Clock, 
  MessageCircle, AlertCircle, RefreshCw, Copy, Check,
  MapPin, ShieldCheck, ArrowRight, Bike, Camera, Key
} from 'lucide-react';
import { buscarPedido } from '../services/pedidosService';

// Mapeo para Provincia (Agencias)
const ESTADOS_MAP_PROVINCIA = {
  registrado: {
    paso: 1,
    titulo: 'Pedido Registrado',
    descripcion: 'Datos validados y recibidos por el equipo comercial de tech mood.',
    color: 'amber'
  },
  en_preparacion: {
    paso: 2,
    titulo: 'En Preparación',
    descripcion: 'Productos en embalaje y rotulado con guía en almacén tech mood.',
    color: 'yellow'
  },
  en_origen: {
    paso: 3,
    titulo: 'En Agencia Origen',
    descripcion: 'Paquete admitido y recepcionado en la agencia courier de origen (Lima).',
    color: 'cyan'
  },
  en_transito: {
    paso: 4,
    titulo: 'Despachado en Courier',
    descripcion: 'Paquete en tránsito nacional vía terrestre hacia la ciudad de destino.',
    color: 'blue'
  },
  en_agencia: {
    paso: 5,
    titulo: 'Disponible en Agencia',
    descripcion: 'Listo para recojo con DNI en la agencia courier seleccionada.',
    color: 'purple'
  },
  entregado: {
    paso: 6,
    titulo: 'Entregado con Éxito',
    descripcion: 'Paquete retirado por el cliente en la agencia de destino.',
    color: 'emerald'
  },
  incidencia: {
    paso: 0,
    titulo: 'Incidencia en Envío',
    descripcion: 'Requiere validación adicional de datos o coordinación con courier.',
    color: 'rose'
  }
};

// Mapeo para Lima Metropolitana (Motorizados)
const ESTADOS_MAP_LIMA = {
  registrado: {
    paso: 1,
    titulo: 'Pedido Recibido',
    descripcion: 'Orden registrada en tech mood. Preparando datos de despacho.',
    color: 'amber'
  },
  en_preparacion: {
    paso: 2,
    titulo: 'En Preparación',
    descripcion: 'Paquete en empaque y rotulado en almacén central.',
    color: 'yellow'
  },
  asignado: {
    paso: 3,
    titulo: 'Asignado a Reparto',
    descripcion: 'Pedido programado y asignado al motorizado para salida express.',
    color: 'purple'
  },
  en_agencia: {
    paso: 3,
    titulo: 'Asignado a Reparto',
    descripcion: 'Pedido programado para salida express en el turno del motorizado.',
    color: 'purple'
  },
  en_transito: {
    paso: 4,
    titulo: 'Motorizado en Ruta',
    descripcion: 'Tu paquete va en camino a tu domicilio en el transcurso del día.',
    color: 'blue'
  },
  entregado: {
    paso: 5,
    titulo: '¡Entregado con Éxito!',
    descripcion: 'Paquete entregado satisfactoriamente en tu puerta.',
    color: 'emerald'
  },
  incidencia: {
    paso: 0,
    titulo: 'Incidencia / Reprogramado',
    descripcion: 'Se coordinará una nueva visita para la entrega.',
    color: 'rose'
  }
};

const OrderTracking = ({ codigoInicial = '', onIrAFormulario }) => {
  const [termino, setTermino] = useState(codigoInicial);
  const [prevCodigoInicial, setPrevCodigoInicial] = useState(codigoInicial);
  const [cargando, setCargando] = useState(false);
  const [pedido, setPedido] = useState(null);
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [verFotoModal, setVerFotoModal] = useState(false);

  // Sincronizar término cuando cambie codigoInicial externamente
  if (codigoInicial && codigoInicial !== prevCodigoInicial) {
    setPrevCodigoInicial(codigoInicial);
    setTermino(codigoInicial);
  }

  const realizarBusqueda = useCallback(async (query) => {
    const q = (query || termino).trim();
    if (!q) {
      setError('Por favor ingresa un código de seguimiento (ej: TM-784291) o tu número de DNI.');
      return;
    }

    setCargando(true);
    setError('');
    try {
      const res = await buscarPedido(q);
      if (res) {
        setPedido(res);
      } else {
        setPedido(null);
        setError('No encontramos ningún pedido registrado con ese código o DNI. Verifica los datos e intenta nuevamente.');
      }
    } catch {
      setError('Ocurrió un error al consultar el sistema. Intenta nuevamente.');
    } finally {
      setCargando(false);
    }
  }, [termino]);

  useEffect(() => {
    if (codigoInicial) {
      realizarBusqueda(codigoInicial);
    }
  }, [codigoInicial, realizarBusqueda]);

  const handleSubmit = (e) => {
    e.preventDefault();
    realizarBusqueda();
  };

  const copiarAlPortapapeles = (texto) => {
    navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const esLima = pedido && (pedido.tipo_envio === 'lima_metropolitana' || pedido.courier === 'motorizado' || Boolean(pedido.distrito_lima));
  const mapaEstados = esLima ? ESTADOS_MAP_LIMA : ESTADOS_MAP_PROVINCIA;
  
  // Resiliencia inteligente: Si es Lima y tiene motorizado asignado, asegurar estado y paso 3
  const estadoBase = (esLima && pedido?.motorizado_asignado && pedido?.estado === 'registrado') ? 'asignado' : (pedido?.estado || 'registrado');
  const estadoInfo = pedido ? (mapaEstados[estadoBase] || mapaEstados.registrado) : null;
  const pasoActual = estadoInfo ? estadoInfo.paso : 1;
  const totalPasos = esLima ? 5 : 6;
  const esEntregado = pasoActual === totalPasos;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-4 sm:py-8 animate-in fade-in duration-300">
      
      {/* Encabezado del Rastreador */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-3 tracking-wide">
          <Truck className="w-3.5 h-3.5" />
          <span>RASTREO EN TIEMPO REAL</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Seguimiento Oficial de Despachos
        </h2>
        <p className="text-neutral-400 text-xs sm:text-sm mt-1.5 max-w-lg mx-auto">
          Ingresa tu código único de tech mood (<span className="text-amber-400 font-mono">TM-XXXXXX</span>) o tu número de DNI para consultar el avance de tu entrega.
        </p>
      </div>

      {/* Buscador Input */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="relative max-w-xl mx-auto">
          <div className="relative flex items-center">
            <Search className="absolute left-4 w-5 h-5 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              value={termino}
              onChange={(e) => {
                setTermino(e.target.value);
                if (error) setError('');
              }}
              placeholder="Ej: TM-784291 o tu DNI"
              className="w-full pl-12 pr-32 py-3.5 bg-neutral-900/90 border border-neutral-700/80 rounded-2xl text-white placeholder-neutral-500 text-sm sm:text-base font-medium focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-xl transition-all"
            />
            <button
              type="submit"
              disabled={cargando}
              className="absolute right-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              {cargando ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Buscando...</span>
                </>
              ) : (
                <>
                  <span>Consultar</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </form>

      {/* RESULTADO: TARJETA DE ESTADO Y TIMELINE */}
      {pedido && (
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-3xl p-5 sm:p-8 backdrop-blur-xl shadow-2xl space-y-8 animate-in fade-in zoom-in-95 duration-200">
          
          {/* Header de la tarjeta */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-800">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Código de Pedido:</span>
                <span className="text-lg sm:text-xl font-mono font-bold text-amber-400">{pedido.codigo_seguimiento}</span>
                <button
                  type="button"
                  onClick={() => copiarAlPortapapeles(pedido.codigo_seguimiento)}
                  className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  title="Copiar código"
                >
                  {copiado ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Registrado para <strong className="text-neutral-200">{pedido.nombre_cliente}</strong> (DNI: {pedido.dni_cliente})
              </p>
            </div>

            {/* Badge de Modalidad */}
            <div className="flex items-center gap-2">
              {esLima ? (
                <span className="px-3.5 py-1.5 rounded-xl border text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-sm">
                  <Bike className="w-4 h-4" />
                  <span>Lima Express (Motorizado)</span>
                </span>
              ) : (
                <span className={`px-3 py-1.5 rounded-xl border text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  pedido.courier === 'shalom'
                    ? 'bg-red-500/15 text-red-400 border-red-500/30'
                    : pedido.courier === 'olva'
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      : 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                }`}>
                  <Package className="w-3.5 h-3.5" />
                  <span>{pedido.courier === 'olva' ? 'Olva Courier' : pedido.courier === 'urbano' ? 'Urbano Express' : 'Shalom Empresarial'}</span>
                </span>
              )}
            </div>
          </div>

          {/* Stepper / Timeline de 5 fases adaptado */}
          <div>
            <h4 className="text-xs uppercase tracking-wider font-semibold text-neutral-400 mb-6">
              Progreso del Despacho {esLima ? '(Entrega Local en Lima)' : '(Envío Nacional)'}
            </h4>
            
            <div className="relative">
              {/* Barra de progreso de fondo */}
              <div className="absolute top-5 left-5 right-5 h-1 bg-neutral-800 rounded-full hidden sm:block">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.max(0, ((pasoActual - 1) / (totalPasos - 1)) * 100))}%` }}
                />
              </div>

              {/* Los pasos dinámicos */}
              {esLima ? (
                /* 5 Pasos para Lima Metropolitana */
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 relative z-10">
                  {/* Paso 1: Registrado */}
                  <div className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-2">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
                      pasoActual >= 1 ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30' : 'bg-neutral-800 text-neutral-400'
                    }`}>
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${pasoActual >= 1 ? 'text-white' : 'text-neutral-500'}`}>1. Registrado</p>
                      <p className="text-[11px] text-neutral-400 hidden sm:block">Recibido en tech mood</p>
                    </div>
                  </div>

                  {/* Paso 2: Preparación */}
                  <div className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-2">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
                      pasoActual >= 2 ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30' : 'bg-neutral-800 text-neutral-400'
                    }`}>
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${pasoActual >= 2 ? 'text-white' : 'text-neutral-500'}`}>2. Preparación</p>
                      <p className="text-[11px] text-neutral-400 hidden sm:block">Almacén y empaque</p>
                    </div>
                  </div>

                  {/* Paso 3: Asignado */}
                  <div className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-2">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
                      pasoActual >= 3 ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30' : 'bg-neutral-800 text-neutral-400'
                    }`}>
                      <Bike className="w-5 h-5" />
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${pasoActual >= 3 ? 'text-white' : 'text-neutral-500'}`}>3. Asignado</p>
                      <p className="text-[11px] text-neutral-400 hidden sm:block">{pedido.motorizado_asignado || 'Turno repartidor'}</p>
                    </div>
                  </div>

                  {/* Paso 4: En Ruta */}
                  <div className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-2">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
                      pasoActual >= 4 ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-neutral-800 text-neutral-400'
                    }`}>
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${pasoActual >= 4 ? 'text-blue-300' : 'text-neutral-500'}`}>4. En Ruta</p>
                      <p className="text-[11px] text-neutral-400 hidden sm:block">Hacia tu domicilio</p>
                    </div>
                  </div>

                  {/* Paso 5: Entregado */}
                  <div className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-2">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
                      pasoActual >= 5 ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/30' : 'bg-neutral-800 text-neutral-400'
                    }`}>
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${pasoActual >= 5 ? 'text-emerald-400' : 'text-neutral-500'}`}>5. Entregado</p>
                      <p className="text-[11px] text-neutral-400 hidden sm:block">En puerta</p>
                    </div>
                  </div>
                </div>
              ) : (
                /* 6 Pasos para Envíos Nacionales / Provincias */
                <div className="grid grid-cols-1 sm:grid-cols-6 gap-2.5 relative z-10">
                  {/* Paso 1: Registrado */}
                  <div className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-1.5">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
                      pasoActual >= 1 ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30' : 'bg-neutral-800 text-neutral-400'
                    }`}>
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${pasoActual >= 1 ? 'text-white' : 'text-neutral-500'}`}>1. Registrado</p>
                      <p className="text-[11px] text-neutral-400 hidden sm:block">Recibido</p>
                    </div>
                  </div>

                  {/* Paso 2: Preparación */}
                  <div className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-1.5">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
                      pasoActual >= 2 ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30' : 'bg-neutral-800 text-neutral-400'
                    }`}>
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${pasoActual >= 2 ? 'text-white' : 'text-neutral-500'}`}>2. Preparación</p>
                      <p className="text-[11px] text-neutral-400 hidden sm:block">Guía y empaque</p>
                    </div>
                  </div>

                  {/* Paso 3: En Origen (NUEVO) */}
                  <div className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-1.5">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
                      pasoActual >= 3 ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/30' : 'bg-neutral-800 text-neutral-400'
                    }`}>
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${pasoActual >= 3 ? 'text-cyan-300' : 'text-neutral-500'}`}>3. En Origen</p>
                      <p className="text-[11px] text-neutral-400 hidden sm:block">En Agencia Lima</p>
                    </div>
                  </div>

                  {/* Paso 4: En Tránsito */}
                  <div className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-1.5">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
                      pasoActual >= 4 ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-neutral-800 text-neutral-400'
                    }`}>
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${pasoActual >= 4 ? 'text-blue-300' : 'text-neutral-500'}`}>4. En Tránsito</p>
                      <p className="text-[11px] text-neutral-400 hidden sm:block">En ruta nacional</p>
                    </div>
                  </div>

                  {/* Paso 5: En Agencia Destino */}
                  <div className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-1.5">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
                      pasoActual >= 5 ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30' : 'bg-neutral-800 text-neutral-400'
                    }`}>
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${pasoActual >= 5 ? 'text-purple-300' : 'text-neutral-500'}`}>5. En Agencia</p>
                      <p className="text-[11px] text-neutral-400 hidden sm:block">Listo para retiro</p>
                    </div>
                  </div>

                  {/* Paso 6: Entregado */}
                  <div className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-1.5">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
                      pasoActual >= 6 ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/30' : 'bg-neutral-800 text-neutral-400'
                    }`}>
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${pasoActual >= 6 ? 'text-emerald-400' : 'text-neutral-500'}`}>6. Entregado</p>
                      <p className="text-[11px] text-neutral-400 hidden sm:block">Con DNI</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Estado actual destacado */}
          <div className="p-4 sm:p-5 rounded-2xl bg-neutral-950/70 border border-neutral-800 flex items-start gap-3.5">
            <div className={`p-2.5 rounded-xl mt-0.5 shrink-0 ${
              esEntregado ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
            }`}>
              {esEntregado ? <CheckCircle2 className="w-5 h-5" /> : esLima ? <Bike className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-semibold text-neutral-400">Estado Oficial:</span>
                <span className={`text-sm font-bold ${
                  esEntregado ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {estadoInfo.titulo}
                </span>
              </div>
              <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                {pedido.estado_detalle || estadoInfo.descripcion}
              </p>
            </div>
          </div>

          {/* EVIDENCIA FOTOGRÁFICA DE ENTREGA (Visible si ya fue entregado y tiene foto) */}
          {pedido.foto_entrega && (
            <div className="p-4 sm:p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs sm:text-sm">
                  <Camera className="w-4 h-4" />
                  <span>Comprobante Fotográfico de Entrega Registrado</span>
                </div>
                <span className="text-[10px] text-neutral-400 font-mono">
                  {pedido.fecha_entregado ? new Date(pedido.fecha_entregado).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>

              <div 
                onClick={() => setVerFotoModal(true)}
                className="relative rounded-2xl overflow-hidden border border-emerald-500/20 bg-black aspect-video max-w-md mx-auto cursor-pointer group shadow-lg"
              >
                <img
                  src={pedido.foto_entrega}
                  alt="Comprobante de entrega"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="px-3 py-1.5 rounded-xl bg-black/80 text-white text-xs font-bold">
                    Ampliar Fotografía
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Información Detallada del Despacho */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            
            {/* Tarjeta 1: Datos de Entrega */}
            <div className="p-4 rounded-2xl bg-neutral-950/50 border border-neutral-800 space-y-2.5">
              <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
                {esLima ? 'Destino de Entrega Express' : 'Datos del Courier'}
              </span>
              
              {esLima ? (
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-white">Distrito: {pedido.distrito_lima || 'Lima'}</p>
                      <p className="text-neutral-300 text-[11px] mt-0.5">{pedido.direccion_entrega || pedido.agencia_direccion}</p>
                    </div>
                  </div>
                  {pedido.referencia_entrega && (
                    <p className="text-neutral-400 text-[11px] pl-6 italic">
                      Ref: {pedido.referencia_entrega}
                    </p>
                  )}
                  {pedido.motorizado_asignado && (
                    <div className="pt-1 text-[11px] text-amber-400 font-semibold pl-6">
                      Repartidor asignado: {pedido.motorizado_asignado}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">N° de Guía Oficial:</span>
                    <span className="font-mono font-bold text-white">
                      {pedido.numero_guia || 'Pendiente de emisión en Shalom Pro'}
                    </span>
                  </div>

                  {pedido.codigo_recojo && (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-amber-300 font-bold text-xs flex items-center gap-1.5">
                          <Key className="w-3.5 h-3.5 text-amber-400" />
                          <span>Código de Seguridad de Recojo:</span>
                        </span>
                        <span className="font-mono font-black text-amber-300 text-sm bg-neutral-950 px-2 py-0.5 rounded border border-amber-500/40 shadow-sm">
                          {pedido.codigo_recojo}
                        </span>
                      </div>
                      <p className="text-[10px] text-amber-400/90 leading-tight">
                        ⚠️ Presenta este código en ventanilla de la agencia Shalom junto a tu DNI físico para retirar tu paquete.
                      </p>
                    </div>
                  )}

                  {pedido.codigo_seguridad && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-400">Clave de Consulta Web:</span>
                      <span className="font-mono font-bold text-neutral-300 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                        {pedido.codigo_seguridad}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Tarjeta 2: Agencia o Fecha */}
            <div className="p-4 rounded-2xl bg-neutral-950/50 border border-neutral-800 space-y-2.5">
              <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
                {esLima ? 'Fecha y Coordinación' : 'Agencia de Recojo'}
              </span>
              
              {!esLima && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-white">{pedido.agencia_nombre}</p>
                    <p className="text-neutral-400 text-[11px] mt-0.5">{pedido.agencia_direccion}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-neutral-800/60">
                <span className="text-neutral-400">Fecha Prevista:</span>
                <span className="font-semibold text-neutral-200">
                  {pedido.fecha_prevista ? (() => {
                    const partes = pedido.fecha_prevista.split('-');
                    if (partes.length === 3) {
                      const d = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
                      return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
                    }
                    return pedido.fecha_prevista;
                  })() : 'En curso'}
                </span>
              </div>
            </div>

          </div>

          {/* Botones de acción inferior */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-neutral-800 text-xs">
            <a
              href={`https://api.whatsapp.com/send?phone=51986601895&text=${encodeURIComponent(`Hola tech mood, consulto sobre el estado de mi pedido ${pedido.codigo_seguimiento}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-neutral-300 hover:text-white transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              <span>¿Tienes dudas? Consultar con soporte tech mood</span>
            </a>

            {onIrAFormulario && (
              <button
                type="button"
                onClick={onIrAFormulario}
                className="text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
              >
                + Registrar otro envío
              </button>
            )}
          </div>

        </div>
      )}

      {/* Modal Visor de Foto Ampliada */}
      {verFotoModal && pedido?.foto_entrega && (
        <div 
          onClick={() => setVerFotoModal(false)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="relative max-w-lg w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-4 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-3">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Evidencia Oficial de Entrega
              </span>
              <button 
                onClick={() => setVerFotoModal(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <img
              src={pedido.foto_entrega}
              alt="Evidencia fotográfica"
              className="w-full max-h-[75vh] object-contain rounded-2xl bg-black"
            />
          </div>
        </div>
      )}

    </div>
  );
};

export default OrderTracking;
