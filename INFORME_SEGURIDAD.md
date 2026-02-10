# Informe de Seguridad y Auditoría - Web de Asistencia

## Resumen Ejecutivo
La aplicación web actual tiene una **vulnerabilidad crítica de privacidad**. Aunque la intención es que sea pública y sin credenciales, la arquitectura actual permite que **cualquier usuario con conocimientos técnicos básicos descargue la base de datos completa** (todos los nombres, DNIs y registros de asistencia) de todos los empleados.

Esto ocurre porque el "filtrado" por DNI se realiza en el navegador del usuario (Client-Side), en lugar de hacerse en el servidor (Server-Side).

---

## 1. Vulnerabilidad Crítica: Descarga Masiva de Datos (Data Leakage)

### El Problema
En los archivos `asistencia.js` y `marcacion.js`, la aplicación realiza lo siguiente:

```javascript
// asistencia.js (Línea 125-136 aprox)
const [config, apiData] = await Promise.all([..., fetchDataFromAPI()]);
// ...
const record = apiData.find(r => r.DNI && String(r.DNI).trim() === dni);
```

**Lo que sucede realmente:**
1. El navegador hace una petición a Google Apps Script.
2. Google Apps Script devuelve **TODOS** los registros de la hoja de cálculo (quizás miles de filas con datos de todos los empleados).
3. El navegador recibe todos estos datos y los guarda en la memoria (`apiData`).
4. El código JavaScript busca el DNI ingresado dentro de esa lista enorme.

**El Riesgo:**
Cualquier persona puede abrir las "Herramientas de Desarrollador" (F12), ir a la pestaña "Red" (Network), y ver la respuesta completa del servidor, obteniendo un archivo JSON con la información de **toda la empresa**.

### La Solución
El filtrado debe hacerse en Google Apps Script. El navegador solo debe enviar el DNI consultado, y el servidor debe responder **únicamente** con los datos de ese DNI (o un error si no existe).

---

## 2. Plan de Corrección

Para solucionar esto, necesitas aplicar cambios en dos lugares:
1. **En el Google Apps Script** (La "Nube").
2. **En tu código JavaScript** (`asistencia.js` y `marcacion.js`).

### Paso A: Actualizar Google Apps Script
Debes modificar tu script en Google Sheets (`Extensiones > Apps Script`) para que lea el parámetro `dni`.

**Código Sugerido para Google Apps Script:**

```javascript
function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("BD_ASISTENCIA"); // Asegúrate del nombre correcto
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  
  // Verificar si se envió un DNI
  var dniSolicitado = e.parameter.dni;
  
  if (!dniSolicitado) {
    // Si NO hay DNI, devolvemos error o nada (para evitar descarga masiva)
    return ContentService.createTextOutput(JSON.stringify({error: "DNI requerido"}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Buscar solo el DNI solicitado
  var resultado = [];
  // Empezamos en 1 para saltar encabezados
  for (var i = 1; i < data.length; i++) {
    // Asumiendo que el DNI está en la columna 0 (A). Ajusta el índice si es necesario.
    // Si tus encabezados dicen "DNI", busca el índice.
    var row = data[i];
    // Convertimos a string para comparar
    if (String(row[0]) === String(dniSolicitado)) { 
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        obj[headers[j]] = row[j];
      }
      resultado.push(obj);
      // Si solo hay un registro por DNI, puedes hacer 'break' aquí para optimizar
    }
  }

  return ContentService.createTextOutput(JSON.stringify(resultado))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### Paso B: Actualizar `asistencia.js` y `marcacion.js`
Una vez actualizado el script, cambia el código en tu web para enviar el DNI.

**En `asistencia.js`:**

*Cambiar esto:*
```javascript
async function fetchDataFromAPI() {
  const res = await fetch(apiUrl); // <-- Esto descarga todo
  // ...
}
// Luego filtrabas con .find()
```

*Por esto:*
```javascript
async function fetchDataFromAPI(dni) {
  // Enviamos el DNI como parámetro
  const url = `${apiUrl}?dni=${dni}`; 
  const res = await fetch(url);
  if (!res.ok) throw new Error(\`Error de red: \${res.status}\`);
  return res.json();
}
// En el evento submit, llamar a fetchDataFromAPI(dni) y usar el resultado directo (que será un array de 1 elemento o vacío)
```

---

## 3. Otrás Áreas de Seguridad

### Inyección de Datos (Escritura)
- **Estado Actual:** Tu web parace ser de **solo lectura** (no hay formularios que envíen datos `POST` a Google Sheets o Firebase, solo consultas).
- **Riesgo:** Si tu Google Apps Script tiene una función `doPost(e)`, asegúrate de que esté protegida o eliminada si no se usa. Si alguien descubre esa URL y tienes un `doPost` sin seguridad, podrían llenar tu Excel de datos falsos.

### Firebase
- El archivo `firebase-config.js` expone tus claves. Esto es **normal y necesario** en aplicaciones web.
- **Seguridad Real:** La seguridad depende de las **Reglas de Seguridad de Firestore** (en la consola de Firebase).
  - Debes asegurarte de que las reglas solo permitan **lectura** en la colección `configuracion`.
  - Ejemplo de regla segura:
    ```
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        match /configuracion/{document=**} {
          allow read: if true;  // Público puede leer
          allow write: if false; // Nadie puede escribir desde la web
        }
      }
    }
    ```

### Cross-Site Scripting (XSS)
- Tu código usa `textContent` para mostrar nombres y datos, lo cual es **muy seguro** y previene que alguien con un nombre malicioso (ej: `<script>...`) ejecute código en el navegador de otros usuarios.
- **Micro-vulnerabilidad:** En `generateCalendars` usas `innerHTML`. Si un atacante compromete tu base de datos de Firebase y cambia el `year` o los nombres de los meses a código malicioso, podría afectarte.
  - **Mitigación:** Validar siempre que `year` sea un número antes de usarlo.

---

## Conclusión
La aplicación es segura contra ataques externos de escritura (si las reglas de Firebase y Apps Script están bien), pero es **insegura en cuanto a privacidad de datos**. 

**Acción Inmediata Recomendada:** Implementar el filtrado por DNI en Google Apps Script para cerrar la fuga de información.
