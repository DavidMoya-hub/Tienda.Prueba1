
/**
 * tiendita - Backend API v3.6
 * Maneja persistencia real en Google Sheets con soporte para acumulados de entradas/salidas
 * Se elimina el acceso directo a saveClosing desde la API manual de UI.
 */

function doPost(e) {
  const params = JSON.parse(e.postData.contents);
  const action = params.action;
  const data = params.data;
  
  let result;
  try {
    switch(action) {
      case 'getProducts': result = getProducts(); break;
      case 'getEnvelopes': result = getEnvelopes(); break;
      case 'getDashboardData': result = getDashboardData(); break;
      case 'saveProduct': result = saveProduct(data); break;
      case 'saveEnvelope': result = saveProduct(data); break; // Usado para guardar sobres también
      case 'deleteProduct': result = deleteProduct(data); break;
      case 'saveRestockNote': result = saveRestockNote(data); break;
      case 'updateNoteStatus': result = updateNoteStatus(data.id, data.status); break;
      case 'processPhysicalCount': result = processPhysicalCount(data.counts, data.shift); break;
      case 'withdrawEnvelope': result = withdrawEnvelope(data); break;
      case 'getEnvelopeHistory': result = getSheetData("EnvelopeHistory"); break;
      case 'getPurchaseNotes': result = getSheetData("PurchaseNotes"); break;
      case 'getInputs': result = getSheetData("Inputs"); break;
      case 'getOutputs': result = getSheetData("Outputs"); break;
      case 'getClosings': result = getSheetData("Closings"); break;
      case 'getPriceHistory': result = getSheetData("PriceHistory"); break;
      case 'setup': result = setupSheet(); break;
      default: throw new Error("Acción no reconocida");
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({error: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    setupSheet();
    sheet = ss.getSheetByName(name);
  }
  return sheet;
}

function getSheetData(name) {
  const sheet = getSheet(name);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0];
  return values.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function getProducts() {
  return getSheetData("Products");
}

function getEnvelopes() {
  return getSheetData("Envelopes");
}

function saveProduct(p) {
  const sheet = getSheet("Products");
  const data = sheet.getDataRange().getValues();
  let foundIndex = -1;
  
  for(let i=1; i<data.length; i++) {
    if(data[i][0] === p.id) {
      foundIndex = i + 1;
      break;
    }
  }
  
  const row = [
    p.id, p.code || "", p.name, p.grams || "", p.flavor || "", 
    p.costPrice || 0, p.salePrice || 0, p.stock || 0, p.category || "", 
    p.provider || "", p.totalInvested || 0, p.totalEarned || 0,
    p.totalInputs || 0, p.totalOutputs || 0
  ];
  
  if(foundIndex > -1) {
    sheet.getRange(foundIndex, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  return {success: true};
}

function deleteProduct(id) {
  const sheet = getSheet("Products");
  const data = sheet.getDataRange().getValues();
  for(let i=1; i<data.length; i++) {
    if(data[i][0] === id) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
  return {success: true};
}

function saveRestockNote(note) {
  const noteSheet = getSheet("PurchaseNotes");
  noteSheet.appendRow([note.id, note.date, note.provider, note.totalAmount, note.status, note.detailsJson]);
  
  const details = JSON.parse(note.detailsJson);
  const inputSheet = getSheet("Inputs");
  const productSheet = getSheet("Products");
  const productData = productSheet.getDataRange().getValues();
  const headers = productData[0];
  const inputCol = headers.indexOf("totalInputs") + 1;
  
  details.forEach(item => {
    inputSheet.appendRow([
      Utilities.getUuid(), item.productId, item.productName, item.quantity, 
      item.unitCost, item.totalCost, note.date, note.provider
    ]);
    
    for(let i=1; i<productData.length; i++) {
      if(productData[i][0] === item.productId) {
        let currentStock = Number(productData[i][7]);
        let currentInvested = Number(productData[i][10]);
        let currentInputs = Number(productData[i][inputCol - 1] || 0);
        
        productSheet.getRange(i+1, 8).setValue(currentStock + item.quantity);
        productSheet.getRange(i+1, 6).setValue(item.unitCost);
        productSheet.getRange(i+1, 11).setValue(currentInvested + item.totalCost);
        if(inputCol > 0) productSheet.getRange(i+1, inputCol).setValue(currentInputs + item.quantity);
      }
    }
  });

  if (note.status === 'Paid') {
    updateEnvelopeBalance("ENV4", -note.totalAmount);
  }
  
  return {success: true};
}

function processPhysicalCount(counts, shift) {
  const productSheet = getSheet("Products");
  const outputSheet = getSheet("Outputs");
  const productData = productSheet.getDataRange().getValues();
  const headers = productData[0];
  const outputCol = headers.indexOf("totalOutputs") + 1;
  const date = new Date().toISOString();
  
  let totalSold = 0;
  let totalCOGS = 0;

  counts.forEach(count => {
    for(let i=1; i<productData.length; i++) {
      if(productData[i][0] === count.productId) {
        const systemStock = Number(productData[i][7]);
        const diff = systemStock - count.physicalCount;
        
        if (diff > 0) {
          const salePrice = Number(productData[i][6]);
          const costPrice = Number(productData[i][5]);
          const totalSale = diff * salePrice;
          const totalCost = diff * costPrice;
          
          totalSold += totalSale;
          totalCOGS += totalCost;
          
          outputSheet.appendRow([
            Utilities.getUuid(), count.productId, productData[i][2], 
            diff, salePrice, totalSale, date, shift
          ]);
          
          productSheet.getRange(i+1, 8).setValue(count.physicalCount);
          let currentEarned = Number(productData[i][11]);
          productSheet.getRange(i+1, 12).setValue(currentEarned + totalSale);
          
          if(outputCol > 0) {
            let currentOutputs = Number(productData[i][outputCol - 1] || 0);
            productSheet.getRange(i+1, outputCol).setValue(currentOutputs + diff);
          }
        }
      }
    }
  });

  const netProfit = totalSold - totalCOGS;
  saveClosing({id: Utilities.getUuid(), date, totalSold, netProfit, cogs: totalCOGS});

  const profitPerEnv = netProfit / 3;
  updateEnvelopeBalance("ENV1", profitPerEnv);
  updateEnvelopeBalance("ENV2", profitPerEnv);
  updateEnvelopeBalance("ENV3", profitPerEnv);
  updateEnvelopeBalance("ENV4", totalCOGS);

  return { totalSold, netProfit, totalCOGS };
}

function saveClosing(c) {
  const sheet = getSheet("Closings");
  sheet.appendRow([c.id, c.date, c.totalSold, c.netProfit, c.cogs]);
}

function updateEnvelopeBalance(id, amount) {
  const sheet = getSheet("Envelopes");
  const data = sheet.getDataRange().getValues();
  for(let i=1; i<data.length; i++) {
    if(data[i][0] === id) {
      const current = Number(data[i][2]);
      sheet.getRange(i+1, 3).setValue(current + amount);
      break;
    }
  }
}

function withdrawEnvelope(w) {
  const sheet = getSheet("Envelopes");
  const histSheet = getSheet("EnvelopeHistory");
  const data = sheet.getDataRange().getValues();
  for(let i=1; i<data.length; i++) { 
    if(data[i][0] === w.envelopeId) { 
      sheet.getRange(i+1, 3).setValue(0); 
      sheet.getRange(i+1, 5).setValue(new Date().toISOString());
      break; 
    } 
  }
  histSheet.appendRow([w.id, w.envelopeId, w.envelopeName, w.amount, w.startDate, w.endDate, w.durationText, w.notes]);
  return {success: true};
}

function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = {
    "Products": ["id", "code", "name", "grams", "flavor", "costPrice", "salePrice", "stock", "category", "provider", "totalInvested", "totalEarned", "totalInputs", "totalOutputs"],
    "Envelopes": ["id", "name", "balance", "description", "lastResetDate"],
    "EnvelopeHistory": ["id", "envelopeId", "envelopeName", "amount", "startDate", "endDate", "durationText", "notes"],
    "PurchaseNotes": ["id", "date", "provider", "totalAmount", "status", "detailsJson"],
    "Inputs": ["id", "productId", "productName", "quantity", "unitCost", "totalCost", "date", "provider"],
    "Outputs": ["id", "productId", "productName", "quantity", "salePrice", "totalSale", "date", "shift"],
    "Closings": ["id", "date", "totalSold", "netProfit", "cogs"],
    "PriceHistory": ["id", "productId", "productName", "field", "oldValue", "newValue", "date"]
  };

  for (let name in sheets) {
    if (!ss.getSheetByName(name)) {
      let s = ss.insertSheet(name);
      s.appendRow(sheets[name]);
      if (name === "Envelopes") {
        const now = new Date().toISOString();
        s.appendRow(["ENV1", "Sobre 1 - Operativo", 0, "1/3 de Utilidad para gastos", now]);
        s.appendRow(["ENV2", "Sobre 2 - Ahorro", 0, "1/3 de Utilidad para fondo", now]);
        s.appendRow(["ENV3", "Sobre 3 - Ganancia", 0, "1/3 de Utilidad personal", now]);
        s.appendRow(["ENV4", "Sobre 4 - Capital", 0, "Fondo de Resurtido (100% Costo)", now]);
      }
    }
  }
  return {success: true};
}
