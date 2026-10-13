import { useState, useEffect, useRef } from 'react';
import { MapPin, Search, Check, X, ChevronDown } from 'lucide-react';
import distritosLima from '../data/distritosLima.json';

// Normaliza texto para búsqueda tolerante (sin tildes, minúsculas)
const normalizar = (txt = '') =>
  txt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

// Colores sutiles para las zonas geográficas de Lima
const ZONA_COLORES = {
  'Lima Moderna': 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  'Lima Norte': 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  'Lima Sur': 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  'Lima Este': 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  'Lima Centro': 'bg-orange-500/15 text-orange-300 border-orange-500/30',
};

const DistrictSearch = ({ selectedDistrict = '', onSelectDistrict, error = false }) => {
  const [query, setQuery] = useState(selectedDistrict || '');
  const [prevSelected, setPrevSelected] = useState(selectedDistrict);
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef(null);
  const inputRef = useRef(null);

  // Sincronizar si el valor seleccionado cambia externamente (patrón oficial de React)
  if (selectedDistrict !== prevSelected) {
    setPrevSelected(selectedDistrict);
    setQuery(selectedDistrict || '');
  }

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickFuera = (e) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) {
        setAbierto(false);
        // Si el usuario escribió algo que no coincide exactamente, restaurar el seleccionado
        if (selectedDistrict) {
          setQuery(selectedDistrict);
        } else {
          setQuery('');
        }
      }
    };
    document.addEventListener('mousedown', handleClickFuera);
    return () => document.removeEventListener('mousedown', handleClickFuera);
  }, [selectedDistrict]);

  // Filtrar distritos según texto ingresado
  const queryNorm = normalizar(query);
  const distritosFiltrados = distritosLima.filter((d) => {
    if (!queryNorm) return true;
    const nombreNorm = normalizar(d.nombre);
    const zonaNorm = normalizar(d.zona);
    return nombreNorm.includes(queryNorm) || zonaNorm.includes(queryNorm);
  });

  const handleSeleccionar = (distrito) => {
    setQuery(distrito.nombre);
    onSelectDistrict(distrito.nombre);
    setAbierto(false);
  };

  const handleLimpiar = (e) => {
    e.stopPropagation();
    setQuery('');
    onSelectDistrict('');
    if (inputRef.current) inputRef.current.focus();
    setAbierto(true);
  };

  return (
    <div ref={contenedorRef} className="relative w-full">
      {/* Campo de Entrada Principal */}
      <div
        onClick={() => {
          setAbierto(true);
          if (inputRef.current) inputRef.current.focus();
        }}
        className={`relative flex items-center w-full pl-3.5 pr-10 py-2.5 sm:py-3 rounded-xl bg-neutral-900/90 border transition-all cursor-text ${
          abierto
            ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-lg shadow-amber-500/10'
            : error
              ? 'border-red-500/70'
              : 'border-neutral-700/70 hover:border-neutral-600'
        }`}
      >
        <MapPin className={`w-4 h-4 mr-2.5 shrink-0 transition-colors ${selectedDistrict ? 'text-amber-400' : 'text-neutral-500'}`} />
        
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          placeholder="Escribe o busca tu distrito (ej. Surco, Miraflores)..."
          className="w-full bg-transparent text-white text-xs sm:text-sm placeholder-neutral-500 focus:outline-none"
        />

        {/* Botón de limpiar o flecha indicadora */}
        <div className="absolute right-3 flex items-center gap-1">
          {selectedDistrict ? (
            <button
              type="button"
              onClick={handleLimpiar}
              className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Borrar selección"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform duration-200 ${abierto ? 'rotate-180 text-amber-400' : ''}`} />
          )}
        </div>
      </div>

      {/* Menú Desplegable Flotante */}
      {abierto && (
        <div className="absolute z-50 mt-1.5 w-full max-h-64 overflow-y-auto rounded-2xl bg-neutral-950/95 border border-amber-500/30 backdrop-blur-xl shadow-2xl shadow-black/80 p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider flex items-center justify-between border-b border-neutral-800/80 mb-1">
            <span>Distritos de Lima ({distritosFiltrados.length})</span>
            {query && <span className="text-amber-400">Filtrando: "{query}"</span>}
          </div>

          {distritosFiltrados.length === 0 ? (
            <div className="p-4 text-center text-xs text-neutral-400">
              <Search className="w-4 h-4 mx-auto mb-1 text-neutral-600" />
              <span>No encontramos un distrito con ese nombre</span>
            </div>
          ) : (
            distritosFiltrados.map((d) => {
              const estaSeleccionado = selectedDistrict === d.nombre;
              const colorZona = ZONA_COLORES[d.zona] || 'bg-neutral-800 text-neutral-400 border-neutral-700';

              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => handleSeleccionar(d)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-all cursor-pointer ${
                    estaSeleccionado
                      ? 'bg-amber-500/20 text-white font-bold border border-amber-500/40'
                      : 'text-neutral-300 hover:text-white hover:bg-neutral-900/90'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className={`w-3.5 h-3.5 shrink-0 ${estaSeleccionado ? 'text-amber-400' : 'text-neutral-500'}`} />
                    <span className="truncate">{d.nombre}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colorZona}`}>
                      {d.zona}
                    </span>
                    {estaSeleccionado && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default DistrictSearch;
