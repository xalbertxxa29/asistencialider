// asistencia.js
document.addEventListener('DOMContentLoaded', () => {
  // Inicializar Firebase
  const db = firebase.firestore();

  // --- Referencias al DOM ---
  const modal = document.getElementById('updateInfoModal');
  const closeBtn = document.getElementById('closeModal');
  // Nueva API apuntando a la hoja "General" y fila 4
  const apiUrl = "https://script.google.com/macros/s/AKfycbxvvTR6hP-BY9snJlHqbClqIPq0hYLyIm8KJmncNT0UuEPj3-FZqadFRuKztIU7LP37uw/exec";
  const form = document.getElementById("searchForm");
  const inp = document.getElementById("dniInput");
  const msg = document.getElementById("message");

  // --- Seguridad: Forzar solo números en el Input ---
  // Esto previene que ingresen letras o símbolos (Prevención de XSS e Inyección Básica)
  inp.addEventListener('input', function () {
    this.value = this.value.replace(/[^0-9]/g, '');
  });
  const fullNameEl = document.getElementById("fullName");
  const overlay = document.getElementById("overlay");
  const calendarContainer = document.querySelector(".calendar-container");
  const statsPanel = document.querySelector(".stats-panel");
  const statValidated = document.getElementById("stat-validated");
  const statNoShow = document.getElementById("stat-no-show");
  const statShould = document.getElementById("stat-should-show");

  const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  // Mostrar modal de aviso al cargar
  modal.classList.add('show');
  closeBtn.addEventListener('click', () => modal.classList.remove('show'));

  // --- Funciones Auxiliares ---
  function showMessage(text, type = "") {
    msg.textContent = text;
    msg.className = `message ${type}`;
  }

  function resetUI() {
    document.querySelectorAll('.month-calendar').forEach(cal => cal.remove());
    fullNameEl.textContent = "";
    fullNameEl.classList.remove('visible');
    statValidated.textContent = "–";
    statNoShow.textContent = "–";
    statShould.textContent = "–";
    showMessage("");
  }

  /**
   * Genera y muestra los calendarios para el período configurado.
   * @param {number} year - El año del reporte.
   * @param {number} startMonthIndex - El índice del mes de inicio (0-11).
   */
  function generateCalendars(year, startMonthIndex) {
    const firstMonthDate = new Date(year, startMonthIndex, 22);
    const secondMonthIndex = (startMonthIndex + 1) % 12;
    const secondMonthYear = (secondMonthIndex === 0) ? year + 1 : year;
    const weekdayHeaders = '<div>Lun</div><div>Mar</div><div>Mié</div><div>Jue</div><div>Vie</div><div>Sáb</div><div>Dom</div>';

    // --- Generar HTML del Primer Mes ---
    const firstMonthCal = document.createElement('div');
    firstMonthCal.className = 'month-calendar';
    let firstMonthHTML = `<h2>${MONTH_NAMES[startMonthIndex]} ${year}</h2><div class="weekday-header">${weekdayHeaders}</div><div class="days-grid">`;
    let dayOfWeek = firstMonthDate.getDay();
    let emptySlots = (dayOfWeek === 0) ? 6 : dayOfWeek - 1;
    firstMonthHTML += '<div class="empty"></div>'.repeat(emptySlots);
    const daysInFirstMonth = new Date(year, startMonthIndex + 1, 0).getDate();
    for (let day = 22; day <= daysInFirstMonth; day++) {
      firstMonthHTML += `<div class="day skeleton" data-day="${String(day).padStart(2, '0')}"><span class="date">${day}</span><span class="value"></span></div>`;
    }
    firstMonthHTML += '</div>';
    firstMonthCal.innerHTML = firstMonthHTML;

    // --- Generar HTML del Segundo Mes ---
    const secondMonthCal = document.createElement('div');
    secondMonthCal.className = 'month-calendar';
    let secondMonthHTML = `<h2>${MONTH_NAMES[secondMonthIndex]} ${secondMonthYear}</h2><div class="weekday-header">${weekdayHeaders}</div><div class="days-grid">`;
    const secondMonthStartDate = new Date(secondMonthYear, secondMonthIndex, 1);
    dayOfWeek = secondMonthStartDate.getDay();
    emptySlots = (dayOfWeek === 0) ? 6 : dayOfWeek - 1;
    secondMonthHTML += '<div class="empty"></div>'.repeat(emptySlots);
    for (let day = 1; day <= 21; day++) {
      secondMonthHTML += `<div class="day skeleton" data-day="${String(day).padStart(2, '0')}"><span class="date">${day}</span><span class="value"></span></div>`;
    }
    secondMonthHTML += '</div>';
    secondMonthCal.innerHTML = secondMonthHTML;

    // Insertar los calendarios en el DOM antes del panel de estadísticas
    calendarContainer.insertBefore(firstMonthCal, statsPanel);
    calendarContainer.insertBefore(secondMonthCal, statsPanel);
  }

  // --- Funciones de Obtención de Datos ---
  async function fetchDataFromAPI(dni) {
    // Enviamos el DNI como parámetro para permitir filtrado en el servidor (Mejora de Seguridad)
    // Si el servidor ignora el parámetro, devolverá todos los datos y el filtrado local (abajo) seguirá funcionando.
    const url = `${apiUrl}?dni=${dni}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Error de red: ${res.status}`);
    return res.json();
  }

  async function getConfigFromFirebase() {
    const docRef = db.collection("configuracion").doc("reporteAsistencia");
    try {
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        let { year = 2025, startMonth = 3 } = docSnap.data(); // Default: Abril 2025

        // Validación de seguridad: Asegurar que sean números
        year = parseInt(year, 10) || 2025;
        startMonth = parseInt(startMonth, 10);
        if (isNaN(startMonth) || startMonth < 0 || startMonth > 11) startMonth = 3;

        return { year, startMonth };
      }
      return { year: 2025, startMonth: 3 }; // Default si el doc no existe
    } catch (error) {
      console.error("Error al leer config de Firebase. Usando valores por defecto.", error);
      showMessage("Error de config. Usando período por defecto.", "error");
      return { year: 2025, startMonth: 3 };
    }
  }

  // --- Evento Principal de Búsqueda ---
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const dni = inp.value.trim();
    if (!/^\d{8}$/.test(dni)) {
      showMessage("DNI inválido (debe tener 8 dígitos).", "error");
      return;
    }

    resetUI();
    showMessage("Buscando...");
    overlay.classList.add("active");

    try {
      // 1. Obtener la configuración y los datos de la API en paralelo
      const [config, apiData] = await Promise.all([
        getConfigFromFirebase(),
        fetchDataFromAPI(dni)
      ]);

      const { year, startMonth } = config;

      // 2. Generar la estructura del calendario
      generateCalendars(year, startMonth);

      // 3. Procesar los datos (Formato Horizontal: Una fila por empleado)
      // Como el servidor ya filtra por DNI (o devuelve todo si no), apiData es un Array de registros.
      let record = null;
      if (Array.isArray(apiData)) {
        // Buscamos si hay registros para este DNI en la respuesta
        record = apiData.find(r => r.DNI && String(r.DNI).trim() === dni);
      }

      if (!record) {
        showMessage("No se encontró registro para el DNI ingresado en el reporte General.", "error");
        return;
      }

      // 4. Obtener Nombre
      // Buscamos flexibilidad en el nombre de la columna
      const nombre = record["APELLIDOS Y NOMBRES"] || record["NOMBRES"] || record["Empleado"] || "Nombre no encontrado";

      fullNameEl.textContent = nombre;
      fullNameEl.classList.add('visible');

      // Calcular totales (Si la hoja no los trae pre-calculados, podríamos sumarlos aquí)
      statValidated.textContent = record["# TOTAL ASISTENCIA VALIDADA"] || "0";
      statNoShow.textContent = record["# NO MARCÓ"] || "0";
      statShould.textContent = record["# DEBIO MARCAR"] || "0";

      showMessage("¡Registro encontrado con éxito!", "success");

      // 5. Rellenar las celdas del calendario (Leyendo columnas 1, 2, 3...)
      document.querySelectorAll('.month-calendar .day[data-day]').forEach((cell, i) => {
        const dayKey = cell.dataset.day; // ej: "22", "01"
        // La hoja General tiene columnas como "1", "2", "22".
        // El dataset.day puede tener cero a la izquierda ("05"). Probamos ambas claves.
        const dayInt = parseInt(dayKey, 10).toString(); // "05" -> "5"

        let val = (record[dayKey] || record[dayInt] || "F").toString().trim().toUpperCase();

        // --- MEJORA VISUAL: Forzar formato con barra ---
        if (val === "NA") val = "N/A";
        if (val === "MI") val = "M/I";

        cell.classList.remove("skeleton");
        cell.querySelector(".value").textContent = val;

        // Limpiamos el valor para usarlo como clase CSS
        const safeClass = val.replace(/[^A-Z0-9]/g, '');
        cell.classList.add("has-value", `val-${safeClass}`);

        setTimeout(() => cell.classList.add("visible"), i * 20);
      });

    } catch (error) {
      showMessage("Error crítico al cargar los datos. Verifique la consola.", "error");
      console.error(error);
    } finally {
      overlay.classList.remove("active");
    }
  });

  // Botón para volver a la página principal
  document.getElementById('btn-regresar').addEventListener('click', () => {
    document.body.style.transition = 'opacity 0.5s ease';
    document.body.style.opacity = '0';
    setTimeout(() => window.location.href = 'index.html', 500);
  });
});