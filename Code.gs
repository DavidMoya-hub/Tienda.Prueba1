
/**
 * tiendita - Backend API v11.1 (Stable Finance)
 * Correcciones de persistencia, normalización de decimales y lógica de traspaso de sobres.
 */

function doGet(e) {
  const action = e.parameter.action;
  let result;
  switch(action) {
    case 'getProducts': result = getSheetData("Products"); break;
    case 'getEnvelopes': result = getSheetData("Envelopes"); break;
    case 'getEnvelopeHistory': result = getSheetData("EnvelopeHistory"); break;
    case 'getPurchaseNotes': result = getSheetData("PurchaseNotes"); break;
    case 'getInputs': result = getSheetData("Inputs"); break;
    case 'getOutputs': result = getSheetData("Outputs"); break;
    case 'getClosings': result = getSheetData("Closings"); break;
    case 'getPriceHistory': result = getSheetData("PriceHistory"); break;
    default: result = {error: "Acción no reconocida o no soportada vía GET"};
  }
  return createResponse(result);
}

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
      case 'updateEnvelope': result = updateEnvelope(data); break;
      case 'withdrawEnvelope': result = withdrawEnvelope(data); break;
      case 'updateWithdrawal': result = updateWithdrawal(data); break;
      case 'deleteWithdrawal': result = deleteWithdrawal(extractId(data)); break;

      // --- OPERACIONES ---
      case 'saveProduct': result = saveProduct(data); break;
      case 'savePurchaseNote': result = savePurchaseNote(data); break;
      case 'saveInput': result = saveInput(data); break;
      case 'saveOutput': result = saveOutput(data); break;
      case 'saveOutputBatch': result = saveOutputBatch(data); break;
      case 'saveClosing': result = saveClosing(data); break;
      case 'saveMasterClosing': result = saveMasterClosing(data); break;
      case 'updateClosing': result = updateClosing(data.id, data.newData); break;
      case 'savePriceHistory': result = savePriceHistory(data); break;
      case 'updateNoteStatus': result = updateNoteStatus(data.id, data.status, data.source); break;
      case 'updatePurchaseNoteDetails': result = updatePurchaseNoteDetails(data); break;
      case 'processPhysicalCount': result = processPhysicalCount(data.counts, data.shift); break;
      
      // --- BORRADO ---
      case 'deleteProduct': result = deleteProduct(extractId(data)); break;
      case 'deleteInput': result = deleteInput(extractId(data)); break;
      case 'deleteOutput': result = deleteOutput(extractId(data)); break;
      case 'deleteClosing': result = deleteClosing(extractId(data)); break;
      case 'deletePriceHistory': result = deletePriceHistory(extractId(data)); break;
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

/**
 * Actualiza datos de un sobre (balance, porcentaje, etc.)
 */
function updateEnvelope(data) {
  try {
    const sheet = getSheet('Envelopes');
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];

    const idIndex = headers.indexOf('id');
    const nameIndex = headers.indexOf('name');
    const balanceIndex = headers.indexOf('balance');
    const descIndex = headers.indexOf('description');
    const percentIndex = headers.indexOf('percentage');

    const searchId = data.id.toString().trim().toUpperCase();

    for (let i = 1; i < values.length; i++) {
      if (values[i][idIndex].toString().trim().toUpperCase() === searchId) {
        // Actualizar solo los campos que vienen en el payload
        if (data.name !== undefined && nameIndex !== -1) {
          sheet.getRange(i + 1, nameIndex + 1).setValue(data.name);
        }
        if (data.balance !== undefined && balanceIndex !== -1) {
          sheet.getRange(i + 1, balanceIndex + 1).setValue(parseAmount(data.balance));
        }
        if (data.description !== undefined && descIndex !== -1) {
          sheet.getRange(i + 1, descIndex + 1).setValue(data.description);
        }
        if (data.percentage !== undefined && percentIndex !== -1) {
          sheet.getRange(i + 1, percentIndex + 1).setValue(parseAmount(data.percentage));
        }
        return { success: true, message: 'Sobre actualizado' };
      }
    }
    throw new Error("Sobre no encontrado: " + data.id);
  } catch (e) {
    return { error: e.toString() };
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
  const stockIdx = headers.indexOf("CANT EXT") !== -1 ? headers.indexOf("CANT EXT") : headers.indexOf("stock");
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
            shift,
            "Ajuste de Inventario Físico",
            "exit"
          ]);
          
          prodSheet.getRange(i + 1, stockIdx + 1).setValue(Number(phyStock));
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
  const sheet = getSheet("PurchaseNotes");
  const data = sheet.getDataRange().getValues();
  const searchId = note.id.toString().trim().toUpperCase();
  let isNew = true;
  
  for(let i = 1; i < data.length; i++) {
    if(data[i][0].toString().trim().toUpperCase() === searchId) {
      isNew = false;
      break;
    }
  }

  const headers = ["id", "date", "provider", "totalAmount", "status", "detailsJson", "paymentSource"];
  const amount = parseAmount(note.totalAmount);
  
  upsertToSheet("PurchaseNotes", headers, {...note, totalAmount: amount}, "id");
  
  // Solo registrar entradas individuales si es una nota NUEVA
  if (isNew) {
    try {
      const details = JSON.parse(note.detailsJson);
      const inputSheet = getSheet("Inputs");
      const inputHeaders = ["id", "productId", "productName", "quantity", "unitCost", "totalCost", "date", "provider", "notes", "type"];
      
      details.forEach(item => {
        const inputRow = inputHeaders.map(h => {
          if (h === 'id') return "INP-" + Utilities.getUuid();
          if (h === 'productId') return item.productId;
          if (h === 'productName') return item.productName;
          if (h === 'quantity') return parseAmount(item.quantity);
          if (h === 'unitCost') return parseAmount(item.unitCost);
          if (h === 'totalCost') return parseAmount(item.totalCost);
          if (h === 'date') return note.date;
          if (h === 'provider') return note.provider;
          if (h === 'notes') return "Compra: " + note.id;
          if (h === 'type') return "entry";
          return "";
        });
        inputSheet.appendRow(inputRow);
        
        // Actualizar stock y totalInvested en Products
        updateProductStock(item.productId, parseAmount(item.quantity), parseAmount(item.totalCost), true);
        // Actualizar precio de costo maestro
        updateProductCostPrice(item.productId, parseAmount(item.unitCost));
      });
    } catch (e) {
      console.error("Error al procesar detalles de compra: " + e.message);
    }
  }

  if (note.status === 'Paid') updateEnvelopeBalance("ENV4", -amount);
  return {success: true};
}

function updateProductStock(productId, quantity, amount, isInput) {
  const sheet = getSheet("Products");
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return false;
  
  const headers = data[0];
  const idIdx = 0;
  
  // Buscamos las columnas con seguridad
  const stockIdx = headers.indexOf("stock");
  const investedIdx = headers.indexOf("totalInvested");
  const inputsIdx = headers.indexOf("totalInputs"); // Si no existe, será -1
  const outsIdx = headers.indexOf("totalOutputs");  // Si no existe, será -1
  
  const searchId = productId.toString().trim().toUpperCase();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx].toString().trim().toUpperCase() === searchId) {
      
      let finalStock = 0;
      // 1. Actualizar el Stock Principal (Solo si la columna existe)
      if (stockIdx > -1) {
        const currentStock = parseAmount(data[i][stockIdx]);
        finalStock = isInput ? currentStock + quantity : currentStock - quantity;
        sheet.getRange(i + 1, stockIdx + 1).setValue(finalStock);
      }
      
      // 2. Actualizar Estadísticas (Ignora las columnas si no las creaste en tu Excel)
      if (isInput) {
        if (investedIdx > -1) {
          const currentInvested = parseAmount(data[i][investedIdx]);
          sheet.getRange(i + 1, investedIdx + 1).setValue(currentInvested + amount);
        }
        if (inputsIdx > -1) {
          const currentInputs = parseAmount(data[i][inputsIdx]);
          sheet.getRange(i + 1, inputsIdx + 1).setValue(currentInputs + quantity);
        }
      } else {
        if (outsIdx > -1) {
           const currentOuts = parseAmount(data[i][outsIdx]);
           sheet.getRange(i + 1, outsIdx + 1).setValue(currentOuts + quantity);
        }
      }
      
      return { success: true, currentStock: finalStock };
    }
  }
  return false;
}

/**
 * Actualiza el precio de costo maestro de un producto.
 */
function updateProductCostPrice(productId, newCostPrice) {
  const sheet = getSheet("Products");
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return false;
  
  const headers = data[0];
  const costPriceIdx = headers.indexOf("costPrice");
  if (costPriceIdx === -1) return false;
  
  const searchId = productId.toString().trim().toUpperCase();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString().trim().toUpperCase() === searchId) {
      sheet.getRange(i + 1, costPriceIdx + 1).setValue(Number(newCostPrice));
      return true;
    }
  }
  return false;
}

function updateNoteStatus(id, status, source) {
  const sheet = getSheet("PurchaseNotes");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const statusIdx = headers.indexOf("status");
  const sourceIdx = headers.indexOf("paymentSource");
  const amountIdx = headers.indexOf("totalAmount");
  
  const searchId = id.toString().trim().toUpperCase();
  for(let i = 1; i < data.length; i++) {
    if(data[i][0].toString().trim().toUpperCase() === searchId) {
      const oldStatus = data[i][statusIdx];
      const amount = parseAmount(data[i][amountIdx]);

      if (oldStatus !== 'Paid' && status === 'Paid') {
        if (source === 'Capital') {
          updateEnvelopeBalance("ENV4", -amount);
        }
      } else if (oldStatus === 'Paid' && status === 'Pending') {
        const oldSource = sourceIdx > -1 ? data[i][sourceIdx] : 'Capital';
        if (oldSource === 'Capital') {
          updateEnvelopeBalance("ENV4", amount);
        }
      }
      
      sheet.getRange(i + 1, statusIdx + 1).setValue(status);
      if (sourceIdx > -1) {
        sheet.getRange(i + 1, sourceIdx + 1).setValue(source || "");
      }
      return {success: true};
    }
  }
  return {error: "No encontrada"};
}

function updatePurchaseNoteDetails(data) {
  const { id, totalAmount, detailsJson } = data;
  const noteId = id;
  const sheet = getSheet("PurchaseNotes");
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idIdx = 0;
  const totalIdx = headers.indexOf("totalAmount");
  const detailsIdx = headers.indexOf("detailsJson");
  const statusIdx = headers.indexOf("status");
  const dateIdx = headers.indexOf("date");
  const providerIdx = headers.indexOf("provider");

  const searchId = id.toString().trim().toUpperCase();
  let foundRow = -1;
  let oldDetailsJson = "";
  let oldTotalAmount = 0;
  let status = "";
  let noteDate = "";
  let noteProvider = "";

  for (let i = 1; i < values.length; i++) {
    if (values[i][idIdx].toString().trim().toUpperCase() === searchId) {
      foundRow = i + 1;
      oldDetailsJson = values[i][detailsIdx];
      oldTotalAmount = parseAmount(values[i][totalIdx]);
      status = values[i][statusIdx];
      noteDate = values[i][dateIdx];
      noteProvider = values[i][providerIdx];
      break;
    }
  }

  if (foundRow === -1) return { error: "Nota no encontrada" };

  // --- PASO B: REVERTIR STOCK ANTIGUO ---
  const oldDetails = JSON.parse(oldDetailsJson || '[]');
  oldDetails.forEach(item => {
    updateProductStock(item.productId, parseAmount(item.quantity), parseAmount(item.totalCost), false);
  });

  // --- PASO C: LIMPIAR ENTRADAS EN 'INPUTS' ---
  const inputSheet = getSheet("Inputs");
  const inputData = inputSheet.getDataRange().getValues();
  const noteMatch = "Compra: " + noteId;
  // Recorrer de abajo hacia arriba para borrar
  for (let i = inputData.length - 1; i >= 1; i--) {
    if (String(inputData[i][8]).trim() === noteMatch) {
      inputSheet.deleteRow(i + 1);
    }
  }

  // --- PASO D: REAPLICAR NUEVO ---
  const newDetails = JSON.parse(detailsJson || '[]');
  const inputHeaders = ["id", "productId", "productName", "quantity", "unitCost", "totalCost", "date", "provider", "notes", "type"];
  
  newDetails.forEach(item => {
    // SUMAR al inventario
    updateProductStock(item.productId, parseAmount(item.quantity), parseAmount(item.totalCost), true);
    
    // Escribir nueva fila en Inputs
    const inputRow = inputHeaders.map(h => {
      if (h === 'id') return "INP-" + Utilities.getUuid();
      if (h === 'productId') return item.productId;
      if (h === 'productName') return item.productName;
      if (h === 'quantity') return parseAmount(item.quantity);
      if (h === 'unitCost') return parseAmount(item.unitCost);
      if (h === 'totalCost') return parseAmount(item.totalCost);
      if (h === 'date') return noteDate;
      if (h === 'provider') return noteProvider;
      if (h === 'notes') return noteMatch;
      if (h === 'type') return "entry";
      return "";
    });
    inputSheet.appendRow(inputRow);
    // Actualizar precio de costo maestro
    updateProductCostPrice(item.productId, parseAmount(item.unitCost));
  });

  // Si la nota estaba pagada, ajustar el sobre 4 por la diferencia de total
  if (status === 'Paid') {
    const diffTotal = parseAmount(totalAmount) - oldTotalAmount;
    if (diffTotal !== 0) {
      updateEnvelopeBalance("ENV4", -diffTotal);
    }
  }

  // --- PASO E: ACTUALIZAR NOTA ---
  sheet.getRange(foundRow, totalIdx + 1).setValue(parseAmount(totalAmount));
  sheet.getRange(foundRow, detailsIdx + 1).setValue(detailsJson);

  return { success: true };
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
  const stockIdx = headers.indexOf("CANT EXT") !== -1 ? headers.indexOf("CANT EXT") : headers.indexOf("stock");
  const earnedIdx = headers.indexOf("totalEarned");
  const costIdx = headers.indexOf("costPrice");
  const outsIdx = headers.indexOf("totalOutputs");
  
  let totalCOGS = 0;
  let totalProfit = 0;

  outputs.forEach(o => {
    // ["id", "productId", "productName", "quantity", "salePrice", "totalSale", "date", "shift", "notes", "type"]
    outSheet.appendRow([
      o.id, 
      o.productId, 
      o.productName, 
      parseAmount(o.quantity), 
      parseAmount(o.salePrice), 
      parseAmount(o.totalSale), 
      o.date, 
      o.shift, 
      o.notes || "", 
      o.type || "exit"
    ]);
    
    const searchId = o.productId.toString().trim().toUpperCase();
    
    for(let i = 1; i < prodData.length; i++) {
      if(prodData[i][0].toString().trim().toUpperCase() === searchId) {
        const cost = parseAmount(prodData[i][costIdx]);
        const itemCOGS = parseAmount(o.quantity) * cost;
        const itemProfit = parseAmount(o.totalSale) - itemCOGS;
        totalCOGS += itemCOGS;
        totalProfit += itemProfit;
        
        const currentStock = parseAmount(prodData[i][stockIdx]);
        prodSheet.getRange(i + 1, stockIdx + 1).setValue(Number(currentStock - parseAmount(o.quantity)));
        const currentEarned = parseAmount(prodData[i][earnedIdx]);
        prodSheet.getRange(i + 1, earnedIdx + 1).setValue(currentEarned + itemProfit);
        const currentOuts = parseAmount(prodData[i][outsIdx]);
        prodSheet.getRange(i + 1, outsIdx + 1).setValue(currentOuts + parseAmount(o.quantity));
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
      let key = h === "CANT EXT" ? "stock" : h;
      obj[key] = val;
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

function deleteInput(id) { 
  const sheet = getSheet("Inputs");
  const data = sheet.getDataRange().getValues();
  const searchId = id.toString().trim().toUpperCase();
  
  for(let i = 1; i < data.length; i++) {
    if(data[i][0].toString().trim().toUpperCase() === searchId) {
      const productId = data[i][1];
      const quantity = parseAmount(data[i][3]);
      const totalCost = parseAmount(data[i][5]);
      const noteRef = (data[i][8] || "").replace('Compra: ', '').trim();
      
      // 1. Eliminar fila en Inputs
      sheet.deleteRow(i + 1);

      // 2. Restar cantidad antigua del inventario (SOLO Delta Cantidad)
      updateProductStock(productId, quantity, 0, false);
      
      // 3. Actualizar Nota Padre
      if (noteRef) {
        updateParentNoteAfterInputDelete(noteRef, productId, totalCost);
      }
      
      return {success: true};
    }
  }
  return {success: false, error: "No encontrado"};
}

/**
 * Actualiza el total y el JSON de detalles de una nota de compra tras borrar un input individual.
 * Si la nota queda vacía o sin monto, se elimina.
 */
function updateParentNoteAfterInputDelete(noteId, productId, inputTotalCost) {
  const sheet = getSheet("PurchaseNotes");
  const data = sheet.getDataRange().getValues();
  const searchId = noteId.toString().trim().toUpperCase();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString().trim().toUpperCase() === searchId) {
      const currentTotal = parseAmount(data[i][3]);
      const newTotal = Math.max(0, currentTotal - inputTotalCost);
      
      let details = [];
      try {
        details = JSON.parse(data[i][5] || "[]");
      } catch(e) {}
      
      // Filtrar el producto borrado del JSON de detalles
      const newDetails = details.filter(item => String(item.productId) !== String(productId));
      
      // CONDICIÓN VITAL: Si el nuevo detailsJson queda vacío o el totalAmount <= 0, elimina la fila completa
      if (newDetails.length === 0 || newTotal <= 0) {
        sheet.deleteRow(i + 1);
      } else {
        sheet.getRange(i + 1, 4).setValue(newTotal); // totalAmount
        sheet.getRange(i + 1, 6).setValue(JSON.stringify(newDetails)); // detailsJson
      }
      
      // Si la nota estaba pagada, devolver el dinero al sobre 4 (Capital)
      const status = data[i][4];
      if (status === 'Paid') {
        updateEnvelopeBalance("ENV4", inputTotalCost);
      }
      
      break;
    }
  }
}

function deleteOutput(id) { 
  const sheet = getSheet("Outputs");
  const data = sheet.getDataRange().getValues();
  const searchId = id.toString().trim().toUpperCase();
  
  for(let i = 1; i < data.length; i++) {
    if(data[i][0].toString().trim().toUpperCase() === searchId) {
      const productId = data[i][1];
      const quantity = parseAmount(data[i][3]);
      const totalSale = parseAmount(data[i][5]);
      
      // Revertir stock y estadísticas
      // Para salidas, revertir significa SUMAR al stock
      updateProductStock(productId, -quantity, -totalSale, false);
      
      sheet.deleteRow(i + 1);
      return {success: true};
    }
  }
  return {success: false, error: "No encontrado"};
}

function saveMasterClosing(data) {
  const { closing, products, debtsToPay } = data;
  const outSheet = getSheet("Outputs");
  const closingSheet = getSheet("Closings");
  
  // 1. Actualizar stock de productos
  products.forEach(item => {
    updateProductStock(item.productId, parseAmount(item.quantity), parseAmount(item.totalSale), false);
  });
  
  // 2. Crear registro único en Outputs
  const outputId = "OUT-" + Utilities.getUuid();
  const outputHeaders = ["id", "productId", "productName", "quantity", "salePrice", "totalSale", "date", "shift", "notes", "type", "soldProductsJson"];
  const outputRow = outputHeaders.map(h => {
    if (h === 'id') return outputId;
    if (h === 'productId') return "MASTER";
    if (h === 'productName') return "Cierre Maestro";
    if (h === 'quantity') return 0;
    if (h === 'salePrice') return 0;
    if (h === 'totalSale') return parseAmount(closing.totalSold);
    if (h === 'date') return closing.date;
    if (h === 'shift') return "General";
    if (h === 'notes') return "Cierre Maestro: " + closing.id;
    if (h === 'type') return "exit";
    if (h === 'soldProductsJson') return JSON.stringify(products);
    return "";
  });
  outSheet.appendRow(outputRow);
  
  // 3. Procesar deudas y calcular total pagado con capital
  const paidDebtIds = debtsToPay.map(d => d.id);
  const noteSheet = getSheet("PurchaseNotes");
  const noteData = noteSheet.getDataRange().getValues();
  const noteHeaders = noteData[0];
  const noteIdIdx = 0;
  const noteAmountIdx = noteHeaders.indexOf("totalAmount");
  const noteStatusIdx = noteHeaders.indexOf("status");
  const noteSourceIdx = noteHeaders.indexOf("paymentSource");

  let totalDebtsFromCapital = 0;

  debtsToPay.forEach(debt => {
    const searchId = debt.id.toString().trim().toUpperCase();
    for (let i = 1; i < noteData.length; i++) {
      if (noteData[i][noteIdIdx].toString().trim().toUpperCase() === searchId) {
        const amount = parseAmount(noteData[i][noteAmountIdx]);
        const oldStatus = noteData[i][noteStatusIdx];
        
        if (oldStatus !== 'Paid' && debt.method === 'Capital') {
          totalDebtsFromCapital += amount;
        }
        
        // Actualizar estado de la nota sin disparar updateEnvelopeBalance individualmente
        noteSheet.getRange(i + 1, noteStatusIdx + 1).setValue('Paid');
        if (noteSourceIdx > -1) {
          noteSheet.getRange(i + 1, noteSourceIdx + 1).setValue(debt.method);
        }
        break;
      }
    }
  });
  
  // 4. Guardar el cierre maestro
  const closingHeaders = ["id", "date", "totalSold", "netProfit", "cogs", "debtsPaid", "cashInBox", "notes", "paidDebtIds"];
  upsertToSheet("Closings", closingHeaders, { ...closing, paidDebtIds: JSON.stringify(paidDebtIds) }, "id");
  
  // 5. Distribuir utilidad en sobres
  const profit = parseAmount(closing.netProfit);
  const cogs = parseAmount(closing.cogs);
  
  // Flujo neto para Sobre 4: Costo de mercancía - Deudas pagadas con Capital
  const netCapitalFlow = cogs - totalDebtsFromCapital;
  updateEnvelopeBalance("ENV4", netCapitalFlow);
  if (profit > 0) {
    const part = profit / 3;
    ["ENV1", "ENV2", "ENV3"].forEach(id => updateEnvelopeBalance(id, part));
  }
  
  return { success: true };
}

function deleteClosing(id) {
  const closingSheet = getSheet("Closings");
  const closingData = closingSheet.getDataRange().getValues();
  const closingHeaders = closingData[0];
  const searchId = id.toString().trim().toUpperCase();
  
  let closingRow = -1;
  let closingObj = {};
  
  for (let i = 1; i < closingData.length; i++) {
    if (closingData[i][0].toString().trim().toUpperCase() === searchId) {
      closingRow = i + 1;
      closingHeaders.forEach((h, idx) => {
        closingObj[h] = closingData[i][idx];
      });
      break;
    }
  }
  
  if (closingRow === -1) return { error: "Cierre no encontrado" };
  
  // 1. Buscar el output maestro asociado para obtener los productos
  const outSheet = getSheet("Outputs");
  const outData = outSheet.getDataRange().getValues();
  const noteMatch = "Cierre Maestro: " + id;
  
  let soldProducts = [];
  let outRow = -1;
  
  for (let i = outData.length - 1; i >= 1; i--) {
    if (String(outData[i][8]).trim() === noteMatch) {
      outRow = i + 1;
      // El JSON de productos está en la columna 11 (índice 10)
      const jsonStr = outData[i][10]; 
      try {
        soldProducts = JSON.parse(jsonStr);
      } catch(e) {}
      break;
    }
  }
  
  // 2. Revertir Stock
  soldProducts.forEach(item => {
    updateProductStock(item.productId, parseAmount(item.quantity), parseAmount(item.totalSale), true);
  });
  
  // 3. Revertir Deudas
  let revertNotes = [];
  try {
    revertNotes = JSON.parse(closingObj.paidDebtIds || "[]");
  } catch(e) {}
  
  revertNotes.forEach(noteId => {
    updateNoteStatus(noteId, 'Pending', 'Capital');
  });
  
  // 4. Revertir Sobres
  const profit = parseAmount(closingObj.netProfit);
  const cogs = parseAmount(closingObj.cogs);
  
  updateEnvelopeBalance("ENV4", -cogs);
  if (profit > 0) {
    const part = profit / 3;
    ["ENV1", "ENV2", "ENV3"].forEach(id => updateEnvelopeBalance(id, -part));
  }
  
  // 5. Borrar registros
  if (outRow > -1) outSheet.deleteRow(outRow);
  closingSheet.deleteRow(closingRow);
  
  return { success: true, revertProducts: soldProducts, revertNotes: revertNotes };
}
function updateClosing(id, newData) {
  const delRes = deleteClosing(id);
  if (delRes.error) return delRes;
  return saveMasterClosing(newData);
}

function deleteAudit(id) { return {success: deleteRow("AuditLog", id)}; }
function deletePurchaseNote(id) {
  const noteId = id.toString().trim();
  const noteSheet = getSheet("PurchaseNotes");
  const noteData = noteSheet.getDataRange().getValues();
  const searchId = noteId.toUpperCase();
  
  let noteFound = false;
  let noteRow = -1;
  let noteStatus = "";
  let noteTotal = 0;

  for (let i = 1; i < noteData.length; i++) {
    if (noteData[i][0].toString().trim().toUpperCase() === searchId) {
      noteFound = true;
      noteRow = i + 1;
      noteStatus = noteData[i][4];
      noteTotal = parseAmount(noteData[i][3]);
      break;
    }
  }

  if (!noteFound) return { success: false, error: "Nota no encontrada" };

  const inputSheet = getSheet("Inputs");
  const inputData = inputSheet.getDataRange().getValues();
  const noteMatch = "Compra: " + noteId;
  
  // 1. Borrado en Cascada Descendente: Buscar y revertir inputs hijos
  // Recorrer de abajo hacia arriba para evitar error de índices al borrar filas
  for (let i = inputData.length - 1; i >= 1; i--) {
    if (String(inputData[i][8]).trim() === noteMatch) {
      const productId = inputData[i][1];
      const quantity = parseAmount(inputData[i][3]);
      
      // 2. Revertir Inventario: Restar del stock
      updateProductStock(productId, quantity, 0, false);
      
      // 3. Limpiar Hijos: Eliminar fila de input
      inputSheet.deleteRow(i + 1);
    }
  }
  
  // Si la nota estaba pagada, devolver capital al sobre 4
  if (noteStatus === 'Paid') {
    updateEnvelopeBalance("ENV4", noteTotal);
  }

  // 4. Eliminar Padre: Eliminar la nota padre
  noteSheet.deleteRow(noteRow);
  return { success: true };
}

function saveClosing(c) {
  const headers = ["id", "date", "totalSold", "netProfit", "cogs", "debtsPaid", "cashInBox", "notes"];
  return upsertToSheet("Closings", headers, c, "id");
}

function saveInput(i) {
  const sheet = getSheet("Inputs");
  const data = sheet.getDataRange().getValues();
  const searchId = i.id.toString().trim().toUpperCase();
  const headers = ["id", "productId", "productName", "quantity", "unitCost", "totalCost", "date", "provider", "notes", "type"];
  
  let oldQuantity = 0;
  let oldTotalCost = 0;
  let foundRow = -1;
  let oldNoteRef = "";

  for(let row = 1; row < data.length; row++) {
    if(data[row][0].toString().trim().toUpperCase() === searchId) {
      oldQuantity = parseAmount(data[row][3]);
      oldTotalCost = parseAmount(data[row][5]);
      oldNoteRef = data[row][8] || "";
      foundRow = row + 1;
      break;
    }
  }

  // Recalcular matemáticamente: nuevoTotalCost = nuevaCantidad * nuevoCostoUnitario
  const newQuantity = parseAmount(i.quantity);
  const newUnitCost = parseAmount(i.unitCost);
  const newTotalCost = newQuantity * newUnitCost;
  i.totalCost = newTotalCost; // Asegurar que el objeto tenga el valor calculado
  
  // Calcular Deltas
  const diffQty = newQuantity - oldQuantity;
  const diffCost = newTotalCost - oldTotalCost;
  
  // 1. Actualizar el inventario (Products) enviando SOLO el Delta Cantidad
  updateProductStock(i.productId, diffQty, 0, true);
  // Actualizar precio de costo maestro
  updateProductCostPrice(i.productId, newUnitCost);

  // 2. Actualizar Nota Padre (Preservar relación)
  const noteRef = (i.notes && i.notes.trim() !== "") ? i.notes : oldNoteRef;
  i.notes = noteRef; // Restaurar la columna notes intacta

  if (noteRef.startsWith("Compra: ")) {
    const noteId = noteRef.replace("Compra: ", "").trim();
    updateParentNoteAfterInputEdit(noteId, i.productId, diffCost, newQuantity, newUnitCost, newTotalCost);
  }

  // 3. Sobrescribir fila (PROHIBIDO usar appendRow para ediciones)
  const rowData = headers.map(h => i[h] !== undefined ? i[h] : "");
  if (foundRow > -1) {
    sheet.getRange(foundRow, 1, 1, headers.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
  
  return {success: true};
}

/**
 * Actualiza el total y el JSON de detalles de una nota de compra tras editar un input individual.
 * CRÍTICO: Recalcula el totalAmount sumando los totalCost de todos los ítems.
 */
function updateParentNoteAfterInputEdit(noteId, productId, diffCost, newQuantity, newUnitCost, newTotalCost) {
  const sheet = getSheet("PurchaseNotes");
  const data = sheet.getDataRange().getValues();
  const searchId = noteId.toString().trim().toUpperCase();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString().trim().toUpperCase() === searchId) {
      let details = [];
      try {
        details = JSON.parse(data[i][5] || "[]");
      } catch(e) {}
      
      // Actualizar el producto en el JSON de detalles
      const newDetails = details.map(item => {
        if (String(item.productId) === String(productId)) {
          return { ...item, quantity: newQuantity, unitCost: newUnitCost, totalCost: newTotalCost };
        }
        return item;
      });

      // CRÍTICO: Recalcular el totalAmount de toda la nota sumando los totalCost de todos los ítems
      const newTotal = newDetails.reduce((acc, curr) => acc + (parseAmount(curr.totalCost) || 0), 0);
      
      sheet.getRange(i + 1, 4).setValue(newTotal); // totalAmount
      sheet.getRange(i + 1, 6).setValue(JSON.stringify(newDetails)); // detailsJson
      
      // Si la nota estaba pagada, ajustar el sobre 4 (Capital) por la diferencia real
      const status = data[i][4];
      const oldTotal = parseAmount(data[i][3]);
      const realDiff = newTotal - oldTotal;
      if (status === 'Paid' && realDiff !== 0) {
        updateEnvelopeBalance("ENV4", -realDiff);
      }
      
      break;
    }
  }
}

function saveOutput(o) {
  const sheet = getSheet("Outputs");
  const data = sheet.getDataRange().getValues();
  const searchId = o.id.toString().trim().toUpperCase();
  const headers = ["id", "productId", "productName", "quantity", "salePrice", "totalSale", "date", "shift", "notes", "type"];
  
  let oldQuantity = 0;
  let oldTotalSale = 0;
  let foundRow = -1;

  for(let row = 1; row < data.length; row++) {
    if(data[row][0].toString().trim().toUpperCase() === searchId) {
      oldQuantity = parseAmount(data[row][3]);
      oldTotalSale = parseAmount(data[row][5]);
      foundRow = row + 1;
      break;
    }
  }

  const newQuantity = parseAmount(o.quantity);
  const newTotalSale = parseAmount(o.totalSale);
  
  // Ajustar stock para salidas: (nuevo - viejo) se RESTA del stock
  const diffQty = newQuantity - oldQuantity;
  const diffSale = newTotalSale - oldTotalSale;
  
  updateProductStock(o.productId, diffQty, diffSale, false);

  return upsertToSheet("Outputs", headers, o, "id");
}

function deletePriceHistory(id) { return {success: deleteRow("PriceHistory", id)}; }

function savePriceHistory(h) {
  const headers = ["id", "productId", "productName", "field", "oldValue", "newValue", "date"];
  return upsertToSheet("PriceHistory", headers, h, "id");
}

function deleteItemFromPurchaseNote(data) {
  const { noteId, productId } = data;
  const sheet = getSheet("PurchaseNotes");
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idIdx = 0;
  const totalIdx = headers.indexOf("totalAmount");
  const detailsIdx = headers.indexOf("detailsJson");

  const searchId = noteId.toString().trim().toUpperCase();
  let foundRow = -1;
  let detailsJson = "";
  let totalAmount = 0;

  for (let i = 1; i < values.length; i++) {
    if (values[i][idIdx].toString().trim().toUpperCase() === searchId) {
      foundRow = i + 1;
      detailsJson = values[i][detailsIdx];
      totalAmount = parseAmount(values[i][totalIdx]);
      break;
    }
  }

  if (foundRow === -1) return { error: "Nota no encontrada" };

  const details = JSON.parse(detailsJson || '[]');
  const itemIndex = details.findIndex(d => String(d.productId) === String(productId));
  
  if (itemIndex === -1) return { error: "Producto no encontrado en la nota" };

  const itemToDelete = details[itemIndex];
  const qtyToDelete = parseAmount(itemToDelete.quantity);
  const costToDelete = parseAmount(itemToDelete.totalCost);

  // Paso 3: Revertir stock
  updateProductStock(productId, qtyToDelete, costToDelete, false);

  // Paso 4: Eliminar de Inputs (Borrado Quirúrgico)
  const inputSheet = getSheet("Inputs");
  const inputData = inputSheet.getDataRange().getValues();
  for (let i = inputData.length - 1; i >= 1; i--) {
    const rowNotes = String(inputData[i][8]); // Columna 'notes'
    const rowProductId = String(inputData[i][1]); // Columna 'productId'
    
    // CONDICIÓN DOBLE: El noteId debe estar en las notas Y el productId debe coincidir exactamente
    if (rowNotes.includes(noteId) && rowProductId === String(productId)) {
      inputSheet.deleteRow(i + 1);
    }
  }

  // Paso 5 & 6: Actualizar nota (Extracción y Filtro Estricto)
  const newTotalAmount = totalAmount - costToDelete;
  const newDetails = details.filter(p => String(p.productId) !== String(productId));

  // Paso 7: Condición de Destrucción
  if (newDetails.length === 0 || newTotalAmount <= 0) {
    sheet.deleteRow(foundRow);
    return { success: true, destroyed: true };
  } else {
    sheet.getRange(foundRow, totalIdx + 1).setValue(newTotalAmount);
    sheet.getRange(foundRow, detailsIdx + 1).setValue(JSON.stringify(newDetails));
    return { success: true, destroyed: false, newTotalAmount, newDetailsJson: JSON.stringify(newDetails) };
  }
}

function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = {
    "Products": ["id", "code", "name", "grams", "flavor", "costPrice", "salePrice", "stock", "category", "provider", "totalInvested", "totalEarned", "totalInputs", "totalOutputs"],
    "Envelopes": ["id", "name", "balance", "description", "lastResetDate"],
    "EnvelopeHistory": ["id", "envelopeId", "envelopeName", "amount", "startDate", "endDate", "durationText", "notes"],
    "PurchaseNotes": ["id", "date", "provider", "totalAmount", "status", "detailsJson"],
    "Inputs": ["id", "productId", "productName", "quantity", "unitCost", "totalCost", "date", "provider", "notes", "type"],
    "Outputs": ["id", "productId", "productName", "quantity", "salePrice", "totalSale", "date", "shift", "notes", "type", "soldProductsJson"],
    "Closings": ["id", "date", "totalSold", "netProfit", "cogs", "debtsPaid", "cashInBox", "notes", "paidDebtIds"],
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
