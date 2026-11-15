const GUIDE_CONTENT = {
  main: [
    {
      img: 'assets/icons/registrar.svg',
      titulo: 'Registrar producción',
      texto: 'Cargá lo que tu familia produjo hoy (huevos, verduras, carne, etc).'
    },
    {
      img: 'assets/icons/stock.svg',
      titulo: 'Alta / Baja de stock',
      texto: 'Sumá o descontá animales e insumos de lo que tenés actualmente.'
    },
    {
      img: 'assets/icons/balance.svg',
      titulo: 'Balance y resúmenes',
      texto: 'Mirá cuánto ganaste o gastaste en un período, con costos y precios.'
    },
    {
      img: 'assets/icons/actividad.svg',
      titulo: 'Actividad por fecha',
      texto: 'Consultá todo lo que se registró en un día puntual.'
    },
    {
      img: 'assets/icons/graficos.svg',
      titulo: 'Gráficos',
      texto: 'Visualizá tu producción en gráficos fáciles de leer.'
    },
    {
      img: 'assets/icons/grupos.svg',
      titulo: 'Grupos de producción',
      texto: 'Sumate o armá un grupo junto a otras familias productoras.'
    },
    {
      img: 'assets/icons/voz.svg',
      titulo: 'Nota de voz',
      texto: 'Grabá un audio contando lo que produjiste y el sistema lo carga solo.'
    },
    {
      img: 'assets/icons/empleados.svg',
      titulo: 'Empleados',
      texto: 'Si tenés empleados, cargá cuántos son y su sueldo mensual.'
    },
    {
      img: 'assets/icons/sensores.svg',
      titulo: 'Control de sensores',
      texto: 'Mirá los datos del sensor de tu producción (temperatura, luz, etc).'
    }
  ],

  produccion: [
    { img: null, titulo: 'Elegí la categoría', texto: 'Tocá qué tipo de producción querés cargar: gallinas, pollos, cerdos, huerta, etc.' },
    { img: null, titulo: 'Escribí la cantidad', texto: 'Indicá cuánto produjiste hoy en esa categoría (por ejemplo, cantidad de huevos).' },
    { img: null, titulo: 'Confirmá el registro', texto: 'Revisá el resumen que te muestra la app y confirmá para guardarlo.' }
  ],

  stock: [
    { img: null, titulo: '¿Qué es el stock?', texto: 'Es la cantidad total que tenés hoy de cada categoría (no lo que producís por día).' },
    { img: null, titulo: 'Carga inicial', texto: 'Si es la primera vez que usás esta sección, cargá el total que tenés ahora mismo.' },
    { img: null, titulo: 'Alta o baja', texto: 'Después, cada vez que compres, vendas o se pierda un animal, sumá o restá acá.' }
  ],

  consultas: [
    { img: null, titulo: 'Elegí el período', texto: 'Seleccioná el rango de fechas que querés revisar.' },
    { img: null, titulo: 'Mirá el resumen', texto: 'La app calcula los costos (alimento y mano de obra) y lo compara con lo producido.' },
    { img: null, titulo: 'Precio sugerido', texto: 'También te muestra un precio de venta sugerido según tus costos.' }
  ],

  actividad: [
    { img: null, titulo: 'Elegí una fecha', texto: 'Tocá el día que querés revisar en el calendario.' },
    { img: null, titulo: 'Mirá los registros', texto: 'Vas a ver todo lo que se cargó ese día: producción, stock, etc.' }
  ],

  graficos: [
    { img: null, titulo: 'Elegí qué mirar', texto: 'Seleccioná la categoría o el período que querés graficar.' },
    { img: null, titulo: 'Leé el gráfico', texto: 'Cada color representa una categoría, para que compares de un vistazo.' }
  ],

  grupos: [
    { img: null, titulo: '¿Para qué sirve?', texto: 'Te permite juntarte con otras familias productoras de la zona.' },
    { img: null, titulo: 'Unirte o crear uno', texto: 'Podés sumarte a un grupo existente o armar uno nuevo.' }
  ],

  'voz': [
    { img: null, titulo: 'Grabá tu audio', texto: 'Apretá el botón de grabar y contá, con tus palabras, lo que produjiste hoy.' },
    { img: null, titulo: 'Esperá la transcripción', texto: 'El sistema escucha el audio y lo transforma en un registro automáticamente.' },
    { img: null, titulo: 'Revisá antes de guardar', texto: 'Fijate que esté bien interpretado antes de confirmar.' }
  ],

  empleados: [
    { img: null, titulo: 'Activá la sección', texto: 'Por defecto está apagada: activala si tu familia tiene empleados.' },
    { img: null, titulo: 'Cargá los datos', texto: 'Indicá cuántos empleados tenés y el sueldo mensual de cada producción.' }
  ],

  sensores: [
    {
      img: 'assets/icons/sensor-dispositivo.svg',
      titulo: 'Tu sensor',
      texto: 'Así es el aparato que mide tu producción (imagen provisoria, puede variar).'
    },
    {
      img: 'assets/icons/sensor-codigo.svg',
      titulo: 'Buscá el código',
      texto: 'En una esquina del aparato vas a encontrar un código con el formato CHJ-XXXX-XXXX.'
    },
    {
      img: null,
      titulo: 'Vinculalo a tu familia',
      texto: 'Escribí ese código en esta sección para que los datos del sensor se guarden en tu cuenta.'
    },
    {
      img: null,
      titulo: '¿No aparecen datos?',
      texto: 'Revisá que el aparato esté enchufado y que el código esté bien escrito, sin espacios.'
    }
  ]
};

const FALLBACK_SLIDE = [
  {
    img: null,
    titulo: 'Guía en construcción',
    texto: 'Todavía no agregamos la explicación de esta sección. ¡Volvé pronto!'
  }
];

const STYLE_ID = 'guide-tour-styles';

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .guide-tour-btn {
      position: fixed;
      left: 20px;
      bottom: 20px;
      z-index: 9998;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      background: var(--guide-btn-bg, #fff);
      border: 2px solid var(--guide-btn-border, #d8cfa8);
      border-radius: 16px;
      padding: 8px 12px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      color: var(--guide-btn-color, #5a5236);
      font-family: inherit;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .guide-tour-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(0,0,0,0.2);
    }
    .guide-tour-btn svg { width: 32px; height: 32px; }
    .guide-tour-btn span {
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
    }

    .guide-tour-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 16px;
    }
    .guide-tour-overlay[hidden] { display: none; }

    .guide-tour-modal {
      background: #fff;
      border-radius: 18px;
      width: 100%;
      max-width: 420px;
      max-height: 90vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      position: relative;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    }

    .guide-tour-close {
      position: absolute;
      top: 8px;
      right: 10px;
      background: none;
      border: none;
      font-size: 22px;
      line-height: 1;
      cursor: pointer;
      color: #777;
      z-index: 2;
    }

    .guide-tour-slide {
      padding: 32px 24px 16px;
      text-align: center;
      overflow-y: auto;
    }
    .guide-tour-slide img {
      max-width: 100%;
      max-height: 200px;
      object-fit: contain;
      margin-bottom: 14px;
    }
    .guide-tour-slide h3 {
      margin: 0 0 8px;
      font-size: 18px;
    }
    .guide-tour-slide p {
      margin: 0;
      font-size: 14px;
      line-height: 1.5;
      color: #555;
    }

    .guide-tour-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px 18px;
    }
    .guide-tour-arrow {
      background: var(--guide-btn-bg, #f2efe2);
      border: none;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      font-size: 18px;
      cursor: pointer;
    }
    .guide-tour-arrow:disabled { opacity: 0.3; cursor: default; }

    .guide-tour-dots {
      display: flex;
      gap: 6px;
    }
    .guide-tour-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ddd;
    }
    .guide-tour-dot.active {
      background: var(--guide-btn-border, #d8cfa8);
    }
  `;
  document.head.appendChild(style);
}

let currentSlides = [];
let currentIndex = 0;

function getSectionId() {
  const hash = location.hash.replace('#', '').trim();
  if (!hash || hash === 'menu') return 'main';
  return hash;
}

function getSlidesForCurrentSection() {
  const id = getSectionId();
  return GUIDE_CONTENT[id] || FALLBACK_SLIDE;
}

function renderSlide(overlay) {
  const slide = currentSlides[currentIndex];
  const slideEl = overlay.querySelector('.guide-tour-slide');
  slideEl.innerHTML = `
    ${slide.img ? `<img src="${slide.img}" alt="${slide.titulo}">` : ''}
    <h3>${slide.titulo}</h3>
    <p>${slide.texto}</p>
  `;

  overlay.querySelector('.guide-tour-prev').disabled = currentIndex === 0;
  overlay.querySelector('.guide-tour-next').disabled = currentIndex === currentSlides.length - 1;

  const dotsEl = overlay.querySelector('.guide-tour-dots');
  dotsEl.innerHTML = currentSlides
    .map((_, i) => `<span class="guide-tour-dot${i === currentIndex ? ' active' : ''}"></span>`)
    .join('');
}

function openGuide() {
  currentSlides = getSlidesForCurrentSection();
  currentIndex = 0;
  const overlay = document.getElementById('guide-tour-overlay');
  overlay.hidden = false;
  renderSlide(overlay);
}

function closeGuide() {
  document.getElementById('guide-tour-overlay').hidden = true;
}

function buildDom() {
  // Botón flotante
  const btn = document.createElement('button');
  btn.className = 'guide-tour-btn';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Abrir guía de usuario');
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="27" y="29" width="10" height="4" rx="2" fill="currentColor" opacity="0.85"/>
      <path d="M8 28 L15 24" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" opacity="0.85" fill="none"/>
      <path d="M56 28 L49 24" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" opacity="0.85" fill="none"/>
      <circle cx="19" cy="34" r="12" fill="none" stroke="currentColor" stroke-width="4"/>
      <circle cx="45" cy="34" r="12" fill="none" stroke="currentColor" stroke-width="4"/>
    </svg>
    <span>Guía de usuario</span>
  `;
  btn.addEventListener('click', openGuide);
  document.body.appendChild(btn);

  const overlay = document.createElement('div');
  overlay.className = 'guide-tour-overlay';
  overlay.id = 'guide-tour-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="guide-tour-modal">
      <button class="guide-tour-close" aria-label="Cerrar">&times;</button>
      <div class="guide-tour-slide"></div>
      <div class="guide-tour-nav">
        <button class="guide-tour-arrow guide-tour-prev" aria-label="Anterior">&larr;</button>
        <div class="guide-tour-dots"></div>
        <button class="guide-tour-arrow guide-tour-next" aria-label="Siguiente">&rarr;</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Cerrar con click afuera
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeGuide();
  });
  overlay.querySelector('.guide-tour-close').addEventListener('click', closeGuide);

  overlay.querySelector('.guide-tour-prev').addEventListener('click', () => {
    if (currentIndex > 0) { currentIndex--; renderSlide(overlay); }
  });
  overlay.querySelector('.guide-tour-next').addEventListener('click', () => {
    if (currentIndex < currentSlides.length - 1) { currentIndex++; renderSlide(overlay); }
  });

  // Cerrar con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) closeGuide();
  });
}

function init() {
  injectStyles();
  buildDom();
}

// Auto-inicializa al cargar el DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { GUIDE_CONTENT };
