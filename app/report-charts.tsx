"use client";

import { useState } from "react";
import { Bar, ComposedChart, CartesianGrid, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartNoAxesCombined, WalletCards, Package, UsersRound, ChevronDown } from "lucide-react";
import { money } from "../lib/sales";
import { reportData } from "../lib/reports";

const series = [
  { key: "sales", label: "Sales", color: "#235c57" },
  { key: "cost", label: "Cost", color: "#b8cbc4" },
  { key: "profit", label: "Net profit", color: "#9e542f" },
] as const;
const compact = new Intl.NumberFormat("en-PK", { notation: "compact", maximumFractionDigits: 1 });
const monthName = (value: string) => new Intl.DateTimeFormat("en", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(value + "-01T00:00:00Z"));
const pkr = (value: number | null) => value === null ? "—" : "PKR " + money(value);

function Ranking({ rows, empty, tone, onSelect }: { rows: { name: string; value: number }[]; empty: string; tone: string; onSelect: (name: string) => void }) {
  if (!rows.length) return <p className="chart-empty">{empty}</p>;
  return <ol className={"ranking " + tone}>{rows.map((row, index) => <li key={row.name}>
    <span className="rank-number">{String(index + 1).padStart(2, "0")}</span>
    <div className="rank-detail"><div><button onClick={() => onSelect(row.name)}>{row.name}</button><strong>{pkr(row.value)}</strong></div>
    <span className="rank-track" aria-hidden="true"><i style={{ width: (row.value / rows[0].value * 100) + "%" }} /></span></div>
  </li>)}</ol>;
}

export function ReportCharts({ data, onInstrument, onCustomer }: { data: ReturnType<typeof reportData>; onInstrument: (name: string) => void; onCustomer: (name: string) => void }) {
  const [range, setRange] = useState(12);
  const [hidden, setHidden] = useState<string[]>([]);
  const [showFigures, setShowFigures] = useState(false);
  const months = data.months.slice(-range);
  const visible = series.filter(s => !hidden.includes(s.key));
  const received = data.paid ?? 0;
  const pending = data.pending ?? 0;
  const receivedShare = received + pending > 0 ? received / (received + pending) * 100 : 0;
  return <div className="report-grid">
    <section className="report-card monthly">
      <div className="report-heading"><div><h2><ChartNoAxesCombined size={19} /> Sales performance</h2><p>Monthly sales, costs and net profit · PKR</p></div>
        <select className="chart-range" aria-label="Chart period" value={range} onChange={event => setRange(Number(event.target.value))}><option value={6}>Last 6 recorded months</option><option value={12}>Last 12 recorded months</option><option value={100000}>All recorded months</option></select></div>
      <div className="chart-key">{series.map(s => <button key={s.key} type="button" aria-pressed={!hidden.includes(s.key)} onClick={() => setHidden(current => current.includes(s.key) ? current.filter(key => key !== s.key) : current.length < series.length - 1 ? [...current, s.key] : current)}><i style={{ backgroundColor: s.color }} />{s.label}</button>)}</div>
      {months.length ? <>
        <div className="monthly-chart">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 640, height: 280 }}>
            <ComposedChart data={months} margin={{ top: 12, right: 12, bottom: 8, left: 0 }} barGap={4}>
              <CartesianGrid vertical={false} stroke="#e2e9e5" strokeDasharray="3 4" />
              <XAxis dataKey="month" tickFormatter={monthName} tickLine={false} tickMargin={10} axisLine={false} minTickGap={20} tick={{ fontSize: 11, fill: "#53645e" }} />
              <YAxis tickFormatter={value => compact.format(value)} tickLine={false} axisLine={false} width={48} tick={{ fontSize: 11, fill: "#53645e" }} />
              <ReferenceLine y={0} stroke="#9eaca6" />
              <Tooltip labelFormatter={month => monthName(String(month))} formatter={value => pkr(Number(value))} cursor={{ fill: "#f1f5f2" }} contentStyle={{ borderRadius: 8, borderColor: "#dae5df" }} />
              {visible.filter(s => s.key !== "profit").map(s => <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />)}
              {visible.some(s => s.key === "profit") && <Line dataKey="profit" name="Net profit" stroke="#9e542f" strokeWidth={2.5} dot={months.length < 19 ? { r: 3, fill: "#9e542f", strokeWidth: 0 } : false} activeDot={{ r: 5 }} isAnimationActive={false} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-data"><button className="quiet" aria-expanded={showFigures} onClick={() => setShowFigures(!showFigures)}>Monthly figures <ChevronDown size={14} /></button>{showFigures && <table><thead><tr><th>Month</th>{visible.map(s => <th key={s.key}>{s.label}</th>)}</tr></thead>
          <tbody>{months.map(month => <tr key={month.month}><th>{monthName(month.month)}</th>{visible.map(s => <td key={s.key}>{pkr(month[s.key])}</td>)}</tr>)}</tbody></table>}</div>
      </> : <p className="chart-empty">Add a sale date to see monthly activity.</p>}
      {(data.undated > 0 || data.incomplete > 0) && <p className="report-note">
        {data.undated > 0 && `${data.undated} undated ${data.undated === 1 ? "invoice is" : "invoices are"} included in totals only. `}
        {data.incomplete > 0 && `Profit excludes lines with incomplete amounts across ${data.incomplete} ${data.incomplete === 1 ? "invoice" : "invoices"}.`}
      </p>}
    </section>
    <section className="report-card collections"><div className="report-heading"><div><h2><WalletCards size={19} /> Payment collection</h2><p>Across matching invoices</p></div></div>
      {data.paid === null && data.pending === null ? <p className="chart-empty">Payment figures appear once sales or payments are recorded.</p> :
        <div className="collections-body">
          <div className="collection-donut" style={{ "--collected": receivedShare + "%" } as React.CSSProperties}>
            <div><strong>{received + pending > 0 ? Math.round(receivedShare) + "%" : "—"}</strong><span>Collected</span></div>
          </div>
          <div className="collection-amounts"><div><span><i />Received</span><strong>{pkr(data.paid)}</strong></div><div><span><i />Outstanding</span><strong>{pkr(data.pending)}</strong></div></div>
        </div>}
    </section>
    <section className="report-card"><div className="report-heading"><div><h2><Package size={19} /> Top instruments</h2><p>Sales value · Select an instrument to filter</p></div></div>
      <Ranking rows={data.instruments} empty="Instrument sales will appear here." tone="instrument-bars" onSelect={onInstrument} /></section>
    <section className="report-card"><div className="report-heading"><div><h2><UsersRound size={19} /> Outstanding by customer</h2><p>Open balances · Select a customer to filter</p></div></div>
      <Ranking rows={data.customers} empty="No outstanding balances in these results." tone="customer-bars" onSelect={onCustomer} /></section>
  </div>;
}
