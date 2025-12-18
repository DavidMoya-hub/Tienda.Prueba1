
/**
 * tiendita - Backend v2.0
 */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('tiendita - Gestión POS')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getDashboardData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Envelopes");
  
  // Si no existen datos, devolvemos un mock inicial
  if (!sheet || sheet.getLastRow() <= 1) {
    return {
      envelopes: [
        { id: "ENV1", name: "Operativo", balance: 0 },
        { id: "ENV2", name: "Ahorro", balance: 0 },
        { id: "ENV3", name: "Ganancia", balance: 0 },
        { id: "ENV4", name: "Capital", balance: 0 }
      ]
    };
  }
  
  const data = sheet.getDataRange().getValues();
  return {
    envelopes: data.slice(1).map(r => ({ id: r[0], name: r[1], balance: r[2] }))
  };
}

function saveProduct(p) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Products");
  if (!sheet) {
    setupSheet();
    sheet = ss.getSheetByName("Products");
  }
  sheet.appendRow([p.id, "", p.name, "", "", p.cost, p.sale, p.stock]);
  return true;
}

function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = {
    "Products": ["id", "code", "name", "grams", "flavor", "costPrice", "salePrice", "stock"],
    "Envelopes": ["id", "name", "balance"]
  };

  for (let name in sheets) {
    if (!ss.getSheetByName(name)) {
      let s = ss.insertSheet(name);
      s.appendRow(sheets[name]);
      if (name === "Envelopes") {
        s.appendRow(["ENV1", "Operativo", 0]);
        s.appendRow(["ENV2", "Ahorro", 0]);
        s.appendRow(["ENV3", "Ganancia", 0]);
        s.appendRow(["ENV4", "Capital", 0]);
      }
    }
  }
  return "OK";
}
