import { Send, Search, MonitorCog } from 'lucide-react';

const BottomNav = ({ vistaActiva = 'formulario', onCambiarVista }) => {
  const navItems = [
    {
      id: 'formulario',
      label: 'Nuevo Envío',
      icon: Send,
    },
    {
      id: 'rastreo',
      label: 'Rastrear',
      icon: Search,
    },
    {
      id: 'admin',
      label: 'Sistema',
      icon: MonitorCog,
    },
  ];

  return (
    <nav 
      aria-label="Navegación móvil inferior"
      className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-neutral-950/95 backdrop-blur-2xl border-t border-neutral-800/80 shadow-[0_-8px_32px_rgba(0,0,0,0.6)] px-3 py-1.5 select-none"
      style={{ paddingBottom: 'calc(0.45rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="max-w-md mx-auto grid grid-cols-3 gap-2 items-center">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = vistaActiva === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onCambiarVista && onCambiarVista(item.id)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all duration-300 cursor-pointer active:scale-90 ${
                isActive
                  ? 'text-amber-400 font-extrabold'
                  : 'text-neutral-400 hover:text-neutral-200 font-medium'
              }`}
            >
              {/* Resplandor y halo activo en segundo plano */}
              {isActive && (
                <div className="absolute inset-0 bg-gradient-to-t from-amber-500/15 to-orange-500/5 rounded-2xl border border-amber-500/30 shadow-inner shadow-amber-500/10 pointer-events-none" />
              )}

              {/* Indicador de pestaña superior activa (micro-línea brillante) */}
              {isActive && (
                <span className="absolute -top-1.5 w-6 h-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 shadow-[0_0_8px_#f59e0b]" />
              )}

              {/* Contenedor del icono con animación */}
              <div className={`relative flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-300 ${
                isActive 
                  ? 'bg-gradient-to-tr from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/30 scale-105' 
                  : 'text-neutral-400 group-hover:text-white'
              }`}>
                <Icon className={`w-4 h-4 transition-transform duration-200 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
              </div>

              {/* Texto de la pestaña */}
              <span className={`text-[10.5px] mt-1 tracking-tight leading-tight transition-colors duration-200 ${
                isActive ? 'text-amber-400 font-bold' : 'text-neutral-400'
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
