# Informe de Seguridad y Auditoría - Web de Asistencia (Actualizado)

## Vulnerabilidad: Descarga Masiva de Datos (Hoja "General")

El script actual (`Código.gs`) lee desde la fila 4 de la hoja "General" y devuelve **todos** los registros. Esto permite que cualquiera descargue la lista completa de personal.

### ✅ Solución: Código Seguro para Google Apps Script

Copia y pega este código en tu editor de Google Apps Script. Este código:
1.  Usa la hoja **"General"**.
2.  Reconoce que los encabezados están en la **Fila 4**.
3.  **Filtra por DNI en el servidor** antes de responder.

```javascript
function doGet(e) {
  const SHEET_NAME     = "General";     // Nombre correcto de la pestaña
  const HEADER_ROW     = 4;             // Encabezados en fila 4
  
  // 1. Verificación de Seguridad: ¿Se envió un DNI?
  var dniSolicitado = e.parameter.dni;
  if (!dniSolicitado) {
    // Si no hay DNI, devolvemos vacío para proteger los datos
    return ContentService.createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 2. Abrir hoja
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return errorResponse("Hoja 'General' no encontrada");

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow <= HEADER_ROW) return jsonResponse([]);

  // 3. Leer datos
  // Leemos desde la fila de encabezados hasta el final
  const allValues = sheet
    .getRange(HEADER_ROW, 1, lastRow - HEADER_ROW + 1, lastCol)
    .getValues();

  const headers = allValues.shift(); // Primera fila (la 4) son headers
  const dataRows = allValues;        // Resto son datos

  // 4. Buscar índice de columna DNI
  // Normalizamos a mayúsculas para búsqueda robusta
  const dniIndex = headers.findIndex(h => String(h).toUpperCase().trim() === "DNI");

  if (dniIndex === -1) return errorResponse("Columna DNI no encontrada en fila 4");

  // 5. Filtrar Server-Side
  const filteredRows = dataRows.filter(row => {
    return String(row[dniIndex]).trim() === String(dniSolicitado).trim();
  });

  // 6. Convertir a JSON Mapeado
  const jsonOutput = filteredRows.map(row => {
    const obj = {};
    headers.forEach((colName, i) => {
      // Manejo especial para fechas si fuera necesario, o dejar valor crudo
      obj[colName] = row[i];
    });
    return obj;
  });

  return jsonResponse(jsonOutput);
}

// Helpers
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(msg) {
  return ContentService.createTextOutput(JSON.stringify([{error: msg}]))
    .setMimeType(ContentService.MimeType.JSON);
}
```

---
### Instrucciones de Implementación
1.  Pega el código anterior en tu proyecto de Apps Script.
2.  Haz clic en **Implementar > Nueva implementación**.
3.  Asegúrate de que *Quién tiene acceso* esté en **"Cualquier persona" (Anyone)**.
4.  Copia la nueva URL (si cambia) o mantén la existente si solo actualizas la versión.
