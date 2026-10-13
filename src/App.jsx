import { useState } from 'react';
import DatePicker from 'react-datepicker';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import AgencySearch from './components/AgencySearch';
import DistrictSearch from './components/DistrictSearch';
import OrderTracking from './components/OrderTracking';
import AdminDashboard from './components/AdminDashboard';
import { crearPedido } from './services/pedidosService';
import { 
  Calendar, User, Phone, IdCard, CheckCircle2, Check,
  Package, MessageCircle, ArrowRight,
  ShieldCheck, AlertCircle, ArrowLeft, Search,
  Truck, Bike, MapPin
} from 'lucide-react';
import 'react-datepicker/dist/react-datepicker.css';

// Número comercial oficial de tech mood
const NUMERO_WHATSAPP_TECHMOOD = '51986601895';

function App() {
  const [vista, setVista] = useState('formulario'); // 'formulario' | 'rastreo' | 'admin'
  const [codigoTrackingParaConsultar, setCodigoTrackingParaConsultar] = useState('');
  const [pedidoGuardado, setPedidoGuardado] = useState(null);
  const [guardandoPedido, setGuardandoPedido] = useState(false);
  const [step, setStep] = useState(1);
  
  // Modalidad de Envío: 'provincia' (Agencias) vs 'lima_metropolitana' (Motorizado)
  const [tipoEnvio, setTipoEnvio] = useState('provincia');
  const [empresa, setEmpresa] = useState('shalom'); // 'shalom' | 'olva' | 'urbano'
  const [errorMsg, setErrorMsg] = useState('');
  
  const [formData, setFormData] = useState({
    whatsapp: '',
    dni: '',
    nombre: '',
    agencia: null,
    distritoLima: '',
    direccionEntrega: '',
    referenciaEntrega: '',
    metodoPago: 'contraentrega',
    fecha: null
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Validación amigable para DNI (máx 12 caracteres alfanuméricos)
    if (name === 'dni') {
      const cleanValue = value.replace(/[^0-9a-zA-Z]/g, '').slice(0, 12);
      setFormData({ ...formData, dni: cleanValue });
      return;
    }
    // Validación amigable para teléfono
    if (name === 'whatsapp') {
      const cleanValue = value.replace(/[^0-9+\s-]/g, '').slice(0, 15);
      setFormData({ ...formData, whatsapp: cleanValue });
      return;
    }
    setFormData({ ...formData, [name]: value });
    if (errorMsg) setErrorMsg('');
  };

  const handleAgencySelect = (agency) => {
    setFormData((prev) => ({ ...prev, agencia: agency }));
    if (errorMsg) setErrorMsg('');
  };

  const handleDateChange = (date) => {
    setFormData((prev) => ({ ...prev, fecha: date }));
    if (errorMsg) setErrorMsg('');
  };

  const handleEmpresaChange = (nuevaEmpresa) => {
    if (nuevaEmpresa === empresa) return;
    setEmpresa(nuevaEmpresa);
    setFormData((prev) => ({ ...prev, agencia: null }));
    if (errorMsg) setErrorMsg('');
  };

  const handleCambiarTipoEnvio = (tipo) => {
    if (tipo === tipoEnvio) return;
    setTipoEnvio(tipo);
    setErrorMsg('');
  };

  // Validadores estrictos pero ultra-ligeros (RegEx nativos)
  const isWhatsAppValid = (val) => {
    const clean = val.replace(/\D/g, '');
    return (clean.length === 9 && clean.startsWith('9')) || 
           (clean.length === 11 && clean.startsWith('519'));
  };

  const isDniValid = (val) => {
    const clean = val.trim();
    return /^\d{8}$/.test(clean) || /^[a-zA-Z0-9]{9,12}$/.test(clean);
  };

  const isNombreValid = (val) => {
    const clean = val.trim();
    const words = clean.split(/\s+/).filter(Boolean);
    const onlyLetters = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/.test(clean);
    return onlyLetters && words.length >= 2 && clean.length >= 5;
  };

  const isDireccionValid = (val) => {
    return val && val.trim().length >= 6;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    // Validación según modalidad
    if (tipoEnvio === 'provincia') {
      if (!formData.agencia) {
        const nombreCourier = empresa === 'olva' ? 'Olva Courier' : empresa === 'urbano' ? 'Urbano Express' : 'Shalom';
        setErrorMsg(`Por favor busca y selecciona una agencia de ${nombreCourier}.`);
        return;
      }
    } else {
      if (!formData.distritoLima) {
        setErrorMsg('Por favor selecciona el distrito de Lima Metropolitana para el despacho.');
        return;
      }
      if (!isDireccionValid(formData.direccionEntrega)) {
        setErrorMsg('Por favor ingresa tu dirección exacta de entrega (calle, número, dpto o mz).');
        return;
      }
    }

    if (!formData.fecha) {
      setErrorMsg('Por favor selecciona la fecha prevista para el envío.');
      return;
    }
    if (!isWhatsAppValid(formData.whatsapp)) {
      setErrorMsg('Por favor ingresa un número de WhatsApp peruano válido (9 dígitos comenzando con 9).');
      return;
    }
    if (!isDniValid(formData.dni)) {
      setErrorMsg('El DNI debe contener exactamente 8 dígitos numéricos (o CE de 9 a 12 caracteres).');
      return;
    }
    if (!isNombreValid(formData.nombre)) {
      setErrorMsg('Por favor ingresa Nombre y Apellidos completos del destinatario (mínimo 2 palabras).');
      return;
    }

    // Paso a la vista de revisión SIN guardar en base de datos aún
    setStep(2);
  };

  // Genera el mensaje formateado para WhatsApp
  const generarMensajeWhatsApp = (ordenActual) => {
    const { whatsapp, dni, nombre, agencia, distritoLima, direccionEntrega, referenciaEntrega, fecha } = formData;
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const anio = fecha.getFullYear();
    const fechaFormateada = `${dia}/${mes}/${anio}`;

    const codigo = ordenActual?.codigo_seguimiento || pedidoGuardado?.codigo_seguimiento || 'Registrado';

    if (tipoEnvio === 'lima_metropolitana') {
      const lineas = [
        "*NUEVO ENVÍO EXPRESS LIMA METROPOLITANA - TECH MOOD*",
        "----------------------------------------",
        `• *Código de Seguimiento:* ${codigo}`,
        `• *Modalidad:* Entrega a Domicilio (Motorizado)`,
        `• *Cliente:* ${nombre.trim()}`,
        `• *WhatsApp Cliente:* ${whatsapp.trim()}`,
        `• *DNI / Documento:* ${dni.trim()}`,
        "",
        `• *Distrito:* ${distritoLima}`,
        `• *Dirección:* ${direccionEntrega.trim()}`,
        referenciaEntrega?.trim() ? `• *Referencia:* ${referenciaEntrega.trim()}` : "",
        "",
        `• *Fecha de Despacho:* ${fechaFormateada}`,
        "----------------------------------------",
        "_Por favor confirmar la recepción para programar la ruta del motorizado._"
      ].filter(Boolean);

      return lineas.join('\n');
    }

    // Modalidad Provincia (Agencias)
    const nombreEmpresa = 
      empresa === 'olva' 
        ? 'OLVA COURIER' 
        : empresa === 'urbano' 
          ? 'URBANO EXPRESS' 
          : 'SHALOM EMPRESARIAL';

    const lineas = [
      "*NUEVO ENVÍO NACIONAL - TECH MOOD*",
      "----------------------------------------",
      `• *Código de Seguimiento:* ${codigo}`,
      `• *Courier:* ${nombreEmpresa}`,
      `• *Cliente:* ${nombre.trim()}`,
      `• *WhatsApp Cliente:* ${whatsapp.trim()}`,
      `• *DNI / Documento:* ${dni.trim()}`,
      "",
      `• *Agencia de Recojo:* ${agencia?.Agencia}`,
      `• *Dirección Agencia:* ${agencia?.Direccion}`,
      "",
      `• *Fecha de Envío:* ${fechaFormateada}`,
      "----------------------------------------",
      "_Por favor confirmar la recepción de los datos para el despacho._"
    ];

    return lineas.join('\n');
  };

  // Crea la orden en la BD/panel por única vez y abre WhatsApp
  const handleConfirmarYEnviarWhatsApp = async () => {
    setErrorMsg('');
    let orden = pedidoGuardado;

    // Si aún no se ha creado la orden, crearla ahora
    if (!orden) {
      setGuardandoPedido(true);
      try {
        const esLima = tipoEnvio === 'lima_metropolitana';
        const fechaSql = `${formData.fecha.getFullYear()}-${String(formData.fecha.getMonth() + 1).padStart(2, '0')}-${String(formData.fecha.getDate()).padStart(2, '0')}`;

        orden = await crearPedido({
          tipo_envio: tipoEnvio,
          nombre_cliente: formData.nombre,
          dni_cliente: formData.dni,
          telefono_cliente: formData.whatsapp,
          courier: esLima ? 'motorizado' : empresa,
          agencia_nombre: esLima ? `Domicilio - ${formData.distritoLima}` : (formData.agencia?.Agencia || ''),
          agencia_direccion: esLima ? formData.direccionEntrega : (formData.agencia?.Direccion || ''),
          agencia_ubigeo: esLima 
            ? `Lima - ${formData.distritoLima}` 
            : (formData.agencia?.Departamento 
                ? `${formData.agencia.Departamento} - ${formData.agencia?.Provincia || ''}`
                : ((formData.agencia?.Agencia || '').includes('/') 
                    ? `${(formData.agencia.Agencia.split('/')[0] || '').trim()} - ${(formData.agencia.Agencia.split('/')[1] || '').trim()}`
                    : (formData.agencia?.Provincia || ''))),
          distrito_lima: esLima ? formData.distritoLima : null,
          direccion_entrega: esLima ? formData.direccionEntrega : null,
          referencia_entrega: esLima ? formData.referenciaEntrega : null,
          metodo_pago: esLima ? (formData.metodoPago || 'contraentrega') : 'pagado',
          fecha_prevista: fechaSql,
          tipo_mercaderia: 'PAQUETE XS'
        });

        setPedidoGuardado(orden);
      } catch (err) {
        console.error('Error persistiendo orden:', err);
        setErrorMsg('Hubo un error al registrar la orden. Por favor intenta de nuevo.');
        setGuardandoPedido(false);
        return;
      } finally {
        setGuardandoPedido(false);
      }
    }

    // Abrir WhatsApp con el mensaje estructurado
    const mensaje = generarMensajeWhatsApp(orden);
    const mensajeCodificado = encodeURIComponent(mensaje);
    const url = `https://api.whatsapp.com/send?phone=${NUMERO_WHATSAPP_TECHMOOD}&text=${mensajeCodificado}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const volverAlFormulario = () => {
    setStep(1);
    setErrorMsg('');
  };

  const programarOtroEnvio = () => {
    setPedidoGuardado(null);
    setFormData({
      whatsapp: '',
      dni: '',
      nombre: '',
      agencia: null,
      distritoLima: '',
      direccionEntrega: '',
      referenciaEntrega: '',
      fecha: null
    });
    setStep(1);
    setErrorMsg('');
  };

  const formatearFechaLarga = () => {
    if (!formData.fecha) return '';
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];
    const diaSemana = dias[formData.fecha.getDay()];
    const dia = String(formData.fecha.getDate()).padStart(2, '0');
    const mes = meses[formData.fecha.getMonth()];
    const anio = formData.fecha.getFullYear();
    return `${diaSemana}, ${dia} de ${mes} ${anio}`;
  };

  return (
    <div className="relative min-h-screen w-full bg-[#08080a] text-white flex flex-col justify-between overflow-x-clip bg-grid-pattern selection:bg-amber-500 selection:text-black pb-20 sm:pb-0">
      
      {/* Luces Radiales de Fondo (Ambient Glow & Atmospheric Rings) */}
      <div className="pointer-events-none absolute -top-40 right-0 w-[550px] h-[550px] bg-amber-500/10 rounded-full blur-[120px] -z-10" />
      <div className="pointer-events-none absolute bottom-0 left-10 w-[450px] h-[450px] bg-orange-600/10 rounded-full blur-[140px] -z-10" />
      <div className="pointer-events-none absolute top-1/2 right-1/4 -translate-y-1/2 w-[700px] h-[700px] bg-radial from-amber-500/15 via-transparent to-transparent blur-3xl -z-10" />

      {/* HEADER con Navegación Unificada */}
      <Header vistaActiva={vista} onCambiarVista={setVista} />

      {/* VISTA 1: RASTREADOR DE PEDIDOS */}
      {vista === 'rastreo' && (
        <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex-1 flex flex-col justify-center">
          <OrderTracking 
            codigoInicial={codigoTrackingParaConsultar} 
            onIrAFormulario={() => setVista('formulario')} 
          />
        </main>
      )}

      {/* VISTA 2: PANEL DE ADMINISTRACIÓN / REPARTIDORES */}
      {vista === 'admin' && (
        <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex-1">
          <AdminDashboard 
            onVerRastreo={(cod) => {
              setCodigoTrackingParaConsultar(cod);
              setVista('rastreo');
            }} 
          />
        </main>
      )}

      {/* VISTA 3: FORMULARIO PRINCIPAL DE DESPACHOS */}
      {vista === 'formulario' && (
        <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 flex-1 flex items-center">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center w-full">
            
            {/* ================= COLUMNA IZQUIERDA: HERO TEXTUAL ================= */}
            <div className="lg:col-span-6 flex flex-col justify-center space-y-5 text-left">
              
              {/* Badge Píldora con Glow */}
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-neutral-900/90 border border-amber-500/30 w-fit backdrop-blur-md shadow-inner shadow-amber-500/10">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                <span className="text-[11px] sm:text-xs font-semibold tracking-wider text-amber-300 uppercase">
                  SISTEMA DE DESPACHOS TECH MOOD
                </span>
              </div>

              {/* Título Principal */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.12]">
                Gestiona el envío de tus{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500">
                  paquetes y pedidos
                </span>{' '}
                a todo el Perú
              </h1>

              {/* Subtítulo Descriptivo */}
              <p className="text-sm sm:text-base text-neutral-400 max-w-xl leading-relaxed">
                Plataforma oficial de coordinación de <strong className="text-neutral-200">tech mood</strong>. Elige entrega express con nuestros <strong className="text-amber-400">motorizados en Lima Metropolitana</strong> o recojo en agencias <strong>Shalom</strong>, <strong>Olva</strong> y <strong>Urbano</strong> a nivel nacional.
              </p>

              {/* Métricas y Datos Rápidos */}
              <div className="grid grid-cols-3 gap-2 sm:gap-4 w-full pt-1">
                <div className="p-2 sm:px-3.5 sm:py-2.5 rounded-xl sm:rounded-2xl bg-neutral-900/80 border border-neutral-800/90 backdrop-blur-md text-left flex flex-col justify-center">
                  <div className="text-[10px] sm:text-xs text-neutral-400 font-medium truncate">Lima Express</div>
                  <div className="text-sm sm:text-xl lg:text-2xl font-black text-amber-400 tracking-tight">Motorizados</div>
                </div>
                <div className="p-2 sm:px-3.5 sm:py-2.5 rounded-xl sm:rounded-2xl bg-neutral-900/80 border border-neutral-800/90 backdrop-blur-md text-left flex flex-col justify-center">
                  <div className="text-[10px] sm:text-xs text-neutral-400 font-medium truncate">Nacional</div>
                  <div className="text-sm sm:text-xl lg:text-2xl font-black text-white tracking-tight">100% Perú</div>
                </div>
                <div className="p-2 sm:px-3.5 sm:py-2.5 rounded-xl sm:rounded-2xl bg-neutral-900/80 border border-neutral-800/90 backdrop-blur-md text-left flex flex-col justify-center">
                  <div className="text-[10px] sm:text-xs text-neutral-400 font-medium truncate">Rastreo</div>
                  <div className="text-[11px] sm:text-sm lg:text-base font-black text-orange-400 tracking-tight truncate">En Tiempo Real</div>
                </div>
              </div>

              {/* Badges de Confianza */}
              <div className="pt-2 flex items-center gap-2 text-xs text-neutral-400">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Coordinación directa y encriptada vía WhatsApp Business</span>
              </div>

            </div>

            {/* ================= COLUMNA DERECHA: FORMULARIO GLASSMORPHISM ================= */}
            <div className="lg:col-span-6 relative flex justify-center items-center">
              
              <div className="absolute -inset-4 sm:-inset-8 rounded-full border border-amber-500/10 pointer-events-none -z-10 animate-pulse"></div>
              <div className="absolute -inset-10 sm:-inset-16 rounded-full border border-orange-500/5 pointer-events-none -z-10"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -z-10"></div>

              {/* Tarjeta Principal Glassmorphism */}
              <div className="w-full max-w-lg bg-[#0e0e13]/85 backdrop-blur-2xl border border-neutral-800/90 hover:border-amber-500/30 rounded-3xl p-5 sm:p-7 shadow-2xl shadow-black/90 transition-all duration-300">
                
                {/* ================= PASO 1: FORMULARIO DE ENVÍOS ================= */}
                {step === 1 ? (
                  <>
                    <div className="mb-4 text-left border-b border-neutral-800/80 pb-3">
                      <div className="flex items-center justify-between">
                        <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
                          <Package className="w-5 h-5 text-amber-400" />
                          Programar mi Envío
                        </h2>
                        <span className="text-[11px] font-semibold text-neutral-400 bg-neutral-800/80 px-2.5 py-1 rounded-full border border-neutral-700/50">
                          Paso 1 de 2
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-1">
                        Completa los datos del destinatario para generar la orden de despacho.
                      </p>
                    </div>

                    {/* Banner de error */}
                    {errorMsg && (
                      <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2 animate-in fade-in">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                        <span>{errorMsg}</span>
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4 text-left">
                      
                      {/* SELECTOR DE MODALIDAD: LIMA MOTORIZADO VS PROVINCIA AGENCIAS */}
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-neutral-300 mb-1.5">
                          Modalidad de Entrega *
                        </label>
                        <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                          
                          {/* Botón 1: Lima Metropolitana con Motorizado */}
                          <button
                            type="button"
                            onClick={() => handleCambiarTipoEnvio('lima_metropolitana')}
                            className={`group flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
                              tipoEnvio === 'lima_metropolitana'
                                ? 'bg-gradient-to-r from-amber-500/30 via-orange-500/20 to-neutral-900 border-amber-400 text-white shadow-lg shadow-amber-500/20 ring-1 ring-amber-400/40'
                                : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-white hover:border-amber-400/40'
                            }`}
                          >
                            <Bike className={`w-4 h-4 ${tipoEnvio === 'lima_metropolitana' ? 'text-amber-400 animate-pulse' : 'text-neutral-500'}`} />
                            <span className="truncate">Lima Express (Motorizado)</span>
                          </button>

                          {/* Botón 2: Provincia (Agencias Shalom / Olva / Urbano) */}
                          <button
                            type="button"
                            onClick={() => handleCambiarTipoEnvio('provincia')}
                            className={`group flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
                              tipoEnvio === 'provincia'
                                ? 'bg-gradient-to-r from-blue-600/30 via-indigo-500/20 to-neutral-900 border-blue-400 text-white shadow-lg shadow-blue-500/20 ring-1 ring-blue-400/40'
                                : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-white hover:border-blue-400/40'
                            }`}
                          >
                            <Truck className={`w-4 h-4 ${tipoEnvio === 'provincia' ? 'text-blue-400 animate-pulse' : 'text-neutral-500'}`} />
                            <span className="truncate">Provincia (Agencias)</span>
                          </button>

                        </div>
                      </div>

                      {/* SI ES PROVINCIA: Selector de Couriers y Buscador de Agencias */}
                      {tipoEnvio === 'provincia' ? (
                        <div className="space-y-3.5 animate-in fade-in duration-200">
                          <div>
                            <label className="block text-xs sm:text-sm font-medium text-neutral-300 mb-1.5">
                              Selecciona la empresa de courier *
                            </label>
                            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                              <button
                                type="button"
                                onClick={() => handleEmpresaChange('shalom')}
                                className={`group flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                                  empresa === 'shalom'
                                    ? 'bg-gradient-to-r from-red-600/35 to-neutral-900 border-red-500 text-white shadow-md shadow-red-500/20'
                                    : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-white'
                                }`}
                              >
                                <span className={`w-2 h-2 rounded-full ${empresa === 'shalom' ? 'bg-red-500 animate-pulse' : 'bg-neutral-600'}`} />
                                <span className="truncate">Shalom</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleEmpresaChange('olva')}
                                className={`group flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                                  empresa === 'olva'
                                    ? 'bg-gradient-to-r from-amber-500/35 to-neutral-900 border-amber-400 text-white shadow-md shadow-amber-400/20'
                                    : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-white'
                                }`}
                              >
                                <span className={`w-2 h-2 rounded-full ${empresa === 'olva' ? 'bg-amber-400 animate-pulse' : 'bg-neutral-600'}`} />
                                <span className="truncate">Olva</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleEmpresaChange('urbano')}
                                className={`group flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                                  empresa === 'urbano'
                                    ? 'bg-gradient-to-r from-purple-600/35 to-neutral-900 border-purple-500 text-white shadow-md shadow-purple-500/20'
                                    : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-white'
                                }`}
                              >
                                <span className={`w-2 h-2 rounded-full ${empresa === 'urbano' ? 'bg-purple-400 animate-pulse' : 'bg-neutral-600'}`} />
                                <span className="truncate">Urbano</span>
                              </button>
                            </div>
                          </div>

                          <AgencySearch
                            empresa={empresa}
                            selectedAgency={formData.agencia}
                            onSelectAgency={handleAgencySelect}
                          />
                        </div>
                      ) : (
                        /* SI ES LIMA METROPOLITANA: Campos de Distrito, Dirección y Referencia */
                        <div className="space-y-3.5 animate-in fade-in duration-200">
                          
                          {/* Distrito de Lima Metropolitana */}
                          <div>
                            <label className="block text-xs sm:text-sm font-medium text-neutral-300 mb-1.5">
                              Distrito de Lima Metropolitana *
                            </label>
                            <DistrictSearch
                              selectedDistrict={formData.distritoLima}
                              onSelectDistrict={(distrito) => {
                                setFormData((prev) => ({ ...prev, distritoLima: distrito }));
                                if (errorMsg) setErrorMsg('');
                              }}
                              error={Boolean(errorMsg && !formData.distritoLima)}
                            />
                          </div>

                          {/* Dirección Exacta */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs sm:text-sm font-medium text-neutral-300">
                                Dirección Exacta de Entrega *
                              </label>
                              {isDireccionValid(formData.direccionEntrega) && (
                                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5">
                                  <Check className="w-3 h-3" /> Válida
                                </span>
                              )}
                            </div>
                            <input
                              type="text"
                              name="direccionEntrega"
                              value={formData.direccionEntrega}
                              onChange={handleChange}
                              placeholder="Ej: Av. Larco 852, Dpto 402 / Jr. Los Sauces Mz B Lt 12"
                              className={`w-full px-3.5 py-2.5 sm:py-3 rounded-xl bg-neutral-900/90 border text-white text-xs sm:text-sm placeholder-neutral-500 outline-none transition-all ${
                                isDireccionValid(formData.direccionEntrega)
                                  ? 'border-emerald-500/60 ring-2 ring-emerald-500/10'
                                  : 'border-neutral-700/70 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                              }`}
                              required
                            />
                          </div>

                          {/* Referencia del Domicilio */}
                          <div>
                            <label className="block text-xs sm:text-sm font-medium text-neutral-300 mb-1.5">
                              Referencia de Entrega (Opcional pero recomendado)
                            </label>
                            <input
                              type="text"
                              name="referenciaEntrega"
                              value={formData.referenciaEntrega}
                              onChange={handleChange}
                              placeholder="Ej: Frente al parque, rejas negras, tocar timbre 201"
                              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900/90 border border-neutral-700/70 text-white text-xs sm:text-sm placeholder-neutral-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                            />
                          </div>

                          {/* Selector de Condición de Pago Lima Express */}
                          <div>
                            <label className="text-xs sm:text-sm font-medium text-neutral-300 block mb-1.5">
                              Condición de Pago *
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setFormData((prev) => ({ ...prev, metodoPago: 'contraentrega' }))}
                                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                  (formData.metodoPago || 'contraentrega') === 'contraentrega'
                                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 ring-2 ring-amber-500/20 shadow-sm'
                                    : 'bg-neutral-900/90 border-neutral-700/70 text-neutral-400 hover:text-white'
                                }`}
                              >
                                <span>💵</span>
                                <span>Contraentrega</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormData((prev) => ({ ...prev, metodoPago: 'pagado' }))}
                                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                  formData.metodoPago === 'pagado'
                                    ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 ring-2 ring-emerald-500/20 shadow-sm'
                                    : 'bg-neutral-900/90 border-neutral-700/70 text-neutral-400 hover:text-white'
                                }`}
                              >
                                <span>💳</span>
                                <span>Pagado</span>
                              </button>
                            </div>
                          </div>

                        </div>
                      )}

                      {/* Tu WhatsApp de Contacto */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs sm:text-sm font-medium text-neutral-300">
                            WhatsApp de Contacto *
                          </label>
                          {isWhatsAppValid(formData.whatsapp) && (
                            <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 animate-in fade-in">
                              <Check className="w-3.5 h-3.5" /> Válido
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <Phone className="h-4 w-4 text-neutral-500" />
                          </div>
                          <input
                            type="tel"
                            name="whatsapp"
                            value={formData.whatsapp}
                            onChange={handleChange}
                            className={`w-full pl-10 pr-9 py-2.5 sm:py-3 rounded-xl bg-neutral-900/90 border text-white text-sm placeholder-neutral-500 outline-none transition-all ${
                              isWhatsAppValid(formData.whatsapp)
                                ? 'border-emerald-500/60 ring-2 ring-emerald-500/10'
                                : 'border-neutral-700/70 hover:border-neutral-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                            }`}
                            placeholder="Ej: 997514992 o +51 997..."
                            required
                          />
                          {isWhatsAppValid(formData.whatsapp) && (
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                              <Check className="h-4 w-4 text-emerald-400" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Fila Dividida: DNI + Nombre */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* DNI / CE */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs sm:text-sm font-medium text-neutral-300">
                              DNI / CE Titular *
                            </label>
                            {isDniValid(formData.dni) && (
                              <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5 animate-in fade-in">
                                <Check className="w-3 h-3" /> Válido
                              </span>
                            )}
                          </div>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                              <IdCard className="h-4 w-4 text-neutral-500" />
                            </div>
                            <input
                              type="text"
                              name="dni"
                              value={formData.dni}
                              onChange={handleChange}
                              className={`w-full pl-10 pr-9 py-2.5 sm:py-3 rounded-xl bg-neutral-900/90 border text-white text-sm placeholder-neutral-500 outline-none transition-all ${
                                isDniValid(formData.dni)
                                  ? 'border-emerald-500/60 ring-2 ring-emerald-500/10'
                                  : 'border-neutral-700/70 hover:border-neutral-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                              }`}
                              placeholder="8 dígitos"
                              required
                            />
                            {isDniValid(formData.dni) && (
                              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <Check className="h-4 w-4 text-emerald-400" />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Nombre Completo */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs sm:text-sm font-medium text-neutral-300">
                              Nombre Completo *
                            </label>
                            {isNombreValid(formData.nombre) && (
                              <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5 animate-in fade-in">
                                <Check className="w-3 h-3" /> Válido
                              </span>
                            )}
                          </div>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                              <User className="h-4 w-4 text-neutral-500" />
                            </div>
                            <input
                              type="text"
                              name="nombre"
                              value={formData.nombre}
                              onChange={handleChange}
                              className={`w-full pl-10 pr-9 py-2.5 sm:py-3 rounded-xl bg-neutral-900/90 border text-white text-sm placeholder-neutral-500 outline-none transition-all ${
                                isNombreValid(formData.nombre)
                                  ? 'border-emerald-500/60 ring-2 ring-emerald-500/10'
                                  : 'border-neutral-700/70 hover:border-neutral-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                              }`}
                              placeholder="Titular de entrega"
                              required
                            />
                            {isNombreValid(formData.nombre) && (
                              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <Check className="h-4 w-4 text-emerald-400" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Fecha de Envío */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs sm:text-sm font-medium text-neutral-300">
                            Fecha Prevista para el Envío *
                          </label>
                          {formData.fecha && (
                            <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 animate-in fade-in">
                              <Check className="w-3.5 h-3.5" /> Elegida
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none z-10">
                            <Calendar className="h-4 w-4 text-neutral-500" />
                          </div>
                          <DatePicker
                            selected={formData.fecha}
                            onChange={handleDateChange}
                            dateFormat="dd/MM/yyyy"
                            minDate={new Date()}
                            placeholderText="Seleccionar fecha en calendario"
                            className={`w-full pl-10 pr-9 py-2.5 sm:py-3 rounded-xl bg-neutral-900/90 border text-white text-sm placeholder-neutral-500 outline-none transition-all cursor-pointer ${
                              formData.fecha
                                ? 'border-emerald-500/60 ring-2 ring-emerald-500/10'
                                : 'border-neutral-700/70 hover:border-neutral-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                            }`}
                            required
                          />
                          {formData.fecha && (
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none z-10">
                              <Check className="h-4 w-4 text-emerald-400" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Botón Continuar */}
                      <button
                        type="submit"
                        className="w-full group mt-6 relative inline-flex items-center justify-center p-0.5 rounded-xl font-bold overflow-hidden cursor-pointer shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all duration-300"
                      >
                        <span className="w-full h-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-6 py-3.5 rounded-[10px] text-neutral-950 flex items-center justify-center gap-2 group-hover:bg-gradient-to-r group-hover:from-amber-400 group-hover:to-orange-400 transition-all">
                          <span>Revisar y Confirmar Envío</span>
                          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                        </span>
                      </button>

                    </form>
                  </>
                ) : (
                  /* ================= PASO 2: TICKET DE REVISIÓN Y CONFIRMACIÓN WHATSAPP ================= */
                  <div className="text-left animate-in fade-in zoom-in-95 duration-200">
                    
                    <div className="flex items-center gap-3.5 mb-4 pb-4 border-b border-neutral-800">
                      <div className={`p-2.5 rounded-2xl flex items-center justify-center ${
                        pedidoGuardado 
                          ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400' 
                          : 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
                      }`}>
                        {pedidoGuardado ? <CheckCircle2 className="h-7 w-7" /> : <ShieldCheck className="h-7 w-7" />}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">
                          {pedidoGuardado ? '¡Envío Registrado con Éxito!' : 'Revisión de tu Orden de Envío'}
                        </h3>
                        <p className="text-xs text-neutral-400">
                          {pedidoGuardado 
                            ? 'Orden generada en el sistema. Puedes enviar o reenviar los datos por WhatsApp.' 
                            : 'Verifica que tus datos sean correctos antes de confirmar el despacho.'}
                        </p>
                      </div>
                    </div>

                    {/* Badge de Código si ya fue creado */}
                    {pedidoGuardado && (
                      <div className="p-3.5 mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block">Código Único de Tracking:</span>
                          <span className="text-base font-mono font-black text-amber-400">{pedidoGuardado.codigo_seguimiento}</span>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-semibold text-[11px]">
                          Registrado en Sistema
                        </span>
                      </div>
                    )}

                    {/* Tarjeta de Resumen Estilo Recibo Digital */}
                    <div className="bg-neutral-950/70 border border-neutral-800/90 rounded-2xl p-4 sm:p-5 mb-5 space-y-3.5 text-xs sm:text-sm">
                      
                      <div className="flex items-center justify-between pb-3 border-b border-neutral-800/80">
                        <span className="text-neutral-400 text-xs uppercase tracking-wider font-semibold">Modalidad:</span>
                        {tipoEnvio === 'lima_metropolitana' ? (
                          <span className="px-2.5 py-1 rounded-lg border font-bold text-xs bg-amber-500/15 text-amber-400 border-amber-500/30 flex items-center gap-1">
                            <Bike className="w-3.5 h-3.5" />
                            <span>Lima Express (Motorizado)</span>
                          </span>
                        ) : (
                          <span className={`px-2.5 py-1 rounded-lg border font-bold text-xs ${
                            empresa === 'shalom'
                              ? 'bg-red-500/15 text-red-400 border-red-500/30'
                              : empresa === 'olva'
                                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                : 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                          }`}>
                            {empresa === 'olva' ? 'Olva Courier' : empresa === 'urbano' ? 'Urbano Express' : 'Shalom'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-start justify-between gap-3">
                        <span className="text-neutral-400 text-xs">Destinatario:</span>
                        <span className="font-semibold text-white text-right">{formData.nombre}</span>
                      </div>

                      <div className="flex items-start justify-between gap-3">
                        <span className="text-neutral-400 text-xs">DNI / CE:</span>
                        <span className="font-mono text-neutral-200 text-right">{formData.dni}</span>
                      </div>

                      <div className="flex items-start justify-between gap-3">
                        <span className="text-neutral-400 text-xs">WhatsApp:</span>
                        <span className="font-mono text-neutral-200 text-right">{formData.whatsapp}</span>
                      </div>

                      {/* Destino detallado según modalidad */}
                      <div className="pt-2 border-t border-neutral-800/80">
                        {tipoEnvio === 'lima_metropolitana' ? (
                          <div className="space-y-1.5">
                            <span className="text-neutral-400 text-xs block">Entrega a Domicilio:</span>
                            <div className="p-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 text-xs space-y-1">
                              <p className="font-bold text-amber-300 flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                                <span>Distrito: {formData.distritoLima}</span>
                              </p>
                              <p className="text-neutral-200">{formData.direccionEntrega}</p>
                              {formData.referenciaEntrega && (
                                <p className="text-neutral-400 text-[11px] italic">
                                  Ref: {formData.referenciaEntrega}
                                </p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span className="text-neutral-400 text-xs block mb-1">Agencia de Recojo:</span>
                            <div className="p-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 text-xs">
                              <p className="font-bold text-amber-300">{formData.agencia?.Agencia}</p>
                              <p className="text-neutral-400 text-[11px] mt-0.5">{formData.agencia?.Direccion}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-neutral-400 text-xs">Fecha prevista:</span>
                        <span className="font-semibold text-neutral-200 text-xs">{formatearFechaLarga()}</span>
                      </div>

                    </div>

                    {/* Botones de acción */}
                    <div className="space-y-3">
                      <button
                        onClick={handleConfirmarYEnviarWhatsApp}
                        disabled={guardandoPedido}
                        className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-black font-extrabold py-3.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2.5 text-sm sm:text-base shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 cursor-pointer disabled:opacity-50"
                      >
                        <MessageCircle className="h-5 w-5 fill-black" />
                        <span>
                          {guardandoPedido 
                            ? 'Registrando pedido en sistema...' 
                            : pedidoGuardado 
                              ? 'Reenviar a tech mood por WhatsApp' 
                              : 'Confirmar y Enviar por WhatsApp'}
                        </span>
                      </button>

                      {pedidoGuardado && (
                        <button
                          onClick={() => {
                            setCodigoTrackingParaConsultar(pedidoGuardado.codigo_seguimiento);
                            setVista('rastreo');
                          }}
                          className="w-full bg-neutral-900 hover:bg-neutral-800 border border-amber-500/30 text-amber-400 font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-xs sm:text-sm shadow-md cursor-pointer"
                        >
                          <Search className="w-4 h-4" />
                          <span>Rastrear este pedido en tiempo real</span>
                        </button>
                      )}

                      {!pedidoGuardado ? (
                        <button
                          onClick={volverAlFormulario}
                          className="w-full text-center text-xs text-neutral-400 hover:text-white py-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Corregir o modificar datos</span>
                        </button>
                      ) : (
                        <button
                          onClick={programarOtroEnvio}
                          className="w-full text-center text-xs text-neutral-400 hover:text-white py-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <span>+ Programar otro envío</span>
                        </button>
                      )}
                    </div>

                  </div>
                )}

              </div>
            </div>
          </div>
        </main>
      )}

      {/* FOOTER (Visible en PC y Tablet, Oculto en Mobile para acabado de App Nativa PWA) */}
      <footer className="hidden sm:flex w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 text-center text-xs text-neutral-500 items-center justify-between gap-2 border-t border-amber-600/40 z-10">
        <p>© 2026 tech mood. Sistema Logístico y de Despachos.</p>
        <p className="text-neutral-400">Atención oficial: +51 986601895</p>
      </footer>

      {/* NAVEGACIÓN INFERIOR PWA (Solo Celular) */}
      <BottomNav vistaActiva={vista} onCambiarVista={setVista} />

    </div>
  );
}

export default App;