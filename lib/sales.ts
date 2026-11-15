export const retention = 14 * 24 * 60 * 60 * 1000;

export const columns = [
  ["date", "Date"], ["dc", "DC"], ["customer", "Customer"], ["product", "Product"],
  ["qty", "Qty"], ["rate", "Sell Rate"], ["total", "Total Sale"], ["cost", "Cost Rate"],
  ["costTotal", "Total Cost"], ["fee", "Comm. / Tax"], ["paid", "Paid"],
  ["pending", "Pending"], ["profit", "Net Profit"],
] as const;

export type Item = { product: string; qty: string; rate: string; cost: string; fee: string };
export type Sale = {
  date: string; dc: string; customer: string; city: string; surgeon: string;
  patient: string; room: string; ip: string; paid: string; customerFee: string; items: Item[];
};
export type Row = {
  id: string; number: number; data: Sale; revision: number; createdAt: number;
  updatedAt: number; deletedAt: number | null;
};
export type Customer = { name: string; city: string; fee: string };
export type Product = { name: string; rate: string; cost: string };
export type Workspace = { rows: Row[]; customers: Customer[]; products: Product[]; storage?: "supabase" | "local" };
export type History = { revision: number; savedAt: number; data: Sale };

export const blankItem = (): Item => ({ product: "", qty: "", rate: "", cost: "", fee: "" });
export const blankSale = (): Sale => ({
  date: "", dc: "", customer: "", city: "", surgeon: "", patient: "", room: "",
  ip: "", paid: "", customerFee: "", items: [blankItem()],
});

export function money(value: number | null) {
  return value === null || !Number.isFinite(value) ? "—" : value.toLocaleString("en-PK", { maximumFractionDigits: 2 });
}

export function normalized(value: string) { return value.trim().toLowerCase(); }
export function invoiceNumber(number: number) { return "INV-" + String(number).padStart(5, "0"); }
export function round(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function amount(text: string) {
  const value = text.trim().replaceAll(",", "");
  return value && Number.isFinite(Number(value)) ? Number(value) : null;
}
function multiply(a: string, b: string) {
  const left = amount(a);
  const right = amount(b);
  return left === null || right === null ? null : round(left * right);
}

export function lineTotals(item: Item) {
  const total = multiply(item.qty, item.rate);
  const costTotal = multiply(item.qty, item.cost);
  const feeText = item.fee.trim();
  const feeValue = amount(feeText.replace(/%$/, ""));
  const fee = feeText.endsWith("%")
    ? total === null || feeValue === null ? null : round(total * feeValue / 100)
    : feeValue;
  return { total, costTotal, fee, profit: total === null || costTotal === null || (feeText && fee === null) ? null : round(total - costTotal - (fee ?? 0)) };
}

export function totals(sale: Sale) {
  const lines = sale.items.filter(item => Object.values(item).some(Boolean)).map(lineTotals);
  const sum = (key: "total" | "costTotal" | "fee" | "profit", complete = true) => {
    const values = lines.map(line => line[key]);
    if (!values.some(value => value !== null) || (complete && values.includes(null))) return null;
    return round(values.reduce<number>((acc, value) => acc + (value ?? 0), 0));
  };
  const total = sum("total");
  const paid = amount(sale.paid);
  return {
    total, paid, costTotal: sum("costTotal"), fee: sum("fee", false), profit: sum("profit"),
    pending: total === null ? null : Math.max(0, round(total - (paid ?? 0))),
  };
}

export function status(sale: Sale) {
  const { pending, paid } = totals(sale);
  if (pending === null) return "Incomplete";
  if (pending <= 0) return "Paid";
  return paid ? "Partial" : "Pending";
}

export function cleanText(value: unknown, length = 180) {
  return typeof value === "string" ? value.trim().slice(0, length) : "";
}

export function cleanNumber(value: unknown, percent = false) {
  const str = cleanText(value, 25).replaceAll(",", "");
  if (!str) return "";
  if (!(percent ? /^\d{1,9}(\.\d{1,2})?%?$/ : /^\d{1,9}(\.\d{1,2})?$/).test(str)) {
    throw new Error("Enter a valid non-negative number with up to two decimal places.");
  }
  if (str.endsWith("%") && Number(str.slice(0, -1)) > 100) throw new Error("A percentage must be between 0 and 100.");
  return str;
}

export function cleanSale(input: unknown): Sale {
  if (!input || typeof input !== "object") throw new Error("Sale details are missing.");
  const data = input as Partial<Sale>;
  const date = cleanText(data.date, 10);
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date)) throw new Error("Enter a valid date.");
  const items = Array.isArray(data.items) ? data.items : [];
  if (items.length > 100) throw new Error("Use up to 100 items per invoice.");
  return {
    date, dc: cleanText(data.dc), customer: cleanText(data.customer), city: cleanText(data.city),
    surgeon: cleanText(data.surgeon), patient: cleanText(data.patient), room: cleanText(data.room),
    ip: cleanText(data.ip), paid: cleanNumber(data.paid), customerFee: cleanNumber(data.customerFee, true),
    items: items.length ? items.map(item => ({
      product: cleanText(item?.product), qty: cleanNumber(item?.qty), rate: cleanNumber(item?.rate),
      cost: cleanNumber(item?.cost), fee: cleanNumber(item?.fee, true),
    })) : [blankItem()],
  };
}
