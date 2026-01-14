
/**
 * tiendita - Backend API v10.0
 * Sistema robusto de gestión financiera y persistencia en Google Sheets.
 */

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // Protección transaccional
    let params;
    try {
      params = JSON.parse(e.postData.contents);
    } catch (err) {
      return createResponse({error: "JSON inválido"});
    }
    
    const action = params.action;
    const data = params.data;
    let result;

    // Normalización de ID para acciones de borrado que pueden recibir objeto o string
    const extractId = (d) => (d && typeof d === 'object' ? d.id : d);

    switch(action) {
      // --- LECTURA ---
      case 'getProducts': result = getSheetData("Products"); break;
      case 'getEnvelopes': result = getSheetData("Envelopes"); break;
      case 'getEnvelopeHistory': result = getSheetData("EnvelopeHistory"); break;
      case 'getPurchaseNotes': result = getSheetData("PurchaseNotes"); break;
      case 'getInputs': result = getSheetData("Inputs"); break;
      case 'getOutputs': result = getSheetData("Outputs"); break;
      case 'getClosings': result = getSheetData("Closings"); break;
      case 'getPriceHistory': result = getSheetData("PriceHistory"); break;

      // --- SOBRES ---
      case 'saveEnvelope': result = saveEnvelope(data); break;
      case 'withdrawEnvelope': result = withdrawEnvelope(data); break;
      case 'updateWithdrawal': result = updateWithdrawal(data); break;
      case 'deleteWithdrawal': result = deleteWithdrawal(extractId(data)); break;

      // --- OPERACIONES ---
      case 'saveProduct': result = saveProduct(data); break;
      case 'savePurchaseNote': result = savePurchaseNote(data); break;
      case 'saveOutputBatch': result = saveOutputBatch(data); break;
      case 'saveClosing': result = saveClosing(data); break;
      case 'updateNoteStatus': result = updateNoteStatus(data.id, data.status); break;
      case 'processPhysicalCount': result = processPhysicalCount(data.counts, data.shift); break;
      
      // --- BORRADO ---
      case 'deleteProduct': result = deleteProduct(extractId(data)); break;
      case 'deleteInput': result = deleteInput(extractId(data)); break;
      case 'deletePurchaseNote': result = deletePurchaseNote(extractId(data)); break;
      
      case 'setup': result = setupSheet(); break;
      default: throw new Error("Acción no reconocida: " + action);
    }
    return createResponse(result);
  } catch (error) {
    return createResponse({error: error.toString()});
  } finally {
    lock.releaseLock();
  }
}

// --- GESTIÓN DE SOBRES ---

function updateEnvelopeBalance(id, amount) {
  if (!id) return false;
  const sheet = getSheet("Envelopes");
  const data = sheet.getDataRange().getValues();
  const searchId = id.toString().trim().toUpperCase();
  
  for(let i = 1; i < data.length; i++) {
    if(data[i][0].toString().trim().toUpperCase() === searchId) {
      const currentBalance = Number(data[i][2] || 0);
      sheet.getRange(i + 1, 3).setValue(currentBalance + Number(amount));
      return true;
    }
  }
  return false;
}

function saveEnvelope(env) {
  const headers = ["id", "name", "balance", "description", "lastResetDate"];
  const sheet = getSheet("Envelopes");
  const values = sheet.getDataRange().getValues();
  const searchId = env.id.toString().trim().toUpperCase();
  
  let foundRow = -1;
  for(let i = 1; i < values.length; i++) {
    if(values[i][0].toString().trim().toUpperCase() === searchId) {
      foundRow = i + 1;
      break;
    }
  }

  if(foundRow > -1) {
    sheet.getRange(foundRow, 2).setValue(env.name);
    sheet.getRange(foundRow, 4).setValue(env.description);
    return {success: true, updated: true};
  } else {
    const rowData = headers.map(h => env[h] !== undefined ? env[h] : "");
    sheet.appendRow(rowData);
    return {success: true, created: true};
  }
}

function withdrawEnvelope(w) {
  const headers = ["id", "envelopeId", "envelopeName", "amount", "startDate", "endDate", "durationText", "notes"];
  const sheet = getSheet("EnvelopeHistory");
  const rowData = headers.map(h => w[h] !== undefined ? w[h] : "");
  sheet.appendRow(rowData);
  updateEnvelopeBalance(w.envelopeId, -Number(w.amount));
  return {success: true};
}

function updateWithdrawal(w) {
  const sheet = getSheet("EnvelopeHistory");
  const data = sheet.getDataRange().getValues();
  const searchId = w.id.toString().trim().toUpperCase();
  
  for(let i = 1; i < data.length; i++) {
    if(data[i][0].toString().trim().toUpperCase() === searchId) {
      const oldAmount = Number(data[i][3] || 0);
      const newAmount = Number(w.amount);
      const diff = oldAmount - newAmount;
      
      sheet.getRange(i + 1, 4).setValue(newAmount);
      sheet.getRange(i + 1, 8).setValue(w.notes);
      updateEnvelopeBalance(w.envelopeId, diff);
      return {success: true};
    }
  }
  return {error: "Retiro no encontrado"};
}

function deleteWithdrawal(id) {
  if (!id) return {error: "ID de retiro no proporcionado"};
  const sheet = getSheet("EnvelopeHistory");
  const data = sheet.getDataRange().getValues();
  const searchId = id.toString().trim().toUpperCase();
  
  for(let i = 1; i < data.length; i++) {
    if(data[i][0].toString().trim().toUpperCase() === searchId) {
      const amountToRestore = Number(data[i][3] || 0);
      const envId = data[i][1];
      updateEnvelopeBalance(envId, amountToRestore);
      sheet.deleteRow(i + 1);
      return {success: true};
    }
  }
  return {error: "No se encontró el retiro para eliminar"};
}

// --- OPERACIONES DE INVENTARIO ---

function processPhysicalCount(counts, shift) {
  if (!Array.isArray(counts)) return {error: "Formato de conteo inválido"};
  
  const prodSheet = getSheet("Products");
  const outSheet = getSheet("Outputs");
  const prodData = prodSheet.getDataRange().getValues();
  const headers = prodData[0];
  
  const idIdx = 0;
  const stockIdx = headers.indexOf("stock");
  const costIdx = headers.indexOf("costPrice");
  const saleIdx = headers.indexOf("salePrice");
  const earnedIdx = headers.indexOf("totalEarned");
  const outsIdx = headers.indexOf("totalOutputs");

  let totalCOGS = 0;
  let totalProfit = 0;

  counts.forEach(count => {
    const searchId = count.productId.toString().trim().toUpperCase();
    for (let i = 1; i < prodData.length; i++) {
      if (prodData[i][idIdx].toString().trim().toUpperCase() === searchId) {
        const sysStock = Number(prodData[i][stockIdx] || 0);
        const phyStock = Number(count.physicalCount);
        const diff = sysStock - phyStock;

        if (diff > 0) {
          const cost = Number(prodData[i][costIdx] || 0);
          const sale = Number(prodData[i][saleIdx] || 0);
          const itemCOGS = diff * cost;
          const itemSaleTotal = diff * sale;
          const itemProfit = itemSaleTotal - itemCOGS;

          totalCOGS += itemCOGS;
          totalProfit += itemProfit;

          outSheet.appendRow([
            "PHYS-" + Utilities.getUuid(),
            count.productId,
            prodData[i][headers.indexOf("name")],
            diff,
            sale,
            itemSaleTotal,
            new Date().toISOString(),
            shift || "Ajuste Físico"
          ]);
          
          prodSheet.getRange(i + 1, stockIdx + 1).setValue(phyStock);
          prodSheet.getRange(i + 1, earnedIdx + 1).setValue(Number(prodData[i][earnedIdx] || 0) + itemProfit);
          prodSheet.getRange(i + 1, outsIdx + 1).setValue(Number(prodData[i][outsIdx] || 0) + diff);
        }
        break;
      }
    }
  });

  updateEnvelopeBalance("ENV4", totalCOGS);
  if (totalProfit > 0) {
    const part = totalProfit / 3;
    ["ENV1", "ENV2", "ENV3"].forEach(id => updateEnvelopeBalance(id, part));
  }
  return { success: true, totalProfit, totalCOGS };
}

function saveOutputBatch(outputs) {
  if (!Array.isArray(outputs)) return {error: "Datos de salida inválidos"};
  const outSheet = getSheet("Outputs");
  const prodSheet = getSheet("Products");
  const prodData = prodSheet.getDataRange().getValues();
  const headers = prodData[0];
  const stockIdx = headers.indexOf("stock");
  const earnedIdx = headers.indexOf("totalEarned");
  const costIdx = headers.indexOf("costPrice");
  
  let totalCOGS = 0;
  let totalProfit = 0;

  outputs.forEach(o => {
    outSheet.appendRow([o.id, o.productId, o.productName, o.quantity, o.salePrice, o.totalSale, o.date, o.shift]);
    const searchId = o.productId.toString().trim().toUpperCase();
    
    for(let i = 1; i < prodData.length; i++) {
      if(prodData[i][0].toString().trim().toUpperCase() === searchId) {
        const cost = Number(prodData[i][costIdx] || 0);
        const itemCOGS = Number(o.quantity) * cost;
        const itemProfit = Number(o.totalSale) - itemCOGS;
        
        totalCOGS += itemCOGS;
        totalProfit += itemProfit;
        
        const currentStock = Number(prodData[i][stockIdx] || 0);
        prodSheet.getRange(i + 1, stockIdx + 1).setValue(currentStock - Number(o.quantity));
        prodSheet.getRange(i + 1, earnedIdx + 1).setValue(Number(prodData[i][earnedIdx] || 0) + itemProfit);
        break;
      }
    }
  });

  updateEnvelopeBalance("ENV4", totalCOGS);
  if(totalProfit > 0) {
    const part = totalProfit / 3;
    ["ENV1", "ENV2", "ENV3"].forEach(id => updateEnvelopeBalance(id, part));
  }
  return {success: true};
}

// --- PERSISTENCIA Y FUNCIONES AUXILIARES ---

function upsertToSheet(name, headers, obj, key) {
  const sheet = getSheet(name);
  const values = sheet.getDataRange().getValues();
  const rowData = headers.map(h => obj[h] !== undefined ? obj[h] : "");
  const targetId = obj[key].toString().trim().toUpperCase();
  let found = -1;
  for(let i = 1; i < values.length; i++) {
    if(values[i][0].toString().trim().toUpperCase() === targetId) { found = i + 1; break; }
  }
  if(found > -1) sheet.getRange(found, 1, 1, headers.length).setValues([rowData]);
  else sheet.appendRow(rowData);
  return {success: true};
}

function deleteRow(sheetName, id) {
  if (!id) return false;
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  const searchId = id.toString().trim().toUpperCase();
  for(let i = 1; i < data.length; i++) {
    if(data[i][0].toString().trim().toUpperCase() === searchId) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

function getSheetData(name) {
  const sheet = getSheet(name);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0];
  return values.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => {
      let val = row[i];
      if (val instanceof Date) val = val.toISOString();
      obj[h] = val;
    });
    return obj;
  });
}

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// --- WRAPPERS DE ACCIÓN ---

function saveProduct(p) {
  const headers = ["id", "code", "name", "grams", "flavor", "costPrice", "salePrice", "stock", "category", "provider", "totalInvested", "totalEarned", "totalInputs", "totalOutputs"];
  return upsertToSheet("Products", headers, p, "id");
}

function savePurchaseNote(note) {
  const headers = ["id", "date", "provider", "totalAmount", "status", "detailsJson"];
  upsertToSheet("PurchaseNotes", headers, note, "id");
  if (note.status === 'Paid') updateEnvelopeBalance("ENV4", -Number(note.totalAmount));
  return {success: true};
}

function updateNoteStatus(id, status) {
  const sheet = getSheet("PurchaseNotes");
  const data = sheet.getDataRange().getValues();
  const searchId = id.toString().trim().toUpperCase();
  for(let i = 1; i < data.length; i++) {
    if(data[i][0].toString().trim().toUpperCase() === searchId) {
      const currentStatus = data[i][4];
      if (currentStatus !== 'Paid' && status === 'Paid') {
        updateEnvelopeBalance("ENV4", -Number(data[i][3]));
      }
      sheet.getRange(i + 1, 5).setValue(status);
      return {success: true};
    }
  }
  return {error: "Nota no encontrada"};
}

function deleteProduct(id) { return {success: deleteRow("Products", id)}; }
function deleteInput(id) { return {success: deleteRow("Inputs", id)}; }
function deletePurchaseNote(id) { return {success: deleteRow("PurchaseNotes", id)}; }

function saveClosing(c) {
  const headers = ["id", "date", "totalSold", "netProfit", "cogs"];
  return upsertToSheet("Closings", headers, c, "id");
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
      let s = ss.insertSheet(name); s.appendRow(sheets[name]);
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
