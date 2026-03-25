
import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import cors from "cors";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE = path.join(process.cwd(), "db.json");

// Initial data structure based on Code.gs setupSheet
const INITIAL_DATA = {
  Products: [],
  Envelopes: [
    { id: "ENV1", name: "Sobre 1 - Operativo", balance: 0, description: "1/3 de Utilidad para gastos", lastResetDate: new Date().toISOString() },
    { id: "ENV2", name: "Sobre 2 - Ahorro", balance: 0, description: "1/3 de Utilidad para fondo", lastResetDate: new Date().toISOString() },
    { id: "ENV3", name: "Sobre 3 - Ganancia", balance: 0, description: "1/3 de Utilidad personal", lastResetDate: new Date().toISOString() },
    { id: "ENV4", name: "Sobre 4 - Capital", balance: 0, description: "Fondo de Resurtido (100% Costo)", lastResetDate: new Date().toISOString() }
  ],
  EnvelopeHistory: [],
  PurchaseNotes: [],
  Inputs: [],
  Outputs: [],
  Closings: [],
  PriceHistory: []
};

function readDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DATA, null, 2));
    return INITIAL_DATA;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  } catch (e) {
    return INITIAL_DATA;
  }
}

function writeDb(data: any) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.post("/api/exec", (req, res) => {
    const { action, data } = req.body;
    const db = readDb();
    let result: any = { success: true };

    try {
      switch (action) {
        case 'getData': {
          result = {
            success: true,
            data: {
              products: db.Products || [],
              envelopes: db.Envelopes || [],
              envelopeHistory: db.EnvelopeHistory || [],
              purchaseNotes: db.PurchaseNotes || [],
              inputs: db.Inputs || [],
              outputs: db.Outputs || [],
              closings: db.Closings || [],
              priceHistory: db.PriceHistory || []
            }
          };
          break;
        }

        case 'getProducts': result = { success: true, data: db.Products }; break;
        case 'getEnvelopes': result = { success: true, data: db.Envelopes }; break;
        case 'getEnvelopeHistory': result = { success: true, data: db.EnvelopeHistory }; break;
        case 'getPurchaseNotes': result = { success: true, data: db.PurchaseNotes }; break;
        case 'getInputs': result = { success: true, data: db.Inputs }; break;
        case 'getOutputs': result = { success: true, data: db.Outputs }; break;
        case 'getClosings': result = { success: true, data: db.Closings }; break;
        case 'getPriceHistory': result = { success: true, data: db.PriceHistory }; break;

        case 'saveProduct': {
          if (!data.id) {
            data.id = "PROD-" + Math.random().toString(36).substr(2, 9);
          }
          const index = db.Products.findIndex((p: any) => p.id === data.id);
          if (index > -1) db.Products[index] = data;
          else db.Products.push(data);
          writeDb(db);
          result = { success: true, data };
          break;
        }

        case 'deleteProduct': {
          db.Products = db.Products.filter((p: any) => p.id !== data);
          writeDb(db);
          break;
        }

        case 'saveEnvelope': {
          const index = db.Envelopes.findIndex((e: any) => e.id === data.id);
          if (index > -1) db.Envelopes[index] = data;
          else db.Envelopes.push(data);
          writeDb(db);
          break;
        }

        case 'withdrawEnvelope': {
          if (!data.id) data.id = "WITH-" + Math.random().toString(36).substr(2, 9);
          db.EnvelopeHistory.push(data);
          const env = db.Envelopes.find((e: any) => e.id === data.envelopeId);
          if (env) env.balance = (Number(env.balance) || 0) - (Number(data.amount) || 0);
          writeDb(db);
          result = { success: true };
          break;
        }

        case 'deleteWithdrawal': {
          const index = db.EnvelopeHistory.findIndex((w: any) => w.id === data);
          if (index > -1) {
            const old = db.EnvelopeHistory[index];
            const env = db.Envelopes.find((e: any) => e.id === old.envelopeId);
            if (env) env.balance = (Number(env.balance) || 0) + (Number(old.amount) || 0);
            db.EnvelopeHistory.splice(index, 1);
            writeDb(db);
          }
          result = { success: true };
          break;
        }

        case 'updateWithdrawal': {
          const index = db.EnvelopeHistory.findIndex((w: any) => w.id === data.id);
          if (index > -1) {
            const old = db.EnvelopeHistory[index];
            // Revert old
            const oldEnv = db.Envelopes.find((e: any) => e.id === old.envelopeId);
            if (oldEnv) oldEnv.balance = (Number(oldEnv.balance) || 0) + (Number(old.amount) || 0);
            
            // Apply new
            db.EnvelopeHistory[index] = data;
            const newEnv = db.Envelopes.find((e: any) => e.id === data.envelopeId);
            if (newEnv) newEnv.balance = (Number(newEnv.balance) || 0) - (Number(data.amount) || 0);
            
            writeDb(db);
          }
          result = { success: true };
          break;
        }

        case 'savePurchaseNote': {
          if (!data.id) data.id = "NOTE-" + Math.random().toString(36).substr(2, 9);
          db.PurchaseNotes.push(data);
          
          const details = JSON.parse(data.detailsJson);
          details.forEach((item: any) => {
            const inputId = "INP-" + Math.random().toString(36).substr(2, 9);
            db.Inputs.push({
              id: inputId,
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              unitCost: item.unitCost,
              totalCost: item.totalCost,
              date: data.date,
              provider: data.provider,
              notes: "Compra: " + data.id,
              type: "entry"
            });
            
            const product = db.Products.find((p: any) => p.id === item.productId);
            if (product) {
              product.stock = (Number(product.stock) || 0) + (Number(item.quantity) || 0);
              product.totalInvested = (Number(product.totalInvested) || 0) + (Number(item.totalCost) || 0);
              product.totalInputs = (Number(product.totalInputs) || 0) + (Number(item.quantity) || 0);
            }
          });
          
          if (data.status === 'Paid') {
            const capitalEnv = db.Envelopes.find((e: any) => e.id === "ENV4");
            if (capitalEnv) capitalEnv.balance = (Number(capitalEnv.balance) || 0) - (Number(data.totalAmount) || 0);
          }
          writeDb(db);
          result = { success: true, data };
          break;
        }

        case 'saveOutput': {
          if (!data.id) data.id = "OUT-" + Math.random().toString(36).substr(2, 9);
          db.Outputs.push(data);
          const product = db.Products.find((p: any) => p.id === data.productId);
          if (product) {
            const cost = Number(product.costPrice) || 0;
            const itemCOGS = (Number(data.quantity) || 0) * cost;
            const itemProfit = (Number(data.totalSale) || 0) - itemCOGS;
            
            product.stock = (Number(product.stock) || 0) - (Number(data.quantity) || 0);
            product.totalEarned = (Number(product.totalEarned) || 0) + itemProfit;
            product.totalOutputs = (Number(product.totalOutputs) || 0) + (Number(data.quantity) || 0);

            const capitalEnv = db.Envelopes.find((e: any) => e.id === "ENV4");
            if (capitalEnv) capitalEnv.balance = (Number(capitalEnv.balance) || 0) + itemCOGS;
            
            if (itemProfit > 0) {
              const part = itemProfit / 3;
              ["ENV1", "ENV2", "ENV3"].forEach(id => {
                const env = db.Envelopes.find((e: any) => e.id === id);
                if (env) env.balance = (Number(env.balance) || 0) + part;
              });
            }
          }
          writeDb(db);
          result = { success: true };
          break;
        }

        case 'saveOutputBatch': {
          const outputs = Array.isArray(data) ? data : [data];
          let totalCOGS = 0;
          let totalProfit = 0;

          outputs.forEach((o: any) => {
            db.Outputs.push(o);
            const product = db.Products.find((p: any) => p.id === o.productId);
            if (product) {
              const cost = Number(product.costPrice) || 0;
              const itemCOGS = (Number(o.quantity) || 0) * cost;
              const itemProfit = (Number(o.totalSale) || 0) - itemCOGS;
              totalCOGS += itemCOGS;
              totalProfit += itemProfit;

              product.stock = (Number(product.stock) || 0) - (Number(o.quantity) || 0);
              product.totalEarned = (Number(product.totalEarned) || 0) + itemProfit;
              product.totalOutputs = (Number(product.totalOutputs) || 0) + (Number(o.quantity) || 0);
            }
          });

          const capitalEnv = db.Envelopes.find((e: any) => e.id === "ENV4");
          if (capitalEnv) capitalEnv.balance = (Number(capitalEnv.balance) || 0) + totalCOGS;
          
          if (totalProfit > 0) {
            const part = totalProfit / 3;
            ["ENV1", "ENV2", "ENV3"].forEach(id => {
              const env = db.Envelopes.find((e: any) => e.id === id);
              if (env) env.balance = (Number(env.balance) || 0) + part;
            });
          }
          writeDb(db);
          break;
        }

        case 'saveClosing': {
          db.Closings.push(data);
          writeDb(db);
          break;
        }

        case 'updateClosing': {
          const index = db.Closings.findIndex((c: any) => c.id === data.id);
          if (index > -1) {
            db.Closings[index] = { ...db.Closings[index], ...data.newData };
            writeDb(db);
          }
          break;
        }

        case 'deleteClosing': {
          db.Closings = db.Closings.filter((c: any) => c.id !== data);
          writeDb(db);
          break;
        }

        case 'saveInput': {
          if (!data.id) data.id = "INP-" + Math.random().toString(36).substr(2, 9);
          const index = db.Inputs.findIndex((i: any) => i.id === data.id);
          if (index > -1) db.Inputs[index] = data;
          else db.Inputs.push(data);
          writeDb(db);
          break;
        }

        case 'deleteInput': {
          db.Inputs = db.Inputs.filter((i: any) => i.id !== data);
          writeDb(db);
          break;
        }

        case 'deleteOutput': {
          db.Outputs = db.Outputs.filter((o: any) => o.id !== data);
          writeDb(db);
          break;
        }

        case 'savePriceHistory': {
          if (!data.id) data.id = "AUDIT-" + Math.random().toString(36).substr(2, 9);
          db.PriceHistory.push(data);
          writeDb(db);
          break;
        }

        case 'deletePriceHistory': {
          db.PriceHistory = db.PriceHistory.filter((h: any) => h.id !== data);
          writeDb(db);
          break;
        }

        case 'deletePurchaseNote': {
          db.PurchaseNotes = db.PurchaseNotes.filter((n: any) => n.id !== data);
          writeDb(db);
          break;
        }

        case 'updatePurchaseNoteDetails': {
          const note = db.PurchaseNotes.find((n: any) => n.id === data.id);
          if (note) {
            note.totalAmount = data.totalAmount;
            note.detailsJson = data.detailsJson;
            writeDb(db);
          }
          break;
        }

        case 'saveMasterClosing': {
          const { closing, products, debtsToPay } = data;
          db.Closings.push(closing);
          
          // Registrar salida maestra
          db.Outputs.push({
            id: "OUT-" + Math.random().toString(36).substr(2, 9),
            productId: "MASTER",
            productName: "Cierre Maestro",
            quantity: 0,
            salePrice: 0,
            totalSale: closing.totalSold,
            date: closing.date,
            shift: "General",
            notes: "Cierre Maestro: " + closing.id,
            type: "exit",
            soldProductsJson: JSON.stringify(products)
          });

          // Actualizar deudas
          debtsToPay.forEach((debt: any) => {
            const note = db.PurchaseNotes.find((n: any) => n.id === debt.id);
            if (note) {
              note.status = 'Paid';
              note.paymentSource = debt.method;
            }
          });

          writeDb(db);
          break;
        }

        case 'deleteItemFromPurchaseNote': {
          const { noteId, productId } = data;
          const note = db.PurchaseNotes.find((n: any) => n.id === noteId);
          if (note) {
            const details = JSON.parse(note.detailsJson || '[]');
            const filtered = details.filter((d: any) => String(d.productId) !== String(productId));
            note.detailsJson = JSON.stringify(filtered);
            note.totalAmount = filtered.reduce((acc: number, curr: any) => acc + (Number(curr.totalCost) || 0), 0);
            writeDb(db);
          }
          break;
        }

        case 'updateNoteStatus': {
          const note = db.PurchaseNotes.find((n: any) => n.id === data.id);
          if (note) {
            if (note.status !== 'Paid' && data.status === 'Paid') {
              const capitalEnv = db.Envelopes.find((e: any) => e.id === "ENV4");
              if (capitalEnv) capitalEnv.balance = (Number(capitalEnv.balance) || 0) - (Number(note.totalAmount) || 0);
            }
            note.status = data.status;
            writeDb(db);
          }
          break;
        }

        case 'processPhysicalCount': {
          const { counts, shift } = data;
          let totalCOGS = 0;
          let totalProfit = 0;
          let totalSold = 0;

          counts.forEach((count: any) => {
            const product = db.Products.find((p: any) => p.id === count.productId);
            if (product) {
              const sysStock = Number(product.stock) || 0;
              const phyStock = Number(count.physicalCount) || 0;
              const diff = sysStock - phyStock;

              if (diff > 0) {
                const cost = Number(product.costPrice) || 0;
                const sale = Number(product.salePrice) || 0;
                const itemCOGS = diff * cost;
                const itemSale = diff * sale;
                const itemProfit = itemSale - itemCOGS;

                totalCOGS += itemCOGS;
                totalProfit += itemProfit;
                totalSold += itemSale;

                db.Outputs.push({
                  id: "PHYS-" + Math.random().toString(36).substr(2, 9),
                  productId: count.productId,
                  productName: product.name,
                  quantity: diff,
                  salePrice: sale,
                  totalSale: itemSale,
                  date: new Date().toISOString(),
                  shift: shift,
                  notes: "Ajuste de Inventario Físico",
                  type: "exit"
                });

                product.stock = phyStock;
                product.totalEarned = (Number(product.totalEarned) || 0) + itemProfit;
                product.totalOutputs = (Number(product.totalOutputs) || 0) + diff;
              }
            }
          });

          const capitalEnv = db.Envelopes.find((e: any) => e.id === "ENV4");
          if (capitalEnv) capitalEnv.balance = (Number(capitalEnv.balance) || 0) + totalCOGS;
          
          if (totalProfit > 0) {
            const part = totalProfit / 3;
            ["ENV1", "ENV2", "ENV3"].forEach(id => {
              const env = db.Envelopes.find((e: any) => e.id === id);
              if (env) env.balance = (Number(env.balance) || 0) + part;
            });
          }
          writeDb(db);
          result = { success: true, totalProfit, totalCOGS, totalSold, netProfit: totalProfit };
          break;
        }

        default:
          result = { error: "Action not recognized: " + action };
      }
    } catch (e: any) {
      result = { error: e.message };
    }

    res.json(result);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
