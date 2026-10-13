import { useState, useMemo } from 'react';
import { 
  Award, Building2, Bike, 
  CheckCircle2, Clock, Package
} from 'lucide-react';

const AnalyticsDashboard = ({ pedidos = [] }) => {
  const [periodo, setPeriodo] = useState('todos'); // 'todos' | 'hoy' | 'semana'

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
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[11px] font-bold">
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
            <span className="text-xs font-mono font-bold text-neutral-400">
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
            <span className="text-xs font-mono font-bold text-neutral-400">
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
