
/**
 * tiendita - Backend API v4.0
 * Búsqueda robusta de IDs y gestión completa de eliminación.
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
      case 'saveEnvelope': result = saveEnvelope(data); break;
      case 'deleteProduct': result = deleteProduct(data); break;
      case 'withdrawEnvelope': result = withdrawEnvelope(data); break;
      case 'deleteWithdrawal': result = deleteWithdrawal(data); break;
      case 'updateWithdrawal': result = updateWithdrawal(data); break;
      case 'deleteInput': result = deleteInput(data); break;
      case 'deletePurchaseNote': result = deletePurchaseNote(data); break;
      case 'getEnvelopeHistory': result = getSheetData("EnvelopeHistory"); break;
      case 'getPurchaseNotes': result = getSheetData("PurchaseNotes"); break;
      case 'getInputs': result = getSheetData("Inputs"); break;
      case 'getOutputs': result = getSheetData("Outputs"); break;
      case 'getClosings': result = getSheetData("Closings"); break;
      case 'getPriceHistory': result = getSheetData("PriceHistory"); break;
      case 'updateNoteStatus': result = updateNoteStatus(data.id, data.status); break;
      case 'processPhysicalCount': result = processPhysicalCount(data.counts, data.shift); break;
      case 'setup': result = setupSheet(); break;
      default: throw new Error("Acción no reconocida: " + action);
    }
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({error: error.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

// --- FUNCIONES DE PERSISTENCIA ROBUSTA ---

function saveEnvelope(env) {
  const sheet = getSheet("Envelopes");
  const data = sheet.getDataRange().getValues();
  let foundIndex = -1;
  const targetId = env.id.toString().trim().toUpperCase();
  for(let i=1; i<data.length; i++) {
    if(data[i][0].toString().trim().toUpperCase() === targetId) {
      foundIndex = i + 1; break;
    }
  }
  const row = [env.id, env.name, Number(env.balance), env.description || "", env.lastResetDate || new Date().toISOString()];
  if(foundIndex > -1) { sheet.getRange(foundIndex, 1, 1, row.length).setValues([row]); } 
  else { sheet.appendRow(row); }
  return {success: true};
}

function saveProduct(p) {
  const sheet = getSheet("Products");
  const data = sheet.getDataRange().getValues();
  let foundIndex = -1;
  const targetId = p.id.toString().trim();
  for(let i=1; i<data.length; i++) {
    if(data[i][0].toString().trim() === targetId) {
      foundIndex = i + 1; break;
    }
  }
  const row = [p.id, p.code || "", p.name, p.grams || "", p.flavor || "", Number(p.costPrice) || 0, Number(p.salePrice) || 0, Number(p.stock) || 0, p.category || "", p.provider || "", Number(p.totalInvested) || 0, Number(p.totalEarned) || 0, Number(p.totalInputs) || 0, Number(p.totalOutputs) || 0];
  if(foundIndex > -1) { sheet.getRange(foundIndex, 1, 1, row.length).setValues([row]); } 
  else { sheet.appendRow(row); }
  return {success: true};
}

// --- FUNCIONES DE ELIMINACIÓN ---

function deleteProduct(id) {
  const sheet = getSheet("Products");
  const data = sheet.getDataRange().getValues();
  const targetId = id.toString().trim();
  for(let i=1; i<data.length; i++) {
    if(data[i][0].toString().trim() === targetId) {
      sheet.deleteRow(i + 1); break;
    }
  }
  return {success: true};
}

function deleteInput(id) {
  const sheet = getSheet("Inputs");
  const data = sheet.getDataRange().getValues();
  const targetId = id.toString().trim();
  for(let i=1; i<data.length; i++) {
    if(data[i][0].toString().trim() === targetId) {
      const prodId = data[i][1];
      const qty = Number(data[i][3]);
      // Revertir stock del producto
      adjustProductStock(prodId, -qty);
      sheet.deleteRow(i + 1);
      break;
    }
  }
  return {success: true};
}

function deletePurchaseNote(id) {
  const sheet = getSheet("PurchaseNotes");
  const data = sheet.getDataRange().getValues();
  const targetId = id.toString().trim();
  for(let i=1; i<data.length; i++) {
    if(data[i][0].toString().trim() === targetId) {
      sheet.deleteRow(i + 1); break;
    }
  }
  return {success: true};
}

function deleteWithdrawal(withdrawalId) {
  const histSheet = getSheet("EnvelopeHistory");
  const histData = histSheet.getDataRange().getValues();
  const targetId = withdrawalId.toString().trim();
  for(let i=1; i<histData.length; i++) {
    if(histData[i][0].toString().trim() === targetId) {
      updateEnvelopeBalance(histData[i][1], Number(histData[i][3]));
      histSheet.deleteRow(i + 1);
      break;
    }
  }
  return {success: true};
}

// --- UTILIDADES ---

function adjustProductStock(id, diff) {
  const sheet = getSheet("Products");
  const data = sheet.getDataRange().getValues();
  const targetId = id.toString().trim();
  for(let i=1; i<data.length; i++) {
    if(data[i][0].toString().trim() === targetId) {
      const current = Number(data[i][7]);
      sheet.getRange(i+1, 8).setValue(current + diff);
      break;
    }
  }
}

function updateEnvelopeBalance(id, amount) {
  const sheet = getSheet("Envelopes");
  const data = sheet.getDataRange().getValues();
  const targetId = id.toString().trim().toUpperCase();
  for(let i=1; i<data.length; i++) {
    if(data[i][0].toString().trim().toUpperCase() === targetId) {
      const current = Number(data[i][2]);
      sheet.getRange(i+1, 3).setValue(current + amount);
      break;
    }
  }
}

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) { setupSheet(); sheet = ss.getSheetByName(name); }
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
