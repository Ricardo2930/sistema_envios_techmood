import { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Building2, Check, X } from 'lucide-react';
import shalomAgencies from '../data/shalom.json';
import olvaAgencies from '../data/olva.json';
import urbanoAgencies from '../data/urbano.json';

// Función para remover acentos y caracteres especiales para búsqueda tolerante
const normalizeText = (text = '') => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

const AgencySearch = ({ empresa = 'shalom', selectedAgency, onSelectAgency }) => {
  const [searchTerm, setSearchTerm] = useState(selectedAgency?.Agencia || '');
  const [filteredAgencies, setFilteredAgencies] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [prevSelected, setPrevSelected] = useState(selectedAgency);
  const [prevEmpresa, setPrevEmpresa] = useState(empresa);
  const wrapperRef = useRef(null);

  // Seleccionar la fuente de datos según la empresa
  const currentAgencies = empresa === 'olva' 
    ? olvaAgencies 
    : empresa === 'urbano' 
      ? urbanoAgencies 
      : shalomAgencies;
  const isOlva = empresa === 'olva';
  const isUrbano = empresa === 'urbano';

  // Tema cromático según courier activo (Shalom rojo, Olva ámbar, Urbano morado)
  const theme = isOlva
    ? {
        iconColor: 'text-amber-400',
        badgeClass: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
        focusClass: 'focus:border-amber-400 focus:ring-amber-400/20',
        selectedItem: 'bg-amber-500/15 text-white',
        itemIconHover: 'group-hover:bg-amber-500/20 group-hover:text-amber-400',
        itemTextHover: 'group-hover:text-amber-300',
        checkColor: 'text-amber-400',
        highlightColor: 'text-amber-400'
      }
    : isUrbano
      ? {
          iconColor: 'text-purple-400',
          badgeClass: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
          focusClass: 'focus:border-purple-500 focus:ring-purple-500/20',
          selectedItem: 'bg-purple-500/15 text-white',
          itemIconHover: 'group-hover:bg-purple-500/20 group-hover:text-purple-400',
          itemTextHover: 'group-hover:text-purple-300',
          checkColor: 'text-purple-400',
          highlightColor: 'text-purple-400'
        }
      : {
          iconColor: 'text-red-400',
          badgeClass: 'text-red-400 border-red-500/30 bg-red-500/10',
          focusClass: 'focus:border-red-500 focus:ring-red-500/20',
          selectedItem: 'bg-red-500/15 text-white',
          itemIconHover: 'group-hover:bg-red-500/20 group-hover:text-red-400',
          itemTextHover: 'group-hover:text-red-300',
          checkColor: 'text-red-400',
          highlightColor: 'text-red-400'
        };

  // Sincronizar estado cuando el padre cambia la empresa o la agencia seleccionada
  if (selectedAgency !== prevSelected || empresa !== prevEmpresa) {
    setPrevSelected(selectedAgency);
    setPrevEmpresa(empresa);
    setSearchTerm(selectedAgency ? selectedAgency.Agencia : '');
    setFilteredAgencies([]);
    setShowDropdown(false);
  }

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    // Si el usuario borra texto, limpiamos la selección en el padre
    if (selectedAgency && value !== selectedAgency.Agencia) {
      onSelectAgency(null);
    }

    const cleanVal = normalizeText(value);
    
    // Búsqueda inteligente por tokens multi-palabra
    if (cleanVal.length >= 2) {
      const tokens = cleanVal.split(/\s+/).filter(Boolean);

      const matched = currentAgencies.filter((agency) => {
        const agencyNameNorm = normalizeText(agency.Agencia || '');
        const addressNorm = normalizeText(agency.Direccion || '');
        const fullText = `${agencyNameNorm} ${addressNorm}`;

        // Todas las palabras deben coincidir en cualquier orden
        return tokens.every((token) => fullText.includes(token));
      });

      // Ordenar por relevancia: coincidencias en el nombre de la Agencia primero
      matched.sort((a, b) => {
        const aName = normalizeText(a.Agencia || '');
        const bName = normalizeText(b.Agencia || '');
        const aHasAllInName = tokens.every((token) => aName.includes(token));
        const bHasAllInName = tokens.every((token) => bName.includes(token));
        if (aHasAllInName && !bHasAllInName) return -1;
        if (!aHasAllInName && bHasAllInName) return 1;
        return 0;
      });

      setFilteredAgencies(matched.slice(0, 20)); // Mostramos hasta 20 resultados relevantes
      setShowDropdown(true);
    } else {
      setFilteredAgencies([]);
      setShowDropdown(false);
    }
  };

  const handleSelect = (agency) => {
    setSearchTerm(agency.Agencia);
    setShowDropdown(false);
    onSelectAgency(agency);
  };

  const handleClear = () => {
    setSearchTerm('');
    setFilteredAgencies([]);
    setShowDropdown(false);
    onSelectAgency(null);
  };

  return (
    <div className="w-full relative" ref={wrapperRef}>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs sm:text-sm font-medium text-neutral-300 flex items-center gap-1.5">
          <Building2 className={`w-4 h-4 ${theme.iconColor}`} />
          Agencia de {isOlva ? 'Olva Courier' : isUrbano ? 'Urbano Express' : 'Shalom'} *
        </label>
        <span className={`text-[11px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full border ${theme.badgeClass}`}>
          {isOlva ? 'Red Olva' : isUrbano ? 'Red Urbano' : 'Red Shalom'}
        </span>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-neutral-500" />
        </div>
        <input
          type="text"
          className={`w-full pl-10 pr-9 py-2.5 sm:py-3 rounded-xl bg-neutral-900/90 border text-white text-sm placeholder-neutral-500 outline-none transition-all duration-200 ${
            selectedAgency
              ? 'border-emerald-500/60 ring-2 ring-emerald-500/10'
              : `border-neutral-700/70 hover:border-neutral-600 ${theme.focusClass} focus:ring-2`
          }`}
          placeholder={
            isOlva
              ? 'Ej: Trujillo, Piura, Miraflores, Cusco...'
              : isUrbano
                ? 'Ej: Pisco, Abancay, Chachapoyas, Lima...'
                : 'Ej: Trujillo atahualpa, Los Olivos, Arequipa...'
          }
          value={searchTerm}
          onChange={handleSearch}
          onFocus={() => {
            if (searchTerm.trim().length >= 2 && filteredAgencies.length > 0) {
              setShowDropdown(true);
            }
          }}
          autoComplete="off"
        />

        {searchTerm && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Dropdown de Resultados Glassmorphism con Scroll Suave */}
      {showDropdown && (
        <div className="absolute z-50 w-full mt-1.5 bg-[#121217]/98 backdrop-blur-xl border border-neutral-700/80 rounded-xl shadow-2xl shadow-black/90 max-h-72 overflow-y-auto overflow-x-hidden animate-in fade-in zoom-in-95 duration-150">
          {filteredAgencies.length > 0 ? (
            <ul className="divide-y divide-neutral-800/80">
              {filteredAgencies.map((agency, index) => {
                const isSelected = selectedAgency?.Agencia === agency.Agencia;
                return (
                  <li
                    key={index}
                    onClick={() => handleSelect(agency)}
                    className={`px-3.5 py-2.5 cursor-pointer transition-all flex items-start gap-2.5 group ${
                      isSelected
                        ? theme.selectedItem
                        : 'hover:bg-neutral-800/70 text-neutral-200'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg bg-neutral-800 ${theme.itemIconHover} text-neutral-400 transition-colors mt-0.5 shrink-0`}>
                      <MapPin className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`font-semibold text-xs sm:text-sm text-neutral-100 ${theme.itemTextHover} transition-colors truncate`}>
                          {agency.Agencia}
                        </p>
                        {isSelected && (
                          <Check className={`h-3.5 w-3.5 ${theme.checkColor} shrink-0`} />
                        )}
                      </div>
                      <p className="text-[11px] sm:text-xs text-neutral-400 mt-0.5 line-clamp-2 leading-relaxed">
                        {agency.Direccion}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-4 text-center text-xs text-neutral-400">
              No se encontraron agencias en <strong className={theme.highlightColor}>{isOlva ? 'Olva' : isUrbano ? 'Urbano' : 'Shalom'}</strong> para esa búsqueda.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AgencySearch;