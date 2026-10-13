import { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Calendar, ChevronDown, X, Clock, Check, RotateCcw, 
  Sparkles, Filter, CalendarDays, ArrowRight 
} from 'lucide-react';

// Helper para extraer la fecha local de un pedido (YYYY-MM-DD)
export const obtenerFechaPedidoLocal = (p) => {
  if (p?.creado_en) {
    const d = new Date(p.creado_en);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }
  if (p?.fecha_prevista) {
    return p.fecha_prevista.split('T')[0];
  }
  return null;
};

const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/**
 * FiltroFechaPremium
 * Componente popover profesional para filtrar pedidos por:
 * 1. Presets rápidos (Hoy, Ayer, Últimos 7 días, Últimos 30 días, Este Mes, Mes Anterior)
 * 2. Por Mes específico (ej. Octubre 2026, Setiembre 2026...)
 * 3. Rango Personalizado (Desde YYYY-MM-DD hasta YYYY-MM-DD)
 */
const FiltroFechaPremium = ({
  valor = { tipo: 'todos', mes: '', desde: '', hasta: '', label: 'Todos los períodos' },
  onChange,
  pedidos = [],
  className = ''
}) => {
  const [abierto, setAbierto] = useState(false);
  const [subTab, setSubTab] = useState('rapido'); // 'rapido' | 'mes' | 'rango'
  const popoverRef = useRef(null);

  // Estados temporales para el rango personalizado en edición antes de aplicar
  const [rangoDesde, setRangoDesde] = useState(valor.desde || '');
  const [rangoHasta, setRangoHasta] = useState(valor.hasta || '');

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickAfuera = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setAbierto(false);
      }
    };
    if (abierto) {
      document.addEventListener('mousedown', handleClickAfuera);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickAfuera);
    };
  }, [abierto]);

  // Sincronizar inputs cuando cambie el valor externo
  useEffect(() => {
    if (valor.tipo === 'rango') {
      setRangoDesde(valor.desde || '');
      setRangoHasta(valor.hasta || '');
    }
  }, [valor]);

  // Lista dinámica de meses disponibles basada en los pedidos registrados
  const mesesDisponibles = useMemo(() => {
    const conteoPorMes = {};

    pedidos.forEach((p) => {
      const fecha = obtenerFechaPedidoLocal(p);
      if (fecha && fecha.length >= 7) {
        const mesKey = fecha.slice(0, 7); // 'YYYY-MM'
        conteoPorMes[mesKey] = (conteoPorMes[mesKey] || 0) + 1;
      }
    });

    // Aseguramos que al menos el mes actual esté en la lista
    const ahora = new Date();
    const mesActualKey = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
    if (!conteoPorMes[mesActualKey]) {
      conteoPorMes[mesActualKey] = 0;
    }

    // Ordenar de más reciente a más antiguo
    return Object.keys(conteoPorMes)
      .sort((a, b) => b.localeCompare(a))
      .map((key) => {
        const [yearStr, monthStr] = key.split('-');
        const y = parseInt(yearStr, 10);
        const m = parseInt(monthStr, 10) - 1;
        const nombreMes = NOMBRES_MESES[m] || 'Mes';
        return {
          key,
          label: `${nombreMes} ${y}`,
          total: conteoPorMes[key] || 0
        };
      });
  }, [pedidos]);

  // Helpers de presets
  const seleccionarTodos = () => {
    onChange({ tipo: 'todos', mes: '', desde: '', hasta: '', label: 'Todos los períodos' });
    setAbierto(false);
  };

  const seleccionarPreset = (tipoPreset) => {
    const ahora = new Date();
    const formatearFecha = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const hoyStr = formatearFecha(ahora);

    if (tipoPreset === 'hoy') {
      onChange({
        tipo: 'preset',
        preset: 'hoy',
        desde: hoyStr,
        hasta: hoyStr,
        label: 'Hoy'
      });
    } else if (tipoPreset === 'ayer') {
      const ayer = new Date(ahora);
      ayer.setDate(ahora.getDate() - 1);
      const ayerStr = formatearFecha(ayer);
      onChange({
        tipo: 'preset',
        preset: 'ayer',
        desde: ayerStr,
        hasta: ayerStr,
        label: 'Ayer'
      });
    } else if (tipoPreset === '7dias') {
      const hace7 = new Date(ahora);
      hace7.setDate(ahora.getDate() - 6);
      onChange({
        tipo: 'preset',
        preset: '7dias',
        desde: formatearFecha(hace7),
        hasta: hoyStr,
        label: 'Últimos 7 días'
      });
    } else if (tipoPreset === '30dias') {
      const hace30 = new Date(ahora);
      hace30.setDate(ahora.getDate() - 29);
      onChange({
        tipo: 'preset',
        preset: '30dias',
        desde: formatearFecha(hace30),
        hasta: hoyStr,
        label: 'Últimos 30 días'
      });
    } else if (tipoPreset === 'este_mes') {
      const mesKey = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
      const nombre = `${NOMBRES_MESES[ahora.getMonth()]} ${ahora.getFullYear()}`;
      onChange({
        tipo: 'mes',
        mes: mesKey,
        desde: '',
        hasta: '',
        label: nombre
      });
    } else if (tipoPreset === 'mes_anterior') {
      const mesAnt = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
      const mesKey = `${mesAnt.getFullYear()}-${String(mesAnt.getMonth() + 1).padStart(2, '0')}`;
      const nombre = `${NOMBRES_MESES[mesAnt.getMonth()]} ${mesAnt.getFullYear()}`;
      onChange({
        tipo: 'mes',
        mes: mesKey,
        desde: '',
        hasta: '',
        label: nombre
      });
    }

    setAbierto(false);
  };

  const seleccionarMes = (itemMes) => {
    onChange({
      tipo: 'mes',
      mes: itemMes.key,
      desde: '',
      hasta: '',
      label: itemMes.label
    });
    setAbierto(false);
  };

  const aplicarRango = () => {
    if (!rangoDesde && !rangoHasta) {
      seleccionarTodos();
      return;
    }
    const dDesde = rangoDesde || '2020-01-01';
    const dHasta = rangoHasta || '2099-12-31';
    
    // Etiqueta legible
    let etiqueta = 'Rango personalizado';
    if (rangoDesde && rangoHasta) {
      etiqueta = `${rangoDesde} al ${rangoHasta}`;
    } else if (rangoDesde) {
      etiqueta = `Desde ${rangoDesde}`;
    } else if (rangoHasta) {
      etiqueta = `Hasta ${rangoHasta}`;
    }

    onChange({
      tipo: 'rango',
      mes: '',
      desde: dDesde,
      hasta: dHasta,
      label: etiqueta
    });
    setAbierto(false);
  };

  const tieneFiltroActivo = valor.tipo !== 'todos';

  return (
    <div className={`relative ${className}`} ref={popoverRef}>
      
      {/* BOTÓN DISPARADOR PRINCIPAL */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setAbierto(!abierto)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer select-none ${
            tieneFiltroActivo
              ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-sm shadow-amber-500/20'
              : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700'
          }`}
          title="Filtrar por período temporal"
        >
          <Calendar className={`w-3.5 h-3.5 ${tieneFiltroActivo ? 'text-amber-400' : 'text-neutral-400'}`} />
          <span className="truncate max-w-[170px] sm:max-w-[210px]">
            {valor.label || 'Todos los períodos'}
          </span>
          <ChevronDown className={`w-3 h-3 text-neutral-400 transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`} />
        </button>

        {/* Botón rápido para limpiar filtro (X) */}
        {tieneFiltroActivo && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              seleccionarTodos();
            }}
            className="ml-1 p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors"
            title="Restablecer a todos los períodos"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* POPOVER FLOTANTE GLASSMORPHIC */}
      {abierto && (
        <div 
          className="absolute z-50 mt-2 left-0 sm:right-auto w-[310px] sm:w-[350px] bg-neutral-950/95 border border-neutral-800/90 rounded-2xl p-3.5 shadow-2xl shadow-black/80 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 space-y-3"
          style={{ top: '100%' }}
        >
          {/* Cabecera del Popover */}
          <div className="flex items-center justify-between pb-2 border-b border-neutral-800/80">
            <div className="flex items-center gap-1.5 text-xs font-black text-white">
              <CalendarDays className="w-4 h-4 text-amber-400" />
              <span>Filtrar por Período</span>
            </div>
            {tieneFiltroActivo && (
              <button
                type="button"
                onClick={seleccionarTodos}
                className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
              >
                <RotateCcw className="w-3 h-3" /> Ver Todos
              </button>
            )}
          </div>

          {/* Sub-Pestañas de Navegación */}
          <div className="grid grid-cols-3 gap-1 bg-neutral-900/90 p-1 rounded-xl border border-neutral-800 text-center text-xs font-bold">
            <button
              type="button"
              onClick={() => setSubTab('rapido')}
              className={`py-1.5 px-2 rounded-lg transition-all ${
                subTab === 'rapido'
                  ? 'bg-amber-500 text-black font-extrabold shadow'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Rápido
            </button>
            <button
              type="button"
              onClick={() => setSubTab('mes')}
              className={`py-1.5 px-2 rounded-lg transition-all ${
                subTab === 'mes'
                  ? 'bg-amber-500 text-black font-extrabold shadow'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Por Mes
            </button>
            <button
              type="button"
              onClick={() => setSubTab('rango')}
              className={`py-1.5 px-2 rounded-lg transition-all ${
                subTab === 'rango'
                  ? 'bg-amber-500 text-black font-extrabold shadow'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Rango
            </button>
          </div>

          {/* CONTENIDO 1: PRESETS RÁPIDOS */}
          {subTab === 'rapido' && (
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              {[
                { id: 'todos', label: 'Todos los períodos', fn: seleccionarTodos, activo: valor.tipo === 'todos' },
                { id: 'hoy', label: 'Hoy', fn: () => seleccionarPreset('hoy'), activo: valor.preset === 'hoy' },
                { id: 'ayer', label: 'Ayer', fn: () => seleccionarPreset('ayer'), activo: valor.preset === 'ayer' },
                { id: '7dias', label: 'Últimos 7 días', fn: () => seleccionarPreset('7dias'), activo: valor.preset === '7dias' },
                { id: '30dias', label: 'Últimos 30 días', fn: () => seleccionarPreset('30dias'), activo: valor.preset === '30dias' },
                { id: 'este_mes', label: 'Este Mes', fn: () => seleccionarPreset('este_mes'), activo: valor.tipo === 'mes' && valor.mes === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}` },
                { id: 'mes_anterior', label: 'Mes Anterior', fn: () => seleccionarPreset('mes_anterior'), activo: false }
              ].map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={btn.fn}
                  className={`px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all text-left ${
                    btn.activo
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-extrabold'
                      : 'bg-neutral-900/60 border-neutral-800/80 text-neutral-300 hover:bg-neutral-800 hover:text-white hover:border-neutral-700'
                  }`}
                >
                  <span className="truncate">{btn.label}</span>
                  {btn.activo && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                </button>
              ))}
            </div>
          )}

          {/* CONTENIDO 2: SELECCIÓN POR MES */}
          {subTab === 'mes' && (
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-neutral-800">
              {mesesDisponibles.map((m) => {
                const esActivo = valor.tipo === 'mes' && valor.mes === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => seleccionarMes(m)}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all ${
                      esActivo
                        ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-500/50 text-amber-300 font-extrabold'
                        : 'bg-neutral-900/60 border-neutral-800/80 text-neutral-300 hover:bg-neutral-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className={`w-3.5 h-3.5 ${esActivo ? 'text-amber-400' : 'text-neutral-500'}`} />
                      <span>{m.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono font-bold text-neutral-400 bg-neutral-950 px-2 py-0.5 rounded-lg border border-neutral-800">
                        {m.total} {m.total === 1 ? 'orden' : 'órdenes'}
                      </span>
                      {esActivo && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* CONTENIDO 3: RANGO PERSONALIZADO */}
          {subTab === 'rango' && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-neutral-400 font-bold mb-1">
                  Fecha Desde
                </label>
                <input
                  type="date"
                  value={rangoDesde}
                  onChange={(e) => setRangoDesde(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-neutral-400 font-bold mb-1">
                  Fecha Hasta
                </label>
                <input
                  type="date"
                  value={rangoHasta}
                  onChange={(e) => setRangoHasta(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="button"
                onClick={aplicarRango}
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-extrabold text-xs shadow-md shadow-amber-950/40 hover:opacity-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Aplicar Rango</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Resumen del filtro activo al pie */}
          <div className="pt-2 border-t border-neutral-800/80 text-[11px] text-neutral-400 flex items-center justify-between">
            <span>Período actual:</span>
            <span className="font-bold text-amber-400 font-mono">{valor.label}</span>
          </div>

        </div>
      )}

    </div>
  );
};

export default FiltroFechaPremium;
