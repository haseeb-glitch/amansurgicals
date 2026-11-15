import { lineTotals, normalized, round, totals, type Item, type Row } from "./sales";

type Ranked = { name: string; value: number };
type Source = { row: Row; items: Item[] };

export function reportData(source: Source[]) {
  const months = new Map<string, { month: string; sales: number | null; cost: number | null; profit: number | null }>();
  const instruments = new Map<string, Ranked>();
  const customers = new Map<string, Ranked>();
  let sales = 0, cost = 0, profit = 0, paid = 0, pending = 0, undated = 0, incomplete = 0;
  let knownSales = 0, knownCost = 0, knownProfit = 0, knownPayments = 0, knownBalances = 0;
  const add = (map: Map<string, Ranked>, name: string, value: number) => {
    const key = normalized(name);
    const entry = map.get(key) ?? { name, value: 0 };
    entry.value += value;
    map.set(key, entry);
  };
  for (const { row, items } of source) {
    const invoice = totals(row.data);
    const balance = invoice.pending;
    if (invoice.paid !== null) { paid += invoice.paid; knownPayments++; }
    if (balance !== null) { pending += Math.max(0, balance); knownBalances++; }
    if (balance !== null && balance > 0) add(customers, row.data.customer || "Unnamed customer", balance);
    const month = row.data.date.slice(0, 7);
    if (!month) undated++;
    const period = months.get(month) ?? { month, sales: null, cost: null, profit: null };
    if (items.some(item => lineTotals(item).profit === null)) incomplete++;
    for (const item of items) {
      const line = lineTotals(item);
      if (line.total !== null) {
        sales += line.total; knownSales++; period.sales = round((period.sales ?? 0) + line.total);
        if (item.product && line.total > 0) add(instruments, item.product, line.total);
      }
      if (line.costTotal !== null) { cost += line.costTotal; knownCost++; period.cost = round((period.cost ?? 0) + line.costTotal); }
      if (line.profit !== null) { profit += line.profit; knownProfit++; period.profit = round((period.profit ?? 0) + line.profit); }
    }
    if (month && (period.sales !== null || period.cost !== null || period.profit !== null)) months.set(month, period);
  }
  const ranked = (map: Map<string, Ranked>) => [...map.values()].sort((a, b) => b.value - a.value).slice(0, 6);
  return {
    sales: knownSales ? round(sales) : null, cost: knownCost ? round(cost) : null,
    profit: knownProfit ? round(profit) : null, paid: knownPayments ? round(paid) : null,
    pending: knownBalances ? round(pending) : null, undated, incomplete,
    months: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)),
    instruments: ranked(instruments), customers: ranked(customers),
  };
}
