
export interface Product {
  id: string;
  code: string;
  name: string;
  grams: string;
  flavor: string;
  costPrice: number;
  salePrice: number;
  stock: number;
  category: string;
  provider: string;
  totalInvested: number;
  totalEarned: number;
  totalInputs: number; // Nuevo: Acumulado de entradas
  totalOutputs: number; // Nuevo: Acumulado de salidas
}

export interface Envelope {
  id: string;
  name: string;
  balance: number;
  description: string;
  lastResetDate: string; 
}

export interface EnvelopeWithdrawal {
  id: string;
  envelopeId: string;
  envelopeName: string;
  amount: number;
  startDate: string;
  endDate: string;
  durationText: string;
  notes: string;
}

export interface PriceHistory {
  id: string;
  productId: string;
  productName: string;
  field: string;
  oldValue: any;
  newValue: any;
  date: string;
}

export interface PurchaseNote {
  id: string;
  date: string;
  provider: string;
  totalAmount: number;
  status: 'Paid' | 'Pending';
  detailsJson: string;
  paymentSource?: 'Sales' | 'Capital';
}

export interface InputTransaction {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  date: string;
  provider: string;
  invoiceId: string;
  status: 'Paid' | 'Pending';
  notes: string;
  type: 'entry';
}

export interface OutputTransaction {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  salePrice: number;
  totalSale: number;
  date: string;
  shift: string;
  notes: string;
  type: 'exit';
}

export interface DailyClosing {
  id: string;
  date: string;
  totalSold: number;
  netProfit: number;
  cogs: number;
  debtsPaid: number;
  cashInBox: number;
  soldProductsJson?: string;
  notes?: string;
}

export interface OCRResult {
  code?: string;
  name: string;
  grams?: string;
  flavor?: string;
  costPrice: number;
  salePrice?: number;
  quantity: number;
}
