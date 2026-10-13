# 🚀 tech mood | Sistema de Envíos Nacionales

<p align="center">
  <img src="src/assets/logo.png" alt="tech mood Logo" width="220" />
</p>

<p align="center">
  <strong>Plataforma moderna para la gestión y programación rápida de despachos a nivel nacional a través de Shalom Empresarial, Olva Courier y Urbano Express.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/TailwindCSS-v4.3-38B2AC?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Vercel-Deployed-000000?logo=vercel&logoColor=white" alt="Vercel" />
  <img src="https://img.shields.io/badge/Security-Audit_Clean_(0_Vulns)-brightgreen?logo=shield" alt="Security Clean" />
</p>

---

## 📌 Descripción del Proyecto

**tech mood - Sistema de Envíos** es una aplicación web *Single Page Application* (SPA) de alto rendimiento diseñada con estética premium oscura y efectos *Glassmorphism*. Su objetivo es simplificar radicalmente la recolección de datos de despacho del cliente final y coordinar la entrega automáticamente mediante **WhatsApp Business**, eliminando errores humanos en direcciones, agencias y documentos de identidad.

---

## ✨ Características Principales

* 🏢 **Soporte Multi-Courier:** Alternancia instantánea entre **Shalom Empresarial**, **Olva Courier** y **Urbano Express**.
* 🔍 **Búsqueda Inteligente de Agencias:** 
  * Indexación en memoria de más de 1,100 agencias a nivel nacional.
  * Búsqueda por tokens multi-palabra con tolerancia a acentos y orden indiferente.
* 🛡️ **Validaciones Nativas y Estrictas:**
  * **DNI / Carnet de Extranjería:** Validación de 8 dígitos numéricos o 9-12 alfanuméricos.
  * **WhatsApp:** Validación de formato móvil peruano (9 dígitos).
  * **Nombres:** Filtro de texto completo (mínimo dos palabras).
* 💬 **Integración WhatsApp Directa:**
  * Generación y formateo estructurado del mensaje con detalles del despacho.
  * Apertura segura mediante `api.whatsapp.com` con codificación URI (`encodeURIComponent`) y atributos `noopener,noreferrer`.
* ⚡ **Arquitectura Zero-Backend / Máxima Privacidad:**
  * Los datos se procesan 100% en el navegador del cliente. No se almacenan en bases de datos ni se exponen a terceros.
* 🎨 **Diseño Ultra Premium:**
  * Paleta en modo oscuro profundo con gradientes de luz ámbar/naranja.
  * Micro-animaciones, efectos shimmer y componentes reactivos fluidos.

---

## 🛠️ Tecnologías Utilizadas

* **Frontend:** [React 19](https://react.dev/) + React Compiler
* **Bundler & Dev Server:** [Vite 8](https://vitejs.dev/)
* **Estilos:** [Tailwind CSS v4](https://tailwindcss.com/)
* **Iconografía:** [Lucide React](https://lucide.dev/)
* **Selector de Fechas:** [React Datepicker](https://reactdatepicker.com/)
* **Hosting Recomendado:** [Vercel](https://vercel.com/)

---

## 📁 Estructura del Proyecto

```text
forms-envios/
├── public/                 # Recursos públicos e iconos
├── src/
│   ├── assets/             # Logo oficial tech mood y gráficos
│   ├── components/
│   │   ├── Header.jsx      # Barra superior con efectos de luz y badge de estado
│   │   └── AgencySearch.jsx# Buscador predictivo de agencias con dropdown
│   ├── data/
│   │   ├── olva.json       # Directorio oficial de agencias Olva Courier
│   │   ├── shalom.json     # Directorio oficial de agencias Shalom
│   │   └── urbano.json     # Directorio oficial de agencias Urbano Express
│   ├── App.jsx             # Lógica central del formulario y flujo de 2 pasos
│   ├── index.css           # Estilos globales y tokens Tailwind v4
│   └── main.jsx            # Punto de entrada de la aplicación
├── .gitignore              # Reglas estrictas de exclusión (node_modules, .env, etc.)
├── package.json            # Dependencias y scripts del proyecto
├── vercel.json             # Configuración de rutas SPA y cabeceras de seguridad HTTP
└── vite.config.js          # Configuración del empaquetador Vite con plugin Tailwind
```

---

## 🚀 Instalación y Ejecución Local

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/nombre-del-repo.git
cd forms-envios
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Iniciar el servidor de desarrollo
```bash
npm run dev
```
La aplicación estará disponible en `http://localhost:5173`.

### 4. Compilar para producción
```bash
npm run build
```

---

## 🌐 Despliegue en Vercel

El proyecto ya incluye el archivo `vercel.json` con:
* Rutas de reescritura para aplicaciones SPA (`/* -> /index.html`).
* Cabeceras de seguridad HTTP (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`).

### Pasos para desplegar:
1. Sube tu código a un repositorio en **GitHub**.
2. Ingresa a [Vercel Dashboard](https://vercel.com) y haz clic en **"Add New Project"**.
3. Importa tu repositorio de GitHub.
4. **Configuración de Raíz (Root Directory):**
   * Si subiste la carpeta raíz completa que contiene `forms-envios`, en la configuración del proyecto en Vercel selecciona **Root Directory: `forms-envios`**.
   * Si subiste directamente el contenido de `forms-envios`, deja el valor por defecto (`./`).
5. Haz clic en **Deploy**. ¡Listo en menos de 1 minuto!

---

## 🔒 Auditoría y Seguridad

* **Dependencias:** Verificado con `npm audit` (0 vulnerabilidades reportadas).
* **Protección contra fugas:** `.gitignore` configurado para evitar la subida involuntaria de `node_modules` y archivos `.env`.
* **Seguridad de Enlaces:** El redireccionamiento a WhatsApp cuenta con protección `noopener,noreferrer` contra vulnerabilidades de *tabnabbing*.

---

## 📄 Licencia

Este proyecto es propiedad de **tech mood**. Todos los derechos reservados © 2026.
