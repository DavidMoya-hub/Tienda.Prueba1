
/**
 * tiendita - Backend API v2.1
 * Configuración: Implementar como Aplicación Web -> Acceso: "Cualquiera"
 */

function doGet(e) {
  const action = e.parameter.action;
  let data;
  
  try {
    if (action === 'getDashboardData') data = getDashboardDataInternal();
    else if (action === 'getProducts') data = getTableData("Products");
    else if (action === 'getEnvelopes') data = getTableData("Envelopes");
    else if (action === 'getEnvelopeHistory') data = getTableData("EnvelopeHistory");
    else if (action === 'getPurchaseNotes') data = getTableData("PurchaseNotes");
    else if (action === 'getInputs') data = getTableData("Inputs");
    else if (action === 'getOutputs') data = getTableData("Outputs");
    else if (action === 'getClosings') data = getTableData("Closings");
    else if (action === 'getPriceHistory') data = getTableData("PriceHistory");
    else {
      // Si no hay acción, servir la interfaz (por si se abre el link directo)
      return HtmlService.createHtmlOutput("API Operativa - tiendita POS")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
    
    return ContentService.createTextOutput(JSON.stringify(data || []))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({error: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const action = e.parameter.action;
    const data = JSON.parse(e.postData.contents);
    let result = { success: true };
    
    if (action === 'saveProduct') saveProductInternal(data);
    else if (action === 'deleteProduct') deleteRow("Products", data.id);
    else if (action === 'saveOutput') appendToTable("Outputs", data);
    else if (action === 'saveClosing') appendToTable("Closings", data);
    else if (action === 'withdrawEnvelope') withdrawEnvelopeInternal(data);
    else if (action === 'processPhysicalCount') result = processPhysicalCountInternal(data.counts, data.shift);
    else if (action === 'updateNoteStatus') updateNoteStatusInternal(data.id, data.status);
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({error: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// --- FUNCIONES INTERNAS ---

function getTableData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  return values.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function getDashboardDataInternal() {
  const envelopes = getTableData("Envelopes");
  const products = getTableData("Products");
  
  // Cálculo básico de capital vs utilidad para la gráfica
  const capital = envelopes.find(e => e.id === "ENV4")?.balance || 0;
  const profits = envelopes.filter(e => e.id !== "ENV4").reduce((a, b) => a + (Number(b.balance) || 0), 0);

  return {
    envelopes: envelopes,
    profitVsCapital: [
      { name: 'Capital', value: capital },
      { name: 'Utilidad', value: profits }
    ],
    topVolume: products.sort((a,b) => b.stock - a.stock).slice(0, 5).map(p => ({ name: p.name, volume: p.stock })),
    topProfit: products.slice(0, 5).map(p => ({ name: p.name, profit: 100 })) // Mock
  };
}

function saveProductInternal(p) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Products");
  if (!sheet) { setupSheet(); sheet = ss.getSheetByName("Products"); }
  
  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex(r => r[0] === p.id);
  
  const rowData = [p.id, p.code, p.name, p.grams, p.flavor, p.costPrice, p.salePrice, p.stock, p.category, p.provider, p.totalInvested, p.totalEarned];
  
  if (rowIndex > -1) {
    sheet.getRange(rowIndex + 1, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
}

function appendToTable(sheetName, data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  const headers = sheet.getDataRange().getValues()[0];
  const row = headers.map(h => data[h] || "");
  sheet.appendRow(row);
}

function deleteRow(sheetName, id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  const idx = data.findIndex(r => r[0] === id);
  if (idx > -1) sheet.deleteRow(idx + 1);
}

function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = {
    "Products": ["id", "code", "name", "grams", "flavor", "costPrice", "salePrice", "stock", "category", "provider", "totalInvested", "totalEarned"],
    "Envelopes": ["id", "name", "balance", "description", "lastResetDate"],
    "Outputs": ["id", "productId", "productName", "quantity", "salePrice", "totalSale", "date", "shift"],
    "Closings": ["id", "date", "totalSold", "netProfit", "cogs"],
    "Inputs": ["id", "productId", "productName", "quantity", "unitCost", "totalCost", "date", "provider"],
    "PurchaseNotes": ["id", "date", "provider", "totalAmount", "status", "detailsJson"]
  };

  for (let name in sheets) {
    if (!ss.getSheetByName(name)) {
      let s = ss.insertSheet(name);
      s.appendRow(sheets[name]);
      if (name === "Envelopes") {
        const now = new Date().toISOString();
        s.appendRow(["ENV1", "Operativo", 0, "Gastos diarios", now]);
        s.appendRow(["ENV2", "Ahorro", 0, "Fondo reserva", now]);
        s.appendRow(["ENV3", "Ganancia", 0, "Utilidad neta", now]);
        s.appendRow(["ENV4", "Capital", 0, "Resurtido stock", now]);
      }
    }
  }
}
