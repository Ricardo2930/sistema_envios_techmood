import { useState, useMemo } from 'react';
import { 
  Award, Building2, Bike, 
  CheckCircle2, Clock, Package,
  TrendingUp, Calendar, Flame, Layers, 
  BarChart3, Activity, Info, X
} from 'lucide-react';

const AnalyticsDashboard = ({ pedidos = [] }) => {
  const [periodo, setPeriodo] = useState('todos'); // 'todos' | 'hoy' | 'semana'

  // Estados interactivos para el Gráfico de Barras Apiladas (Lima vs Provincia)
  const [graficoGranularidad, setGraficoGranularidad] = useState('dia'); // 'dia' | 'mes'
  const [graficoRangoDias, setGraficoRangoDias] = useState(14); // 7 | 14 | 30
  const [graficoRangoMeses, setGraficoRangoMeses] = useState(6); // 6 | 12
  const [barraActiva, setBarraActiva] = useState(null); // { key, label, labelFull, total, lima, provincia, pctLima, pctProvincia, entregados, xPct }

  // Helper para identificar si un pedido corresponde a Lima Express
  const esPedidoLima = (p) => {
    return p.tipo_envio === 'lima_metropolitana' || p.courier === 'motorizado' || Boolean(p.distrito_lima);
  };

  // Helper para extraer la fecha local de un pedido (prioridad creado_en, respaldo fecha_prevista)
  const obtenerFechaPedidoLocal = (p) => {
    if (p.creado_en) {
      const d = new Date(p.creado_en);
      if (!isNaN(d.getTime())) {
        // Formato local YYYY-MM-DD
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
    }
    if (p.fecha_prevista) {
      return p.fecha_prevista.split('T')[0];
    }
    return null;
  };

  // Filtrado de pedidos según período (usando fecha local de Perú)
  const pedidosFiltrados = useMemo(() => {
    if (periodo === 'todos') return pedidos;
    
    const ahora = new Date();
    const hoyLocal = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;

    return pedidos.filter((p) => {
      const fechaPedido = obtenerFechaPedidoLocal(p);
      // Si el pedido no tiene ninguna fecha válida y estamos filtrando por tiempo, NO debe incluirse
      if (!fechaPedido) return false;

      if (periodo === 'hoy') {
        return fechaPedido === hoyLocal;
      }
      if (periodo === 'semana') {
        const fechaObj = new Date(fechaPedido + 'T12:00:00');
        const diffMs = ahora.getTime() - fechaObj.getTime();
        const diffDias = diffMs / (1000 * 60 * 60 * 24);
        return diffDias >= 0 && diffDias <= 7;
      }
      return true;
    });
  }, [pedidos, periodo]);

  // ================= CÁLCULO DE KPIS GENERALES =================
  const total = pedidosFiltrados.length;
  const entregados = pedidosFiltrados.filter((p) => p.estado === 'entregado').length;
  const enRuta = pedidosFiltrados.filter((p) => p.estado === 'en_transito').length;
  const pendientes = pedidosFiltrados.filter((p) => 
    p.estado === 'registrado' || p.estado === 'asignado' || p.estado === 'en_preparacion' || p.estado === 'en_origen'
  ).length;
  const incidencias = pedidosFiltrados.filter((p) => p.estado === 'incidencia').length;

  // % de Efectividad de Entrega
  const efectividad = total > 0 ? ((entregados / total) * 100).toFixed(1) : '0.0';

  // Mix de Canales: Provincia vs Lima
  const totalLima = pedidosFiltrados.filter((p) => 
    p.tipo_envio === 'lima_metropolitana' || p.courier === 'motorizado' || p.distrito_lima
  ).length;
  const totalProvincia = total - totalLima;
  const pctLima = total > 0 ? ((totalLima / total) * 100).toFixed(0) : 0;
  const pctProvincia = total > 0 ? ((totalProvincia / total) * 100).toFixed(0) : 0;

  // ================= CÁLCULO DE DATOS Y MÉTRICAS: GRÁFICO DE BARRAS APILADAS =================
  const datosGraficoApilado = useMemo(() => {
    const ahora = new Date();
    const nombresMesesCortos = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];
    const nombresMesesCompletos = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
      'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const diasSemanaCortos = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const diasSemanaCompletos = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    const slots = [];

    if (graficoGranularidad === 'dia') {
      const cantidadDias = Number(graficoRangoDias) || 14;
      for (let i = cantidadDias - 1; i >= 0; i--) {
        const d = new Date(ahora);
        d.setDate(ahora.getDate() - i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const key = `${yyyy}-${mm}-${dd}`;
        const diaSem = diasSemanaCortos[d.getDay()];
        const diaSemFull = diasSemanaCompletos[d.getDay()];
        const mesCorto = nombresMesesCortos[d.getMonth()];
        const mesFull = nombresMesesCompletos[d.getMonth()];

        slots.push({
          key,
          label: `${diaSem} ${dd}`,
          labelFull: `${diaSemFull} ${dd} de ${mesFull}, ${yyyy}`,
          fechaCorta: `${dd} ${mesCorto}`,
          total: 0,
          lima: 0,
          provincia: 0,
          entregados: 0
        });
      }

      pedidos.forEach((p) => {
        const f = obtenerFechaPedidoLocal(p);
        if (!f) return;
        const slot = slots.find((s) => s.key === f);
        if (slot) {
          slot.total += 1;
          if (esPedidoLima(p)) {
            slot.lima += 1;
          } else {
            slot.provincia += 1;
          }
          if (p.estado === 'entregado') {
            slot.entregados += 1;
          }
        }
      });
    } else {
      // Granularidad mensual
      const cantidadMeses = Number(graficoRangoMeses) || 6;
      for (let i = cantidadMeses - 1; i >= 0; i--) {
        const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const key = `${yyyy}-${mm}`;
        const mesCorto = nombresMesesCortos[d.getMonth()];
        const mesFull = nombresMesesCompletos[d.getMonth()];

        slots.push({
          key,
          label: `${mesCorto} '${String(yyyy).slice(2)}`,
          labelFull: `${mesFull} de ${yyyy}`,
          fechaCorta: `${mesCorto} ${yyyy}`,
          total: 0,
          lima: 0,
          provincia: 0,
          entregados: 0
        });
      }

      pedidos.forEach((p) => {
        const f = obtenerFechaPedidoLocal(p);
        if (!f) return;
        const key = f.slice(0, 7); // 'YYYY-MM'
        const slot = slots.find((s) => s.key === key);
        if (slot) {
          slot.total += 1;
          if (esPedidoLima(p)) {
            slot.lima += 1;
          } else {
            slot.provincia += 1;
          }
          if (p.estado === 'entregado') {
            slot.entregados += 1;
          }
        }
      });
    }

    // Cálculos consolidados para el período activo
    let totalPeriodo = 0;
    let totalLimaPeriodo = 0;
    let totalProvinciaPeriodo = 0;
    let totalEntregadosPeriodo = 0;
    let picoMaximo = { total: 0, label: 'Sin registros', labelFull: 'Sin registros', lima: 0, provincia: 0 };
    let maxValor = 0;

    slots.forEach((s) => {
      totalPeriodo += s.total;
      totalLimaPeriodo += s.lima;
      totalProvinciaPeriodo += s.provincia;
      totalEntregadosPeriodo += s.entregados;

      if (s.total > picoMaximo.total) {
        picoMaximo = s;
      }
      if (s.total > maxValor) {
        maxValor = s.total;
      }
    });

    const pctLimaPeriodo = totalPeriodo > 0 ? Math.round((totalLimaPeriodo / totalPeriodo) * 100) : 0;
    const pctProvinciaPeriodo = totalPeriodo > 0 ? Math.round((totalProvinciaPeriodo / totalPeriodo) * 100) : 0;
    const promedioPeriodo = slots.length > 0 ? (totalPeriodo / slots.length).toFixed(1) : '0.0';
    const efectividadPeriodo = totalPeriodo > 0 ? ((totalEntregadosPeriodo / totalPeriodo) * 100).toFixed(1) : '0.0';

    return {
      slots,
      totalPeriodo,
      totalLimaPeriodo,
      totalProvinciaPeriodo,
      pctLimaPeriodo,
      pctProvinciaPeriodo,
      promedioPeriodo,
      efectividadPeriodo,
      picoMaximo,
      maxValor: maxValor > 0 ? maxValor : 5
    };
  }, [pedidos, graficoGranularidad, graficoRangoDias, graficoRangoMeses]);

  // ================= 1. PEDIDOS POR AGENCIA (SHALOM / OLVA / URBANO) =================
  const agenciasStats = useMemo(() => {
    const counts = { shalom: 0, olva: 0, urbano: 0 };
    pedidosFiltrados.forEach((p) => {
      if (p.courier === 'shalom') counts.shalom++;
      else if (p.courier === 'olva') counts.olva++;
      else if (p.courier === 'urbano') counts.urbano++;
    });
    return [
      { nombre: 'Shalom Empresarial', courier: 'shalom', total: counts.shalom, color: '#EF4444' },
      { nombre: 'Olva Courier', courier: 'olva', total: counts.olva, color: '#F59E0B' },
      { nombre: 'Urbano Express', courier: 'urbano', total: counts.urbano, color: '#A855F7' }
    ];
  }, [pedidosFiltrados]);

  // ================= 2. PEDIDOS Y RANKING TOP 5 POR DEPARTAMENTO =================
  const { top5Departamentos } = useMemo(() => {
    // Lista oficial de departamentos del Perú
    const DEPARTAMENTOS_OFICIALES = [
      'Amazonas', 'Áncash', 'Apurímac', 'Arequipa', 'Ayacucho', 
      'Cajamarca', 'Callao', 'Cusco', 'Huancavelica', 'Huánuco', 
      'Ica', 'Junín', 'La Libertad', 'Lambayeque', 'Lima', 
      'Loreto', 'Madre de Dios', 'Moquegua', 'Pasco', 'Piura', 
      'Puno', 'San Martín', 'Tacna', 'Tumbes', 'Ucayali'
    ];

    const normalizarNombre = (texto = '') => {
      if (!texto) return '';
      const limpio = texto.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const match = DEPARTAMENTOS_OFICIALES.find((d) => 
        d.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === limpio
      );
      if (match) return match;
      // Capitalizar si es un nombre propio compuesto (ej: La Libertad)
      return texto.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    };

    const resolverDepartamento = (p) => {
      // 1. Extraer desde agencia_nombre si contiene "/" (Formato Shalom, Olva, Urbano: "Amazonas / Bagua / ...")
      if (p.agencia_nombre && p.agencia_nombre.includes('/')) {
        const parte = p.agencia_nombre.split('/')[0].trim();
        if (parte) return normalizarNombre(parte);
      }

      // 2. Extraer desde agencia_ubigeo si contiene "/" o "-"
      if (p.agencia_ubigeo) {
        if (p.agencia_ubigeo.includes('/')) {
          const parte = p.agencia_ubigeo.split('/')[0].trim();
          if (parte) return normalizarNombre(parte);
        }
        if (p.agencia_ubigeo.includes('-')) {
          const parte = p.agencia_ubigeo.split('-')[0].trim();
          if (parte) return normalizarNombre(parte);
        }
        return normalizarNombre(p.agencia_ubigeo.trim());
      }

      // 3. Extraer desde agencia_nombre si contiene "-"
      if (p.agencia_nombre && p.agencia_nombre.includes('-')) {
        const parts = p.agencia_nombre.split('-');
        if (parts.length > 1) {
          const posible = parts[1].trim().split(' ')[0];
          const match = DEPARTAMENTOS_OFICIALES.find(d => d.toLowerCase() === posible.toLowerCase());
          if (match) return match;
        }
        return normalizarNombre(parts[0].trim());
      }

      // 4. Buscar coincidencias en agencia_direccion
      if (p.agencia_direccion) {
        for (const dep of DEPARTAMENTOS_OFICIALES) {
          const regex = new RegExp(`\\b${dep}\\b`, 'i');
          if (regex.test(p.agencia_direccion)) {
            return dep;
          }
        }
      }

      return 'Otros Destinos';
    };

    const counts = {};
    pedidosFiltrados.forEach((p) => {
      // Solo órdenes de envíos a provincia
      if (p.tipo_envio !== 'lima_metropolitana' && p.courier !== 'motorizado') {
        const depto = resolverDepartamento(p);
        counts[depto] = (counts[depto] || 0) + 1;
      }
    });

    const list = Object.entries(counts).map(([depto, cant]) => ({
      departamento: depto,
      total: cant,
      porcentaje: totalProvincia > 0 ? ((cant / totalProvincia) * 100).toFixed(1) : 0
    })).sort((a, b) => b.total - a.total);

    return {
      departamentosStats: list,
      top5Departamentos: list.slice(0, 5)
    };
  }, [pedidosFiltrados, totalProvincia]);

  // ================= 3. PEDIDOS Y RANKING TOP 5 POR DISTRITOS DE LIMA =================
  const { distritosStats, top5Distritos } = useMemo(() => {
    const counts = {};
    pedidosFiltrados.forEach((p) => {
      if (p.distrito_lima) {
        const dis = p.distrito_lima.trim();
        counts[dis] = (counts[dis] || 0) + 1;
      }
    });

    const list = Object.entries(counts).map(([distrito, cant]) => ({
      distrito,
      total: cant,
      porcentaje: totalLima > 0 ? ((cant / totalLima) * 100).toFixed(1) : 0
    })).sort((a, b) => b.total - a.total);

    return {
      distritosStats: list,
      top5Distritos: list.slice(0, 5)
    };
  }, [pedidosFiltrados, totalLima]);

  // ================= 4. RENDIMIENTO POR MOTORIZADO =================
  const motorizadosStats = useMemo(() => {
    const stats = {
      'Motorizado 1': { asignados: 0, entregados: 0 },
      'Motorizado 2': { asignados: 0, entregados: 0 },
      'Sin Asignar': { asignados: 0, entregados: 0 }
    };

    pedidosFiltrados.forEach((p) => {
      if (p.tipo_envio === 'lima_metropolitana' || p.courier === 'motorizado') {
        const mot = p.motorizado_asignado || 'Sin Asignar';
        if (!stats[mot]) stats[mot] = { asignados: 0, entregados: 0 };
        stats[mot].asignados++;
        if (p.estado === 'entregado') stats[mot].entregados++;
      }
    });

    return Object.entries(stats).map(([nombre, data]) => ({
      nombre,
      asignados: data.asignados,
      entregados: data.entregados,
      efectividad: data.asignados > 0 ? ((data.entregados / data.asignados) * 100).toFixed(0) : 0
    }));
  }, [pedidosFiltrados]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 text-left animate-in fade-in duration-300">
      
      {/* Cabecera y Filtro de Tiempo */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-amber-600/40">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-white">Tablero de Inteligencia & KPIs</h2>
            <span className="text-center px-2.5 py-0.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[11px] font-bold">
              En Tiempo Real
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Métricas de efectividad, rankings geográficos y rendimiento de agencias y motorizados.
          </p>
        </div>

        {/* Selector de Período */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-neutral-900 border border-neutral-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setPeriodo('todos')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              periodo === 'todos' ? 'bg-amber-500 text-black font-extrabold shadow' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Histórico Completo
          </button>
          <button
            type="button"
            onClick={() => setPeriodo('semana')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              periodo === 'semana' ? 'bg-amber-500 text-black font-extrabold shadow' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Últimos 7 Días
          </button>
          <button
            type="button"
            onClick={() => setPeriodo('hoy')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              periodo === 'hoy' ? 'bg-amber-500 text-black font-extrabold shadow' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Hoy
          </button>
        </div>
      </div>

      {/* ================= 4 TARJETAS KPI PRINCIPALES ================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* KPI 1: Total Pedidos */}
        <div className="p-4 sm:p-5 rounded-3xl bg-neutral-900/80 border border-neutral-800 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl" />
          <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-bold block">
            Total Despachos
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-black text-white">{total}</span>
            <span className="text-xs text-neutral-500">órdenes</span>
          </div>
          <div className="mt-2 text-[11px] text-neutral-400 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-amber-400" />
            <span>{totalLima} Lima / {totalProvincia} Provincias</span>
          </div>
        </div>

        {/* KPI 2: % de Efectividad de Entrega */}
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-emerald-950/30 via-neutral-900/80 to-neutral-900/80 border border-emerald-500/30 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
          <span className="text-[11px] uppercase tracking-wider text-emerald-400 font-bold block">
            % Efectividad de Entrega
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-black text-emerald-400">{efectividad}%</span>
            <span className="text-xs text-emerald-500 font-bold">éxito</span>
          </div>
          <div className="mt-2 text-[11px] text-neutral-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{entregados} completados de {total} totales</span>
          </div>
        </div>

        {/* KPI 3: Mix de Negocio (Provincia vs Lima) */}
        <div className="p-4 sm:p-5 rounded-3xl bg-neutral-900/80 border border-neutral-800 backdrop-blur-md relative overflow-hidden">
          <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-bold block">
            Mix de Canales
          </span>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-2xl font-black text-amber-400">{pctLima}% <span className="text-xs font-normal text-neutral-400">Lima</span></span>
            <span className="text-2xl font-black text-blue-400">{pctProvincia}% <span className="text-xs font-normal text-neutral-400">Prov</span></span>
          </div>
          {/* Barra de progreso bicolor */}
          <div className="w-full h-2 rounded-full bg-neutral-800 mt-3 overflow-hidden flex">
            <div style={{ width: `${pctLima}%` }} className="h-full bg-amber-500 transition-all duration-500" />
            <div style={{ width: `${pctProvincia}%` }} className="h-full bg-blue-500 transition-all duration-500" />
          </div>
        </div>

        {/* KPI 4: Flujo en Tránsito y Pendientes */}
        <div className="p-4 sm:p-5 rounded-3xl bg-neutral-900/80 border border-neutral-800 backdrop-blur-md relative overflow-hidden">
          <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-bold block">
            Flujo en Operación
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-black text-blue-400">{enRuta}</span>
            <span className="text-xs text-neutral-400">en ruta activa</span>
          </div>
          <div className="mt-2 text-[11px] text-neutral-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-yellow-400" />
            <span>{pendientes} en preparación / {incidencias} incidencias</span>
          </div>
        </div>

      </div>

      {/* ================= SECCIÓN ESTELAR: GRÁFICO DE BARRAS APILADAS (LIMA VS PROVINCIA) ================= */}
      <div className="p-5 sm:p-6 rounded-3xl bg-neutral-900/90 border border-neutral-800 backdrop-blur-md relative overflow-hidden space-y-6">
        
        {/* Glow de fondo decorativo */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-10 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* 1. CABECERA: TÍTULO, SUBTÍTULO Y SELECTOR DE FILTROS */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shadow-lg shadow-cyan-950/40">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                    Evolución de Envíos: Lima vs Provincia
                  </h3>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <TrendingUp className="w-3 h-3" /> Tendencia Activa
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Comparativa cronológica de demanda entre entregas locales y despachos nacionales
                </p>
              </div>
            </div>
          </div>

          {/* CONTROLES DE FILTRADO TEMPORAL INTEGRADOS */}
          <div className="flex flex-wrap items-center gap-2 bg-neutral-950/80 p-1.5 rounded-2xl border border-neutral-800 self-start lg:self-auto">
            {/* Switch Granularidad: Por Día / Por Mes */}
            <div className="flex items-center bg-neutral-900/90 rounded-xl p-0.5 border border-neutral-800/80">
              <button
                type="button"
                onClick={() => {
                  setGraficoGranularidad('dia');
                  setBarraActiva(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  graficoGranularidad === 'dia'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-950 font-extrabold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Por Día
              </button>
              <button
                type="button"
                onClick={() => {
                  setGraficoGranularidad('mes');
                  setBarraActiva(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  graficoGranularidad === 'mes'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-950 font-extrabold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Por Mes
              </button>
            </div>

            {/* Sub-filtros dinámicos según granularidad */}
            {graficoGranularidad === 'dia' ? (
              <div className="flex items-center gap-1">
                {[7, 14, 30].map((dias) => (
                  <button
                    key={dias}
                    type="button"
                    onClick={() => {
                      setGraficoRangoDias(dias);
                      setBarraActiva(null);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                      graficoRangoDias === dias
                        ? 'bg-amber-500 text-black font-black shadow'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                    }`}
                  >
                    {dias}d
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-1">
                {[
                  { valor: 6, label: '6m' },
                  { valor: 12, label: '12m' }
                ].map((item) => (
                  <button
                    key={item.valor}
                    type="button"
                    onClick={() => {
                      setGraficoRangoMeses(item.valor);
                      setBarraActiva(null);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                      graficoRangoMeses === item.valor
                        ? 'bg-amber-500 text-black font-black shadow'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 2. FILA DE 4 TARJETAS CON VALORES PRINCIPALES DEL GRÁFICO */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Total Período */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800/80 relative overflow-hidden">
            <div className="flex items-center justify-between text-neutral-400 text-[11px] font-bold uppercase tracking-wider">
              <span>Total Período</span>
              <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-white">
                {datosGraficoApilado.totalPeriodo}
              </span>
              <span className="text-xs text-neutral-500 font-medium">despachos</span>
            </div>
            <p className="mt-1 text-[11px] text-neutral-400 truncate">
              {graficoGranularidad === 'dia' ? `Últimos ${graficoRangoDias} días` : `Últimos ${graficoRangoMeses} meses`}
            </p>
          </div>

          {/* Card 2: Mix de Canales */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800/80 relative overflow-hidden">
            <div className="flex items-center justify-between text-neutral-400 text-[11px] font-bold uppercase tracking-wider">
              <span>Mix de Canales</span>
              <Layers className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-black text-cyan-400">
                {datosGraficoApilado.pctLimaPeriodo}%
              </span>
              <span className="text-xs text-neutral-500 font-bold">vs</span>
              <span className="text-xl sm:text-2xl font-black text-amber-400">
                {datosGraficoApilado.pctProvinciaPeriodo}%
              </span>
            </div>
            <p className="mt-1 text-[11px] text-neutral-400 truncate">
              <span className="text-cyan-300 font-semibold">{datosGraficoApilado.totalLimaPeriodo} Lima</span> · <span className="text-amber-300 font-semibold">{datosGraficoApilado.totalProvinciaPeriodo} Prov</span>
            </p>
          </div>

          {/* Card 3: Pico Máximo de Demanda */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800/80 relative overflow-hidden">
            <div className="flex items-center justify-between text-neutral-400 text-[11px] font-bold uppercase tracking-wider">
              <span>Pico Máximo</span>
              <Flame className="w-3.5 h-3.5 text-orange-400" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-orange-400">
                {datosGraficoApilado.picoMaximo.total}
              </span>
              <span className="text-xs text-neutral-500 font-medium">órdenes</span>
            </div>
            <p className="mt-1 text-[11px] text-neutral-400 truncate">
              {datosGraficoApilado.picoMaximo.labelFull || 'Sin registros'}
            </p>
          </div>

          {/* Card 4: Promedio de Despachos */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800/80 relative overflow-hidden">
            <div className="flex items-center justify-between text-neutral-400 text-[11px] font-bold uppercase tracking-wider">
              <span>Promedio Ritmo</span>
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-emerald-400">
                {datosGraficoApilado.promedioPeriodo}
              </span>
              <span className="text-xs text-neutral-500 font-medium">/ {graficoGranularidad === 'dia' ? 'día' : 'mes'}</span>
            </div>
            <p className="mt-1 text-[11px] text-neutral-400 truncate">
              Efectividad: <span className="text-emerald-400 font-semibold">{datosGraficoApilado.efectividadPeriodo}%</span>
            </p>
          </div>
        </div>

        {/* 3. CONTENEDOR DEL GRÁFICO SVG CON TOOLTIP PROFESIONAL */}
        <div className="relative pt-2">
          
          {/* TOOLTIP FLOTANTE GLASSMORPHIC PROFESIONAL CON SMART CLAMPING RESPONSIVO */}
          {barraActiva && (() => {
            const pos = barraActiva.posPct || 50;
            const isRightSide = pos > 50;
            const clampedDesktop = Math.max(16, Math.min(84, pos));

            return (
              <div 
                className={`absolute z-30 pointer-events-auto transition-all duration-200 ${
                  isRightSide 
                    ? 'right-2 sm:right-auto sm:left-[var(--tooltip-x)] sm:-translate-x-1/2' 
                    : 'left-2 sm:left-[var(--tooltip-x)] sm:-translate-x-1/2'
                }`}
                style={{
                  '--tooltip-x': `${clampedDesktop}%`,
                  top: '-8px'
                }}
              >
                <div className="bg-neutral-950/95 border border-cyan-500/40 rounded-2xl p-3 sm:p-3.5 shadow-2xl shadow-cyan-950/80 backdrop-blur-xl w-[265px] sm:w-64 max-w-[calc(100vw-3.2rem)] text-xs text-white space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                  
                  {/* Cabecera del Tooltip */}
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                    <div className="flex items-center gap-1.5 min-w-0 pr-1">
                      <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="font-bold text-neutral-200 truncate">{barraActiva.labelFull}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBarraActiva(null)}
                      className="text-neutral-500 hover:text-white p-0.5 rounded transition shrink-0 cursor-pointer"
                      title="Cerrar detalle"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Total Despachos:</span>
                    <span className="font-mono font-black text-base text-white">
                      {barraActiva.total} <span className="text-[10px] text-neutral-400 font-normal">pedidos</span>
                    </span>
                  </div>

                  {/* Barra Mini Proporcional */}
                  {barraActiva.total > 0 && (
                    <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden flex">
                      <div 
                        style={{ width: `${Math.round((barraActiva.lima / barraActiva.total) * 100)}%` }} 
                        className="h-full bg-cyan-400" 
                      />
                      <div 
                        style={{ width: `${Math.round((barraActiva.provincia / barraActiva.total) * 100)}%` }} 
                        className="h-full bg-amber-400" 
                      />
                    </div>
                  )}

                  {/* Detalle Segmentado */}
                  <div className="space-y-1.5 pt-0.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50" />
                        <span className="text-neutral-300">Lima Express</span>
                      </div>
                      <div className="font-mono font-bold text-cyan-300">
                        {barraActiva.lima} <span className="text-[10px] text-neutral-500">({barraActiva.total > 0 ? Math.round((barraActiva.lima / barraActiva.total) * 100) : 0}%)</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50" />
                        <span className="text-neutral-300">Envíos Provincia</span>
                      </div>
                      <div className="font-mono font-bold text-amber-300">
                        {barraActiva.provincia} <span className="text-[10px] text-neutral-500">({barraActiva.total > 0 ? Math.round((barraActiva.provincia / barraActiva.total) * 100) : 0}%)</span>
                      </div>
                    </div>
                  </div>

                  {/* Tasa de entregados */}
                  <div className="border-t border-neutral-800/80 pt-2 flex items-center justify-between text-[11px] text-neutral-400">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="w-3 h-3 shrink-0" /> Entregados:
                    </span>
                    <span className="font-mono font-bold text-emerald-300">
                      {barraActiva.entregados} de {barraActiva.total}
                    </span>
                  </div>

                </div>
              </div>
            );
          })()}

          {/* ÁREA SCROLLABLE DEL SVG PARA MOBILE */}
          <div className="w-full overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-neutral-800">
            <div className="min-w-[580px] sm:min-w-full">
              {/* RENDERIZADO DEL SVG */}
              {(() => {
                const svgWidth = 900;
                const svgHeight = 240;
                const marginLeft = 40;
                const marginRight = 20;
                const marginTop = 28;
                const marginBottom = 36;
                const plotWidth = svgWidth - marginLeft - marginRight;
                const plotHeight = svgHeight - marginTop - marginBottom;
                const maxVal = datosGraficoApilado.maxValor;
                const slots = datosGraficoApilado.slots;
                const numSlots = slots.length;
                const slotWidth = plotWidth / numSlots;
                const barWidth = Math.min(36, Math.max(12, slotWidth * 0.62));

                // 4 líneas guía horizontales
                const lineasGuia = [0, 0.33, 0.66, 1].map((pct) => ({
                  y: marginTop + plotHeight - pct * plotHeight,
                  valor: Math.round(pct * maxVal)
                }));

                return (
                  <svg
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    className="w-full h-auto select-none overflow-visible"
                  >
                    <defs>
                      {/* Gradiente Lima Express (Cyan/Sky) */}
                      <linearGradient id="gradLima" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity="1" />
                        <stop offset="100%" stopColor="#0891b2" stopOpacity="0.85" />
                      </linearGradient>

                      {/* Gradiente Provincia (Amber/Orange) */}
                      <linearGradient id="gradProv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fbbf24" stopOpacity="1" />
                        <stop offset="100%" stopColor="#d97706" stopOpacity="0.85" />
                      </linearGradient>

                      {/* Filtro de Resplandor Neon */}
                      <filter id="glowLima" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#06b6d4" floodOpacity="0.6" />
                      </filter>
                      <filter id="glowProv" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#f59e0b" floodOpacity="0.6" />
                      </filter>
                    </defs>

                    {/* LÍNEAS DE REFERENCIA HORIZONTALES */}
                    {lineasGuia.map((g, i) => (
                      <g key={i}>
                        <line
                          x1={marginLeft}
                          y1={g.y}
                          x2={svgWidth - marginRight}
                          y2={g.y}
                          stroke="#262626"
                          strokeDasharray={i === 0 ? '0' : '4 4'}
                          strokeWidth="1"
                        />
                        <text
                          x={marginLeft - 8}
                          y={g.y + 3.5}
                          textAnchor="end"
                          fill="#737373"
                          fontSize="10"
                          fontFamily="monospace"
                        >
                          {g.valor}
                        </text>
                      </g>
                    ))}

                    {/* COLUMNAS Y BARRAS APILADAS */}
                    {slots.map((slot, i) => {
                      const xCenter = marginLeft + (i + 0.5) * slotWidth;
                      const xBar = xCenter - barWidth / 2;
                      const isHover = barraActiva?.key === slot.key;

                      // Alturas proporcionales
                      const hLima = maxVal > 0 ? (slot.lima / maxVal) * plotHeight : 0;
                      const hProv = maxVal > 0 ? (slot.provincia / maxVal) * plotHeight : 0;

                      const yLima = marginTop + plotHeight - hLima;
                      const yProv = yLima - hProv;

                      // Porcentaje horizontal en el viewBox para el tooltip flotante
                      const posPct = ((xCenter) / svgWidth) * 100;

                      return (
                        <g
                          key={slot.key}
                          className="cursor-pointer transition-all duration-150"
                          onMouseEnter={() => setBarraActiva({ ...slot, posPct })}
                          onClick={() => setBarraActiva({ ...slot, posPct })}
                          onTouchStart={() => setBarraActiva({ ...slot, posPct })}
                        >
                          {/* Área de interacción transparente y fondo iluminado en hover */}
                          <rect
                            x={xCenter - slotWidth / 2}
                            y={marginTop}
                            width={slotWidth}
                            height={plotHeight}
                            fill={isHover ? '#ffffff' : 'transparent'}
                            opacity={isHover ? 0.04 : 0}
                            rx="6"
                          />

                          {/* Línea vertical de tracking en hover */}
                          {isHover && (
                            <line
                              x1={xCenter}
                              y1={marginTop}
                              x2={xCenter}
                              y2={marginTop + plotHeight}
                              stroke="#06b6d4"
                              strokeDasharray="2 2"
                              strokeWidth="1"
                              opacity="0.5"
                            />
                          )}

                          {/* 1. SEGMENTO LIMA EXPRESS (BASE) */}
                          {slot.lima > 0 && (
                            <rect
                              x={xBar}
                              y={yLima}
                              width={barWidth}
                              height={hLima}
                              fill="url(#gradLima)"
                              rx={slot.provincia === 0 ? '4' : '0'}
                              filter={isHover ? 'url(#glowLima)' : undefined}
                              className="transition-all duration-300"
                            />
                          )}

                          {/* 2. SEGMENTO PROVINCIA (PARTE SUPERIOR) */}
                          {slot.provincia > 0 && (
                            <rect
                              x={xBar}
                              y={yProv}
                              width={barWidth}
                              height={hProv}
                              fill="url(#gradProv)"
                              rx="4"
                              filter={isHover ? 'url(#glowProv)' : undefined}
                              className="transition-all duration-300"
                            />
                          )}

                          {/* Si ambos están vacíos, base sutil */}
                          {slot.total === 0 && (
                            <circle
                              cx={xCenter}
                              cy={marginTop + plotHeight - 3}
                              r="2"
                              fill="#404040"
                              opacity="0.6"
                            />
                          )}

                          {/* VALOR NUMÉRICO TOTAL SOBRE LA BARRA */}
                          {slot.total > 0 && (
                            <text
                              x={xCenter}
                              y={yProv - 6}
                              textAnchor="middle"
                              fill={isHover ? '#ffffff' : '#a3a3a3'}
                              fontSize={barWidth < 18 ? '9' : '10'}
                              fontWeight={isHover ? '900' : '700'}
                              fontFamily="monospace"
                            >
                              {slot.total}
                            </text>
                          )}

                          {/* ETIQUETA EJE X (FECHA / MES) */}
                          <text
                            x={xCenter}
                            y={marginTop + plotHeight + 18}
                            textAnchor="middle"
                            fill={isHover ? '#38bdf8' : '#737373'}
                            fontSize={numSlots > 14 ? '9' : '10'}
                            fontWeight={isHover ? '800' : '500'}
                            transform={numSlots > 18 ? `rotate(-30, ${xCenter}, ${marginTop + plotHeight + 18})` : undefined}
                          >
                            {slot.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                );
              })()}
            </div>
          </div>
        </div>

        {/* 4. LEYENDA INFERIOR E INDICADORES DE CONTEXTO */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-neutral-800/80 text-xs text-neutral-400">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-md bg-gradient-to-r from-cyan-400 to-cyan-500 shadow-sm shadow-cyan-400/50" />
              <span className="font-semibold text-neutral-200">Lima Express</span>
              <span className="text-neutral-500 font-mono">({datosGraficoApilado.totalLimaPeriodo})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-md bg-gradient-to-r from-amber-400 to-amber-500 shadow-sm shadow-amber-400/50" />
              <span className="font-semibold text-neutral-200">Envíos Provincia</span>
              <span className="text-neutral-500 font-mono">({datosGraficoApilado.totalProvinciaPeriodo})</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-neutral-500">
            <Info className="w-3.5 h-3.5 text-neutral-400" />
            <span>Pasa el cursor o presiona una barra para inspeccionar el desglose detallado.</span>
          </div>
        </div>

      </div>

      {/* ================= FILA 1: RANKINGS TOP 5 (PROVINCIAS VS DISTRITOS LIMA) ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* RANKING TOP 5 POR DEPARTAMENTO */}
        <div className="p-5 sm:p-6 rounded-3xl bg-neutral-900/90 border border-neutral-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Ranking Top 5 por Departamento</h3>
                <p className="text-xs text-neutral-400">Destinos nacionales con mayor volumen de envíos</p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-blue-400">
              {totalProvincia} envíos nac.
            </span>
          </div>

          <div className="space-y-3">
            {top5Departamentos.length === 0 ? (
              <p className="text-xs text-neutral-500 text-center py-6">No hay datos de envíos a provincias en este período.</p>
            ) : (
              top5Departamentos.map((item, idx) => {
                const maxVal = top5Departamentos[0]?.total || 1;
                const barraPct = Math.round((item.total / maxVal) * 100);
                const medallas = ['🥇', '🥈', '🥉', '4°', '5°'];

                return (
                  <div key={item.departamento} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{medallas[idx]}</span>
                        <span className="text-white">{item.departamento}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-400">{item.total} envíos</span>
                        <span className="text-amber-400 font-mono font-bold">({item.porcentaje}%)</span>
                      </div>
                    </div>
                    <div className="w-full h-2 rounded-full bg-neutral-950 overflow-hidden">
                      <div
                        style={{ width: `${barraPct}%` }}
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RANKING TOP 5 POR DISTRITOS DE LIMA METROPOLITANA */}
        <div className="p-5 sm:p-6 rounded-3xl bg-neutral-900/90 border border-neutral-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
                <Bike className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Ranking Top 5 Distritos de Lima</h3>
                <p className="text-xs text-neutral-400">Demanda express atendida por los motorizados</p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-amber-400">
              {totalLima} envíos Lima
            </span>
          </div>

          <div className="space-y-3">
            {top5Distritos.length === 0 ? (
              <p className="text-xs text-neutral-500 text-center py-6">No hay datos de envíos en Lima en este período.</p>
            ) : (
              top5Distritos.map((item, idx) => {
                const maxVal = top5Distritos[0]?.total || 1;
                const barraPct = Math.round((item.total / maxVal) * 100);
                const medallas = ['🥇', '🥈', '🥉', '4°', '5°'];

                return (
                  <div key={item.distrito} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{medallas[idx]}</span>
                        <span className="text-white">{item.distrito}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-400">{item.total} entregas</span>
                        <span className="text-amber-400 font-mono font-bold">({item.porcentaje}%)</span>
                      </div>
                    </div>
                    <div className="w-full h-2 rounded-full bg-neutral-950 overflow-hidden">
                      <div
                        style={{ width: `${barraPct}%` }}
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* ================= FILA 2: PEDIDOS POR AGENCIA & RENDIMIENTO MOTORIZADOS ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* PEDIDOS POR AGENCIA (SHALOM / OLVA / URBANO) */}
        <div className="p-5 sm:p-6 rounded-3xl bg-neutral-900/90 border border-neutral-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-neutral-800 text-neutral-300">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Pedidos por Agencia Courier</h3>
                <p className="text-xs text-neutral-400">Distribución de carga por operador logístico nacional</p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-neutral-400">
              {totalProvincia} envíos nac.
            </span>
          </div>

          <div className="space-y-3.5">
            {totalProvincia === 0 ? (
              <p className="text-xs text-neutral-500 text-center py-6">No hay datos de envíos a provincias en este período.</p>
            ) : (
              agenciasStats.map((item) => {
                const maxAgencia = Math.max(...agenciasStats.map((a) => a.total), 1);
                const barraPct = Math.round((item.total / maxAgencia) * 100);

                return (
                  <div key={item.courier} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        {item.nombre}
                      </span>
                      <span className="font-mono font-bold text-neutral-200">
                        {item.total} pedidos ({totalProvincia > 0 ? ((item.total / totalProvincia) * 100).toFixed(0) : 0}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-neutral-950 overflow-hidden">
                      <div
                        style={{ width: `${barraPct}%`, backgroundColor: item.color }}
                        className="h-full rounded-full transition-all duration-500"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RENDIMIENTO Y CARGA POR MOTORIZADO */}
        <div className="p-5 sm:p-6 rounded-3xl bg-neutral-900/90 border border-neutral-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
                <Bike className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Rendimiento por Motorizado</h3>
                <p className="text-xs text-neutral-400">Balance operativo y tasa de cierre de tus dos repartidores</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {motorizadosStats
              .filter((m) => m.nombre !== 'Sin Asignar')
              .map((mot) => (
                <div key={mot.nombre} className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-white text-sm">🛵 {mot.nombre}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      {mot.efectividad}% efectividad
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                    <div>
                      <span className="text-neutral-500 text-[10px] uppercase block">Asignados</span>
                      <span className="text-lg font-bold text-white">{mot.asignados}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 text-[10px] uppercase block">Entregados</span>
                      <span className="text-lg font-bold text-emerald-400">{mot.entregados}</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>

          {/* Pedidos sin asignar */}
          {motorizadosStats.find((m) => m.nombre === 'Sin Asignar')?.asignados > 0 && (
            <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs flex items-center justify-between">
              <span>⚠️ Pedidos de Lima pendientes de asignación a un motorizado:</span>
              <span className="font-bold font-mono">
                {motorizadosStats.find((m) => m.nombre === 'Sin Asignar')?.asignados} órdenes
              </span>
            </div>
          )}
        </div>

      </div>

      {/* ================= TABLA RESUMEN COMPLETO DE DISTRITOS DE LIMA ================= */}
      <div className="p-5 sm:p-6 rounded-3xl bg-neutral-900/90 border border-neutral-800 space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div>
            <h3 className="text-base font-extrabold text-white">Detalle de Cobertura en Lima Metropolitana</h3>
            <p className="text-xs text-neutral-400">Listado consolidado de pedidos registrados por distrito</p>
          </div>
          <span className="text-xs text-neutral-400 font-mono">
            {distritosStats.length} distritos con actividad
          </span>
        </div>

        {distritosStats.length === 0 ? (
          <p className="text-xs text-neutral-500 text-center py-4">No se han registrado entregas en distritos de Lima aún.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-1">
            {distritosStats.map((d) => (
              <div key={d.distrito} className="p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800 flex items-center justify-between text-xs">
                <span className="text-neutral-200 font-medium truncate">{d.distrito}</span>
                <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg ml-2">
                  {d.total}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default AnalyticsDashboard;
