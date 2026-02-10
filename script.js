document.addEventListener('DOMContentLoaded', async () => {
  const db = firebase.firestore();
  const btnMarcacion = document.getElementById('reporte-marcacion');
  const btnMensual   = document.getElementById('reporte-mensual');

  // Referencias a los elementos del nuevo modal
  const infoModal = document.getElementById('infoModal');
  const closeInfoModalBtn = document.getElementById('closeInfoModal');

  // Añadir evento para cerrar el modal
  closeInfoModalBtn.addEventListener('click', () => {
    infoModal.classList.remove('show');
  });

  function redirectWithFade(url) {
    document.body.classList.add('fade-out');
    setTimeout(() => window.location.href = url, 500);
  }

  btnMarcacion.addEventListener('click', () => redirectWithFade('marcacion.html'));
  
  // === LÓGICA DE CLIC MODIFICADA ===
  btnMensual.addEventListener('click', () => {
    // Verificamos si tiene nuestra clase que simula el estado deshabilitado
    if (btnMensual.classList.contains('disabled-state')) {
      // Si está "deshabilitado", mostramos el modal
      infoModal.classList.add('show');
    } else {
      // Si no, procedemos con la redirección normal
      redirectWithFade('asistencia.html');
    }
  });

  // === LÓGICA DE LECTURA DE FIREBASE MODIFICADA ===
  try {
    const docRef = db.collection("configuracion").doc("reporteMensual");
    const docSnap = await docRef.get();
    const habilitado = docSnap.exists ? docSnap.data().habilitado : true;

    if (!habilitado) {
      // En lugar de deshabilitar, añadimos la clase CSS
      btnMensual.classList.add('disabled-state');
    } else {
      // Si está habilitado, nos aseguramos de que no tenga la clase
      btnMensual.classList.remove('disabled-state');
    }
  } catch (e) {
    console.error("Error al leer Firestore:", e);
    // En caso de error, también lo "deshabilitamos" visualmente
    btnMensual.classList.add('disabled-state');
  }

  // Fondo dinámico tipo slideshow
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .slideshow1, .slideshow2 {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background-size: cover;
      background-position: center;
      transition: opacity 1s ease-in-out;
      z-index: -2;
      opacity: 0;
    }
    .slideshow1.active, .slideshow2.active {
      opacity: 1;
    }
  `;
  document.head.appendChild(styleEl);

  const slideA = document.createElement('div');
  slideA.classList.add('slideshow1', 'active');
  const slideB = document.createElement('div');
  slideB.classList.add('slideshow2');
  document.body.prepend(slideB);
  document.body.prepend(slideA);

  const images = [
    'images/bg1.webp',
    'images/bg2.webp',
    'images/bg3.webp',
  ];
  let current = 0;
  let activeSlide = slideA;
  let nextSlide = slideB;

  images.forEach(src => {
    const img = new Image();
    img.src = src;
  });
  activeSlide.style.backgroundImage = `url('${images[0]}')`;

  function cycleBackground() {
    current = (current + 1) % images.length;
    nextSlide.style.backgroundImage = `url('${images[current]}')`;
    nextSlide.classList.add('active');
    activeSlide.classList.remove('active');
    [activeSlide, nextSlide] = [nextSlide, activeSlide];
  }

  setInterval(cycleBackground, 5000);

  // Efecto 3D en botones
  const buttons = document.querySelectorAll('.report-btn');
  buttons.forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
      // Añadimos una comprobación para no activar el efecto si el botón está "deshabilitado"
      if (btn.classList.contains('disabled-state')) {
        btn.style.transform = ''; // Nos aseguramos de que no tenga transformación
        return;
      }
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const dx = (x - cx) / cx;
      const dy = (y - cy) / cy;
      btn.style.transform = `rotateY(${dx * 10}deg) rotateX(${-dy * 10}deg) scale(1.05)`;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
    });
  });
});