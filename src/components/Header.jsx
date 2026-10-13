import logo from '../assets/logo.png';
import { Send, Search, Sparkles, MonitorCog } from 'lucide-react';

const Header = ({ vistaActiva = 'formulario', onCambiarVista }) => {
  return (
    <div className="sticky top-0 z-40 w-full backdrop-blur-xl bg-neutral-950/80 border-b border-neutral-900/80 transition-all shadow-lg shadow-black/20">
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex flex-wrap items-center justify-between gap-3">
      
      {/* Brand Logo - tech mood */}
      <div className="flex items-center">
        <button 
          type="button"
          onClick={() => onCambiarVista && onCambiarVista('formulario')}
          className="relative group cursor-pointer select-none text-left bg-transparent border-0 p-0"
        >
          {/* Halo de Brillo Fluido de Fondo (GPU) */}
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 opacity-60 blur-[6px] group-hover:opacity-100 transition-opacity duration-500 animate-pulse-glow"></div>
          
          {/* Borde de Gradiente Animado */}
          <div className="p-[1.5px] rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-300 via-orange-400 to-amber-500 animate-fluid-gradient shadow-lg shadow-amber-500/20">
            {/* Cápsula Base */}
            <div className="relative bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-[14px] flex items-center justify-center overflow-hidden transition-all duration-300 group-hover:bg-white group-hover:scale-[1.03]">
              <img 
                src={logo} 
                alt="tech mood" 
                className="h-6 sm:h-7.5 w-auto object-contain relative z-10 filter drop-shadow-sm"
              />
            </div>
          </div>
        </button>
      </div>

      {/* Navegación por Pestañas (Pills Switcher) - Solo visible en tablets y PC */}
      <nav className="hidden sm:flex items-center gap-1 sm:gap-1.5 p-1 rounded-2xl bg-neutral-950/80 border border-neutral-800/90 backdrop-blur-md shadow-xl text-xs sm:text-sm font-semibold order-2 w-auto justify-center">
        
        {/* Pestaña 1: Programar Envío */}
        <button
          type="button"
          onClick={() => onCambiarVista && onCambiarVista('formulario')}
          className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl transition-all cursor-pointer ${
            vistaActiva === 'formulario'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black font-extrabold shadow-md shadow-amber-500/20'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>Programar Envío</span>
        </button>

        {/* Pestaña 2: Rastrear Pedido */}
        <button
          type="button"
          onClick={() => onCambiarVista && onCambiarVista('rastreo')}
          className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl transition-all cursor-pointer ${
            vistaActiva === 'rastreo'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black font-extrabold shadow-md shadow-amber-500/20'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Rastrear Pedido</span>
        </button>

        {/* Pestaña 3: Panel Admin */}
        <button
          type="button"
          onClick={() => onCambiarVista && onCambiarVista('admin')}
          className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl transition-all cursor-pointer ${
            vistaActiva === 'admin'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black font-extrabold shadow-md shadow-amber-500/20'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
          title="Panel de Administración"
        >
          <MonitorCog className="w-5.5 h-5.5"/>
          <span className="hidden xs:inline">Admin</span>
        </button>

      </nav>

      {/* Indicador de Estado del Sistema */}
      <div className="flex items-center order-2 sm:order-3">
        <div className="relative group">
          <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 opacity-60 blur-sm"></div>
          
          <div className="relative flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-950/90 border border-amber-500/40 text-xs font-semibold text-white tracking-wide shadow-lg shadow-amber-500/10 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1 text-[11px]">
              24/7 Activo
              <Sparkles className="w-3 h-3 text-amber-400 animate-spin-slow" />
            </span>
          </div>
        </div>
      </div>

    </header>
    </div>
  );
};

export default Header;
