import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

const CustomSelect = ({
  value,
  onChange,
  options = [],
  placeholder = 'Seleccionar...',
  className = '',
  align = 'left',
  size = 'default'
}) => {
  const [abierto, setAbierto] = useState(false);
  const dropdownRef = useRef(null);

  // Cerrar al hacer clic fuera del componente
  useEffect(() => {
    const handleClickFuera = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setAbierto(false);
      }
    };
    document.addEventListener('mousedown', handleClickFuera);
    return () => document.removeEventListener('mousedown', handleClickFuera);
  }, []);

  const opcionSeleccionada = options.find((opt) => opt.value === value) || null;

  const handleSelect = (val) => {
    onChange(val);
    setAbierto(false);
  };

  const isSmall = size === 'sm';

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`}>
      {/* Botón Trigger del Selector */}
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className={`w-full flex items-center justify-between gap-2 rounded-xl transition-all font-semibold cursor-pointer select-none border ${
          isSmall
            ? 'px-2.5 py-1 text-xs bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-neutral-300'
            : 'px-3 py-2 text-xs bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-neutral-200'
        } ${
          abierto ? 'border-amber-500/80 ring-2 ring-amber-500/20 text-white shadow-lg shadow-amber-500/10' : ''
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          {opcionSeleccionada?.dotColor && (
            <span className={`w-2 h-2 rounded-full shrink-0 ${opcionSeleccionada.dotColor}`} />
          )}
          {opcionSeleccionada?.icon && (
            <span className="shrink-0">{opcionSeleccionada.icon}</span>
          )}
          <span className="truncate">
            {opcionSeleccionada ? opcionSeleccionada.label : placeholder}
          </span>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-neutral-400 shrink-0 transition-transform duration-200 ${
            abierto ? 'rotate-180 text-amber-400' : ''
          }`}
        />
      </button>

      {/* Menú Desplegable Flotante */}
      {abierto && (
        <div
          className={`absolute z-50 mt-1.5 min-w-[200px] max-h-64 overflow-y-auto rounded-2xl bg-neutral-950/95 border border-amber-500/30 backdrop-blur-xl shadow-2xl shadow-black/90 p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-150 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {options.map((opt) => {
            const esActivo = opt.value === value;

            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left text-xs transition-all cursor-pointer ${
                  esActivo
                    ? 'bg-amber-500/20 text-white font-bold border border-amber-500/40 shadow-sm'
                    : 'text-neutral-300 hover:text-white hover:bg-neutral-900/90'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {opt.dotColor && (
                    <span className={`w-2 h-2 rounded-full shrink-0 ${opt.dotColor}`} />
                  )}
                  {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                  <span className="truncate">{opt.label}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {opt.badge && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                        opt.badgeClass || 'bg-neutral-800 text-neutral-400 border-neutral-700'
                      }`}
                    >
                      {opt.badge}
                    </span>
                  )}
                  {esActivo && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
