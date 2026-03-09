
/**
 * tiendita - Backend API v11.1 (Stable Finance)
 * Correcciones de persistencia, normalización de decimales y lógica de traspaso de sobres.
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

/**
 * Normaliza cualquier valor a número, manejando comas decimales y caracteres no numéricos.
 */
function parseAmount(val) {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return val;
  // Reemplaza coma por punto y elimina caracteres no numéricos excepto el punto y el signo menos
  const cleaned = val.toString().replace(',', '.').replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Actualiza el balance de un sobre específico.
 */
function updateEnvelopeBalance(id, amount) {
  if (!id) return false;
  const sheet = getSheet("Envelopes");
  const data = sheet.getDataRange().getValues();
  const searchId = id.toString().trim().toUpperCase();
  const numericAmount = parseAmount(amount);
  
  for(let i = 1; i < data.length; i++) {
    if(data[i][0].toString().trim().toUpperCase() === searchId) {
      const currentBalance = parseAmount(data[i][2]);
      const newBalance = currentBalance + numericAmount;
      sheet.getRange(i + 1, 3).setValue(newBalance);
      return true;
    }
  }
  return false;
}

// --- GESTIÓN DE SOBRES (MEJORADA) ---

function saveEnvelope(env) {
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
    return {success: true};
  } else {
    const headers = ["id", "name", "balance", "description", "lastResetDate"];
    const rowData = headers.map(h => {
      if (h === 'balance') return parseAmount(env[h]);
      return env[h] !== undefined ? env[h] : "";
    });
    sheet.appendRow(rowData);
    return {success: true};
  }
}

function withdrawEnvelope(w) {
  const headers = ["id", "envelopeId", "envelopeName", "amount", "startDate", "endDate", "durationText", "notes"];
  const amountToWithdraw = parseAmount(w.amount);
  
  const rowData = headers.map(h => {
    if (h === 'amount') return amountToWithdraw;
    return w[h] !== undefined ? w[h] : "";
  });
  
  getSheet("EnvelopeHistory").appendRow(rowData);
  updateEnvelopeBalance(w.envelopeId, -amountToWithdraw);
  return {success: true};
}

function updateWithdrawal(w) {
  const sheet = getSheet("EnvelopeHistory");
  const data = sheet.getDataRange().getValues();
  const searchId = w.id.toString().trim().toUpperCase();
  
  for(let i = 1; i < data.length; i++) {
    if(data[i][0].toString().trim().toUpperCase() === searchId) {
      const oldAmount = parseAmount(data[i][3]);
      const oldEnvId = data[i][1];
      const newAmount = parseAmount(w.amount);
      const newEnvId = w.envelopeId;

      if (oldEnvId === newEnvId) {
        // Mismo sobre: ajustamos la diferencia
        const diff = oldAmount - newAmount; 
        updateEnvelopeBalance(oldEnvId, diff);
      } else {
        // Cambio de sobre: revertimos el viejo y cobramos el nuevo
        updateEnvelopeBalance(oldEnvId, oldAmount);     // Devolvemos íntegro al original
        updateEnvelopeBalance(newEnvId, -newAmount);   // Descontamos del nuevo
      }
      
      // Actualizamos la fila en el historial
      sheet.getRange(i + 1, 2).setValue(newEnvId);
      sheet.getRange(i + 1, 3).setValue(w.envelopeName);
      sheet.getRange(i + 1, 4).setValue(newAmount);
      sheet.getRange(i + 1, 8).setValue(w.notes);
      
      return {success: true};
    }
  }
  return {error: "Registro no encontrado"};
}

function deleteWithdrawal(id) {
  const sheet = getSheet("EnvelopeHistory");
  const data = sheet.getDataRange().getValues();
  const searchId = id.toString().trim().toUpperCase();
  
  for(let i = 1; i < data.length; i++) {
    if(data[i][0].toString().trim().toUpperCase() === searchId) {
      const amountToRestore = parseAmount(data[i][3]);
      const envId = data[i][1];
      
      updateEnvelopeBalance(envId, amountToRestore);
      sheet.deleteRow(i + 1);
      return {success: true};
    }
  }
  return {error: "No se encontró el retiro"};
}

// --- INVENTARIO Y OPERACIONES ---

function processPhysicalCount(counts, shift) {
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
  let totalSold = 0;

  counts.forEach(count => {
    const searchId = count.productId.toString().trim().toUpperCase();
    for (let i = 1; i < prodData.length; i++) {
      if (prodData[i][idIdx].toString().trim().toUpperCase() === searchId) {
        const sysStock = parseAmount(prodData[i][stockIdx]);
        const phyStock = parseAmount(count.physicalCount);
        const diff = sysStock - phyStock;

        if (diff > 0) {
          const cost = parseAmount(prodData[i][costIdx]);
          const sale = parseAmount(prodData[i][saleIdx]);
          const itemCOGS = diff * cost;
          const itemSale = diff * sale;
          const itemProfit = itemSale - itemCOGS;

          totalCOGS += itemCOGS;
          totalProfit += itemProfit;
          totalSold += itemSale;

          outSheet.appendRow([
            "PHYS-" + Utilities.getUuid(),
            count.productId,
            prodData[i][headers.indexOf("name")],
            diff,
            sale,
            itemSale,
            new Date().toISOString(),
            shift
          ]);
          
          prodSheet.getRange(i + 1, stockIdx + 1).setValue(phyStock);
          const currentEarned = parseAmount(prodData[i][earnedIdx]);
          prodSheet.getRange(i + 1, earnedIdx + 1).setValue(currentEarned + itemProfit);
          const currentOuts = parseAmount(prodData[i][outsIdx]);
          prodSheet.getRange(i + 1, outsIdx + 1).setValue(currentOuts + diff);
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
  return { success: true, totalProfit, totalCOGS, totalSold, netProfit: totalProfit };
}

function savePurchaseNote(note) {
  const headers = ["id", "date", "provider", "totalAmount", "status", "detailsJson"];
  const amount = parseAmount(note.totalAmount);
  
  upsertToSheet("PurchaseNotes", headers, {...note, totalAmount: amount}, "id");
  if (note.status === 'Paid') updateEnvelopeBalance("ENV4", -amount);
  return {success: true};
}

function updateNoteStatus(id, status) {
  const sheet = getSheet("PurchaseNotes");
  const data = sheet.getDataRange().getValues();
  const searchId = id.toString().trim().toUpperCase();
  for(let i = 1; i < data.length; i++) {
    if(data[i][0].toString().trim().toUpperCase() === searchId) {
      if (data[i][4] !== 'Paid' && status === 'Paid') {
        const amount = parseAmount(data[i][3]);
        updateEnvelopeBalance("ENV4", -amount);
      }
      sheet.getRange(i + 1, 5).setValue(status);
      return {success: true};
    }
  }
  return {error: "No encontrada"};
}

function saveProduct(p) {
  const headers = ["id", "code", "name", "grams", "flavor", "costPrice", "salePrice", "stock", "category", "provider", "totalInvested", "totalEarned", "totalInputs", "totalOutputs"];
  const cleanP = {...p};
  ["costPrice", "salePrice", "stock", "totalInvested", "totalEarned", "totalInputs", "totalOutputs"].forEach(key => {
    if (cleanP[key] !== undefined) cleanP[key] = parseAmount(cleanP[key]);
  });
  return upsertToSheet("Products", headers, cleanP, "id");
}

function saveOutputBatch(outputs) {
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
        const cost = parseAmount(prodData[i][costIdx]);
        const itemCOGS = parseAmount(o.quantity) * cost;
        const itemProfit = parseAmount(o.totalSale) - itemCOGS;
        totalCOGS += itemCOGS;
        totalProfit += itemProfit;
        
        const currentStock = parseAmount(prodData[i][stockIdx]);
        prodSheet.getRange(i + 1, stockIdx + 1).setValue(currentStock - parseAmount(o.quantity));
        const currentEarned = parseAmount(prodData[i][earnedIdx]);
        prodSheet.getRange(i + 1, earnedIdx + 1).setValue(currentEarned + itemProfit);
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

// --- UTILIDADES ---

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
