"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, CalendarDays, ChevronDown, ClipboardList,
  FileText, History as HistoryIcon, LayoutGrid, Package, Pencil, Plus, Printer, RefreshCw,
  Search, SlidersHorizontal, Trash2, Users, Wallet, X, Activity, CircleHelp, PanelLeft,
  ArrowUpRight, Check, ChevronRight, Ellipsis, Receipt, Stethoscope, LogOut,
} from "lucide-react";
import {
  blankItem, blankSale, columns, invoiceNumber, lineTotals, money, normalized, retention, status, totals, todayDate,
  type Customer, type History, type Item, type Product, type Row, type Sale, type Workspace,
} from "../lib/sales";
import { reportData } from "../lib/reports";
import { ReportCharts } from "./report-charts";

type Tab = "Sales sheet" | "Invoices" | "Customers" | "Instruments" | "Payments" | "Reports" | "Trash";
type Edit = { id: string; revision?: number; data: Sale };
type Filters = { customer: string; product: string; start: string; end: string; payment: string };
const emptyFilters = { customer: "", product: "", start: "", end: "", payment: "" };
const tabs = [
  ["Sales sheet", LayoutGrid], ["Invoices", FileText], ["Customers", Users], ["Instruments", Package],
  ["Payments", Wallet], ["Reports", Activity], ["Trash", Trash2],
] as const;
const dateLabel = (value: string) => value ? value.split("-").reverse().join("/") : "—";
const timeLabel = (value: number) => new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" }).format(value);
const includes = (value: string, query: string) => normalized(value).includes(normalized(query));
const activeItem = (item: Item, defaultFee = "") => [item.product, item.qty, item.rate, item.cost].some(Boolean) || (Boolean(item.fee) && item.fee !== defaultFee);

async function api<T>(input?: Record<string, unknown>, history?: string): Promise<T> {
  const response = await fetch("/api/workspace" + (history ? "?history=" + encodeURIComponent(history) : ""), input ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  } : { cache: "no-store" });
  const value = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(value.error ?? "The request failed.");
  return value as T;
}

function Modal({ title, children, close, wide = false }: { title: string; children: ReactNode; close: () => void; wide?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} className={wide ? "dialog wide" : "dialog"} onCancel={event => { event.preventDefault(); close(); }}>
    <div className="dialog-head"><h2>{title}</h2><button className="icon-button" onClick={close} aria-label="Close dialog"><X size={19} /></button></div>
    {children}
  </dialog>;
}

function SuggestInput({ label, value, options, onChange, onPick, placeholder, type = "text" }: {
  label: string; value: string; options?: string[]; onChange: (value: string) => void;
  onPick?: (value: string) => void; placeholder?: string; type?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const matches = (options ?? []).filter(option => includes(option, value)).sort((a, b) =>
    Number(normalized(b) === normalized(value)) - Number(normalized(a) === normalized(value))).slice(0, 6);
  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || !matches.length || !onPick) return;
    if (event.key === "Escape") { setOpen(false); event.stopPropagation(); }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setSelected(index => (index + (event.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length);
    }
    if (event.key === "Tab" || event.key === "Enter") {
      if (event.key === "Enter") event.preventDefault();
      onPick(matches[selected] ?? matches[0]);
      setOpen(false);
    }
  }
  return <div className="cell-input">
    <input aria-label={label} type={type} value={value} placeholder={placeholder} autoComplete="off"
      inputMode={["Qty", "Sell Rate", "Cost Rate", "Paid"].includes(label) ? "decimal" : undefined}
      onFocus={() => { setOpen(Boolean(value)); setSelected(0); }}
      onBlur={() => {
        setOpen(false);
        if (onPick && value.trim()) {
          const match = (options ?? []).find(option => normalized(option) === normalized(value.trim()));
          if (match) onPick(match);
        }
      }}
      onKeyDown={handleKey}
      onChange={event => { onChange(event.target.value); setOpen(Boolean(event.target.value)); setSelected(0); }} />
    {open && onPick && matches.length > 0 && <div className="suggestions">
      {matches.map((option, index) => <button type="button" tabIndex={-1} className={selected === index ? "highlight" : ""}
        key={option} onMouseDown={event => event.preventDefault()} onClick={() => { onPick(option); setOpen(false); }}>{option}</button>)}
    </div>}
  </div>;
}

function Invoice({ row }: { row: Row }) {
  const sale = row.data;
  const total = totals(sale).total;
  return <article className="invoice">
    <header><div className="invoice-lockup"><img src="/aman-surgical-mark.png" width={61} height={58} alt="" /><div><div className="invoice-brand">Aman Surgical</div><p>Orthopaedic implants &amp; instruments</p></div></div><div className="invoice-reference"><strong>Invoice</strong><span>{invoiceNumber(row.number)}</span></div></header>
    <div className="invoice-meta"><span><small>Invoice date</small>{dateLabel(sale.date)}</span><span><small>NTN</small>3559451-9</span>{sale.dc && <span><small>DC reference</small>{sale.dc}</span>}</div>
    <div className="invoice-parties"><div><b>Customer</b><p>{sale.customer || "—"}{sale.city && <><br />{sale.city}</>}</p></div>
      <div><b>Surgeon Name</b><p>{sale.surgeon || "—"}</p></div></div>
    {(sale.patient || sale.room || sale.ip) && <div className="invoice-patient">{[sale.patient && "Patient: " + sale.patient, sale.room && "Room: " + sale.room, sale.ip && "IP #: " + sale.ip].filter(Boolean).join("   /   ")}</div>}
    <table><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
      <tbody>{sale.items.map((item, index) => <tr key={index}><td>{item.product || "—"}</td><td>{item.qty || "—"}</td><td>{money(item.rate === "" ? null : Number(item.rate))}</td><td>{money(lineTotals(item).total)}</td></tr>)}</tbody>
    </table>
    <div className="invoice-total">Total <strong>{total === null ? "—" : "PKR " + total.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
    <div className="signature">Authorized signature · Aman Surgical</div>
    <footer><p>Please make cheques payable to Aman Surgical.</p><p>Office # Plot G-289, Near Hamdard Hospital, Karachi</p><p>0333-3171718 · 021-32784909 · amansurgical1@gmail.com</p><p>www.amansurgicals.com</p></footer>
  </article>;
}

export function SalesWorkspace({ displayName }: { displayName: string }) {
  const [workspace, setWorkspace] = useState<Workspace>({ rows: [], customers: [], products: [] });
  const [tab, setTab] = useState<Tab>("Sales sheet");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [details, setDetails] = useState(false);
  const [invoice, setInvoice] = useState<Row | null>(null);
  const [trash, setTrash] = useState<Row | null>(null);
  const [history, setHistory] = useState<{ row: Row; list: History[] } | null>(null);
  const [profile, setProfile] = useState<(Customer & Partial<Product>) | (Product & Partial<Customer>) | null>(null);
  const [help, setHelp] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [rowLimit, setRowLimit] = useState(25);
  const [rowMenu, setRowMenu] = useState<Row | null>(null);
  const editor = useRef<HTMLElement>(null);
  const editing = Boolean(edit);
  useEffect(() => {
    if (editing && tab === "Sales sheet" && !details) {
      const section = editor.current;
      section?.scrollIntoView({ block: "nearest" });
    }
  }, [editing, tab, details]);

  const refresh = useCallback(async () => {
    try {
      setWorkspace(await api<Workspace>());
      setConnected(true);
    } catch (error) {
      setConnected(false);
      setMessage({ text: (error as Error).message, error: true });
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const active = workspace.rows.filter(row => !row.deletedAt);
  const recent = [...active].sort((a, b) => b.updatedAt - a.updatedAt || b.number - a.number);
  const customerNames = new Map<string, string>();
  const productNames = new Map<string, string>();
  for (const row of recent) {
    if (row.data.customer && !customerNames.has(normalized(row.data.customer))) customerNames.set(normalized(row.data.customer), row.data.customer);
    for (const item of row.data.items) if (item.product && !productNames.has(normalized(item.product))) productNames.set(normalized(item.product), item.product);
  }
  workspace.customers.forEach(customer => customerNames.set(normalized(customer.name), customer.name));
  workspace.products.forEach(product => productNames.set(normalized(product.name), product.name));
  const customers = [...customerNames.values()].sort();
  const products = [...productNames.values()].sort();
  const validItems = (row: Row) => row.data.items.map((item, index) => ({ item, index })).filter(({ item }) => {
    if (!includes(item.product, filters.product)) return false;
    if (!query) return true;
    return includes(item.product, query) || [row.data.customer, row.data.dc, row.data.surgeon, row.data.patient, invoiceNumber(row.number)].some(value => includes(value, query));
  });
  const filtered = active.filter(row => {
    const sale = row.data;
    const matchesCustomer = filters.customer === "Unnamed customer" ? !sale.customer : includes(sale.customer, filters.customer);
    return matchesCustomer && (!filters.start || sale.date >= filters.start)
      && (!filters.end || (sale.date && sale.date <= filters.end))
      && (!filters.payment || status(sale) === filters.payment) && validItems(row).length > 0;
  });
  const report = (tab === "Sales sheet" || tab === "Reports") ? reportData(
    tab === "Reports" ? filtered.map(row => ({ row, items: validItems(row).map(({ item }) => item) }))
      : active.map(row => ({ row, items: row.data.items })),
  ) : null;
  const filterCount = Object.values(filters).filter(Boolean).length;
  const selectTab = (value: Tab) => { setTab(value); setQuery(""); setFilters(emptyFilters); setFilterOpen(false); setMobile(false); setRowLimit(25); };
  const setFilter = (key: keyof Filters, value: string) => { setFilters(current => ({ ...current, [key]: value })); setRowLimit(25); };
  const update = (fn: (data: Sale) => Sale) => setEdit(current => current ? { ...current, data: fn(current.data) } : null);
  const field = (key: keyof Omit<Sale, "items">, value: string) => update(data => ({ ...data, [key]: value }));
  const itemField = (index: number, key: keyof Item, value: string) =>
    update(data => {
      if (key === "fee" && index === 0) {
        const prevFee = data.items[0]?.fee ?? data.customerFee;
        return {
          ...data,
          customerFee: value,
          items: data.items.map((item, i) => {
            if (i === 0) return { ...item, fee: value };
            if (!item.fee || item.fee === prevFee || item.fee === data.customerFee) {
              return { ...item, fee: value };
            }
            return item;
          }),
        };
      }
      return {
        ...data,
        items: data.items.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
      };
    });

  function pickCustomer(name: string) {
    const key = normalized(name);
    const manual = workspace.customers.find(customer => normalized(customer.name) === key);
    const latest = recent.find(row => normalized(row.data.customer) === key)?.data;
    const fee = manual?.fee ?? (latest?.customerFee || latest?.items.find(item => item.fee)?.fee || "");
    update(data => {
      const isNewSale = !edit?.revision;
      const previousItems = (latest?.items || [])
        .filter(item => activeItem(item, latest?.customerFee || ""))
        .map(item => ({
          product: item.product || "",
          qty: item.qty || "1",
          rate: item.rate || "",
          cost: item.cost || "",
          fee: item.fee || fee || "",
        }));

      const items = isNewSale
        ? (previousItems.length > 0 ? previousItems : [{ ...blankItem(), fee }])
        : data.items.map(item => ({ ...item, fee: item.fee === data.customerFee ? fee : item.fee || fee }));

      return {
        ...data,
        customer: name,
        city: manual?.city || latest?.city || data.city || "",
        surgeon: data.surgeon || latest?.surgeon || "",
        customerFee: fee,
        items,
      };
    });
  }

  function pickProduct(index: number, name: string) {
    update(data => {
      const key = normalized(name);
      const customerRows = recent.filter(row => normalized(row.data.customer) === normalized(data.customer));
      const fromRows = (rows: Row[]) => rows.flatMap(row => row.data.items).find(item => normalized(item.product) === key);
      const last = fromRows(customerRows);
      const manual = workspace.products.find(product => normalized(product.name) === key);
      const global = fromRows(recent);
      return { ...data, items: data.items.map((item, i) => i === index ? {
        ...item, product: name, rate: item.rate || last?.rate || manual?.rate || global?.rate || "",
        cost: item.cost || last?.cost || manual?.cost || global?.cost || "",
        fee: item.fee || data.customerFee || last?.fee || "",
      } : item) };
    });
  }

  async function mutate(input: Record<string, unknown>, success: string, after?: () => void) {
    setBusy(true); setMessage(null);
    try { await api(input); after?.(); setMessage({ text: success }); await refresh(); }
    catch (error) { setMessage({ text: (error as Error).message, error: true }); }
    finally { setBusy(false); }
  }

  function start(row?: Row) {
    if (edit) { setMessage({ text: "Save or cancel the open entry first." }); return; }
    setEdit(row ? { id: row.id, revision: row.revision, data: structuredClone(row.data) } : { id: crypto.randomUUID(), data: { ...blankSale(), date: todayDate() } });
    setMessage(null);
    if (tab !== "Sales sheet") selectTab("Sales sheet");
  }

  async function save() {
    if (!edit) return;
    const data = { ...edit.data, items: edit.data.items.filter((item, index) => activeItem(item, index === 0 ? "" : edit.data.customerFee)) };
    await mutate({ action: edit.revision ? "update" : "create", id: edit.id, revision: edit.revision, data },
      edit.revision ? "Changes saved. The previous version is in History." : "Sale saved. Your invoice is ready.",
      () => { setEdit(null); setDetails(false); });
  }

  async function showHistory(row: Row) {
    try { setHistory({ row, list: await api<History[]>(undefined, row.id) }); }
    catch (error) { setMessage({ text: (error as Error).message, error: true }); }
  }

  const titleText: Record<Tab, string> = {
    "Sales sheet": "Sales register and invoicing",
    Invoices: "Saved invoices",
    Customers: "Customer history and billing defaults",
    Instruments: "Instrument history and rates",
    Payments: "Amounts received and balances due",
    Reports: "Sales performance and payment collection",
    Trash: "Restore a deleted sale within 14 days.",
  };

  async function logout() {
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
    } catch {
      // ignore network errors
    }
    window.location.href = "/login";
  }

  return <div className="app">
    {mobile && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobile(false)} />}
    <aside className={"sidebar" + (mobile ? " opened" : "")}>
      <div className="brand"><div className="brand-mark"><img src="/aman-surgical-mark.png" width={38} height={36} alt="" /></div><div><strong>Aman Surgical</strong><span>Orthopaedic supplies</span></div></div>
      <nav aria-label="Workspace">{tabs.map(([name, Icon]) => <button key={name} aria-current={tab === name ? "page" : undefined} className={tab === name ? "nav active" : "nav"} onClick={() => selectTab(name)}>
        <Icon size={18} strokeWidth={1.65} /><span>{name}</span>{tab === name && <ChevronRight className="nav-chevron" size={14} />}
      </button>)}</nav>
      <div className="sidebar-bottom">
        <button className="nav" onClick={() => setHelp(true)}><CircleHelp size={19} /><span>Quick guide</span></button>
        <button className="nav logout-nav" onClick={logout}><LogOut size={19} /><span>Log out</span></button>
        <div className="profile">
          <div className="avatar">{displayName.slice(0, 1).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}><strong>{displayName}</strong><span>Private workspace</span></div>
          <button className="logout-icon-btn" title="Log out" aria-label="Log out" onClick={logout}><LogOut size={16} /></button>
        </div>
      </div>
    </aside>
    <div className="main">
      <div className="topbar">
        <div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Toggle navigation" aria-expanded={mobile} onClick={() => setMobile(!mobile)}><PanelLeft size={19} /></button><span>Workspace</span><ChevronRight size={13} /><strong>{tab}</strong></div>
        <div className="topbar-actions">
          <span className="top-currency"><i />{loading ? "Connecting…" : connected ? "Private workspace" : "Connection unavailable"}</span>
          <button className="secondary logout-topbar-btn" title="Log out" onClick={logout}><LogOut size={14} /><span>Log out</span></button>
        </div>
      </div>
      <main className="content">
        <div className="page-heading"><div><h1>{tab}</h1><p>{titleText[tab]}</p></div>
          <div className="heading-actions">{tab === "Sales sheet" && <button className="secondary" onClick={() => selectTab("Reports")}><Activity size={16} /> Reports <ArrowUpRight size={13} /></button>}
          {tab !== "Trash" && <button className="primary" disabled={!connected || (tab === "Sales sheet" && editing)} onClick={() => {
            if (tab === "Customers") setProfile({ name: "", city: "", fee: "" });
            else if (tab === "Instruments") setProfile({ name: "", rate: "", cost: "" });
            else { start(); if (tab === "Invoices" && !edit) setDetails(true); }
          }}><Plus size={18} />{tab === "Customers" ? "New customer" : tab === "Instruments" ? "New instrument" : tab === "Invoices" ? "New invoice" : "New sale"}</button>}</div>
        </div>
        {message && <div className={"notice" + (message.error ? " error" : "")} role={message.error ? "alert" : "status"}>{message.text}<div>{!connected && <button onClick={() => void refresh()}>Retry</button>}<button onClick={() => setMessage(null)} aria-label="Dismiss message"><X size={17} /></button></div></div>}
        {report && tab === "Sales sheet" && <div className="stats">
          {[
            ["Total sales", report.sales], ["Total cost", report.cost], ["Net profit", report.profit], ["Outstanding", report.pending],
          ].map(([label, value]) => <div className="stat" key={String(label)}><div className="stat-top">{label}</div>
            <div className="stat-value">{typeof value === "number" && <small>PKR </small>}{money(typeof value === "number" ? value : null)}</div></div>)}
        </div>}
        {tab === "Sales sheet" && edit && <section className="sale-editor" ref={editor} aria-label={edit.revision ? "Edit sale" : "New sale entry"}>
          <div className="editor-head"><div className="editor-title"><div className="editor-icon"><Receipt size={20} /></div><div><h2>{edit.revision ? "Edit sale" : "New sale"}</h2><p>All fields are optional.</p></div></div>
            <button className="secondary" onClick={() => setDetails(true)}><Stethoscope size={16} /> Invoice details</button></div>
          <div className="editor-body">
            <div className="editor-fields">
              <label className="wide-field"><span>Customer</span><SuggestInput label="Customer" value={edit.data.customer} options={customers} onChange={value => {
                field("customer", value);
                const match = customers.find(c => normalized(c) === normalized(value.trim()));
                if (match) pickCustomer(match);
              }} onPick={pickCustomer} placeholder="Search or enter a name" /></label>
              <label><span>Sale date <small style={{ color: "var(--muted)", fontWeight: 400 }}>({dateLabel(edit.data.date || todayDate())})</small></span><SuggestInput label="Sale date" type="date" value={edit.data.date || todayDate()} onChange={value => field("date", value)} /></label>
              <label><span>DC reference</span><SuggestInput label="DC reference" value={edit.data.dc} onChange={value => field("dc", value)} placeholder="Enter reference" /></label>
            </div>
            <div className="editor-subhead"><h3>Instruments</h3><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span>Rates in PKR</span>{edit.data.items.length > 1 && <button type="button" className="quiet" style={{ fontSize: 11, padding: "2px 7px", minHeight: 22 }} onClick={() => update(data => ({ ...data, items: [{ ...blankItem(), fee: data.customerFee }] }))}>Clear all</button>}</div></div>
            <div className="editor-lines">
              <div className="editor-line editor-labels" aria-hidden="true"><span>Instrument</span><span>Qty</span><span>Sell rate</span><span>Cost rate</span><span>Comm. / tax</span><span>Line total</span><span /></div>
              {edit.data.items.map((item, index) => <div className="editor-line" key={index}>
                {([["product", "Instrument", "Search or enter an instrument"], ["qty", "Qty", "0"], ["rate", "Sell Rate", "0.00"], ["cost", "Cost Rate", "0.00"], ["fee", "Comm. / Tax", "PKR or %"]] as const).map(([key, label, placeholder]) => <label key={key}><span>{label}</span><SuggestInput label={label} value={item[key]} placeholder={placeholder} onChange={value => itemField(index, key, value)} options={key === "product" ? products : undefined} onPick={key === "product" ? value => pickProduct(index, value) : undefined} /></label>)}
                <div className="line-value"><span>Line total</span><strong>{money(lineTotals(item).total)}</strong></div>
                {edit.data.items.length > 1 && <button className="icon-button danger-icon" aria-label={"Remove instrument " + (index + 1)} onClick={() => update(data => ({ ...data, items: data.items.filter((_, i) => i !== index) }))}><X size={16} /></button>}
              </div>)}
            </div>
            <button className="add-item" onClick={() => update(data => ({ ...data, items: [...data.items, { ...blankItem(), fee: data.customerFee || data.items[0]?.fee || "" }] }))}><Plus size={15} /> Add instrument</button>
            <div className="editor-finance">
              <label><span>Amount paid</span><SuggestInput label="Paid" value={edit.data.paid} onChange={value => field("paid", value)} placeholder="0.00" /></label>
              <dl>{([["Total sale", "total"], ["Total cost", "costTotal"], ["Outstanding", "pending"], ["Net profit", "profit"]] as const).map(([label, key]) => <div key={key}><dt>{label}</dt><dd>{money(totals(edit.data)[key])}</dd></div>)}</dl>
            </div>
          </div>
          <div className="editor-footer"><span><kbd>Tab</kbd> Next field</span><div>
            <button className="secondary" disabled={busy} onClick={() => { setEdit(null); setDetails(false); setMessage(null); }}>Cancel</button>
            <button className="primary" disabled={busy} onClick={() => void save()}><Check size={16} />{busy ? "Saving…" : edit.revision ? "Save changes" : "Save sale"}</button></div>
          </div>
        </section>}
        <section className={"panel" + (tab === "Reports" ? " report-filters" : "")}>
          <div className="panel-heading"><div><h2>{tab === "Sales sheet" ? "Sales register" : tab === "Reports" ? "Report filters" : tab === "Trash" ? "Deleted sales" : tab}</h2>
            {tab === "Sales sheet" && <p>One row per instrument. Amounts in PKR.</p>}</div>
            <button className="icon-button refresh" onClick={() => void refresh()} aria-label="Refresh records"><RefreshCw size={17} /></button>
          </div>
          <div className="toolbar">
            <label className="search"><Search size={17} /><input value={query} onChange={event => { setQuery(event.target.value); setRowLimit(25); }}
              placeholder={tab === "Customers" ? "Search customers…" : tab === "Instruments" ? "Search instruments…" : "Search customer, instrument or invoice…"} /><span className="sr-only">Search records</span>{query && <button className="icon-button" onClick={() => setQuery("")} aria-label="Clear search"><X size={14} /></button>}</label>
            {(["Sales sheet", "Invoices", "Payments", "Reports"] as Tab[]).includes(tab) && <button className={"secondary" + (filterOpen ? " selected" : "")} onClick={() => setFilterOpen(!filterOpen)} aria-expanded={filterOpen}><SlidersHorizontal size={16} /> Filters {filterCount > 0 && <span className="count">{filterCount}</span>}<ChevronDown size={13} /></button>}
            {(query || filterCount > 0) && <button className="quiet" onClick={() => { setQuery(""); setFilters(emptyFilters); }}>Clear</button>}
          </div>
          {filterOpen && <div className="filters">
            <label>Customer<input value={filters.customer} onChange={event => setFilter("customer", event.target.value)} placeholder="Any customer" /></label>
            <label>Instrument<input value={filters.product} onChange={event => setFilter("product", event.target.value)} placeholder="Any instrument" /></label>
            <label>From<input type="date" value={filters.start} onChange={event => setFilter("start", event.target.value)} /></label>
            <label>To<input type="date" value={filters.end} onChange={event => setFilter("end", event.target.value)} /></label>
            <label>Payment status<select value={filters.payment} onChange={event => setFilter("payment", event.target.value)}><option value="">Any status</option>{["Paid", "Partial", "Pending", "Incomplete"].map(value => <option key={value}>{value}</option>)}</select></label>
          </div>}
          {tab === "Sales sheet" && <>
            <div className="table-scroll" tabIndex={0} aria-label="Sales register columns">
              <table className="sheet"><thead><tr>{columns.map(([key, label]) => <th key={key} className={"col-" + key} scope="col">{label}</th>)}<th scope="col">Actions</th></tr></thead>
                <tbody>
                  {filtered.slice(0, rowLimit).flatMap(row => validItems(row).map(({ item, index }, matchIndex) => {
                    const sale = row.data; const calc = lineTotals(item); const all = totals(sale);
                    const first = matchIndex === 0;
                    return <tr key={row.id + index}>
                      <td>{first ? dateLabel(sale.date) : "↳"}</td><td>{first ? sale.dc || "—" : "—"}</td><td className="customer-cell">{first ? sale.customer || "—" : "↳"}</td>
                      <td>{item.product || "—"}</td><td>{item.qty || "—"}</td><td>{item.rate || "—"}</td><td>{money(calc.total)}</td><td>{item.cost || "—"}</td>
                      <td>{money(calc.costTotal)}</td><td title={item.fee || undefined}>{money(calc.fee)}</td><td>{first ? money(all.paid) : "—"}</td><td>{first ? money(all.pending) : "—"}</td><td className="profit">{money(calc.profit)}</td>
                      <td>{first && <div className="row-actions">
                        <button className="icon-button" title="View invoice" aria-label="View invoice" onClick={() => setInvoice(row)}><FileText size={16} /></button>
                        <button className="icon-button" title="Update sale" aria-label="Update sale" onClick={() => start(row)}><Pencil size={15} /></button>
                        <button className="icon-button" title="More sale actions" aria-label="More sale actions" onClick={() => setRowMenu(row)}><Ellipsis size={17} /></button>
                      </div>}</td>
                    </tr>;
                  }))}
                </tbody>
              </table>
            </div>
            {!filtered.length && !edit && <div className="empty"><div className="empty-icon"><ClipboardList size={27} strokeWidth={1.55} /></div>
              <h3>{loading ? "Loading sales…" : query || filterCount ? "No matching sales" : "No sales yet"}</h3>
              {!loading && <p>{query || filterCount ? "Try another search or clear the filters." : "Add your first sale to start the register and create an invoice."}</p>}
              {!loading && !query && !filterCount && connected && <button className="secondary" onClick={() => start()}><Plus size={16} /> Add first sale</button>}
            </div>}
            <div className="panel-footer"><span>{filtered.length} {filtered.length === 1 ? "sale" : "sales"}{filterCount || query ? " matching filters" : " in register"}</span>
              {filtered.length > rowLimit ? <button className="secondary compact" onClick={() => setRowLimit(value => value + 25)}>Show more</button> : <span><CalendarDays size={14} /> Pakistan Standard Time</span>}</div>
          </>}
          {(tab === "Customers" || tab === "Instruments") && <div className="directory">
            {(tab === "Customers" ? customers : products).filter(name => includes(name, query)).map(name => {
              const key = normalized(name);
              const customer = tab === "Customers";
              const count = active.filter(row => customer ? normalized(row.data.customer) === key : row.data.items.some(item => normalized(item.product) === key)).length;
              return <div className="list-row" key={key}><div className="list-icon">{customer ? <Users size={19} /> : <Package size={19} />}</div>
                <div className="list-title"><strong>{name}</strong><span>{count} {count === 1 ? "sale" : "sales"}</span></div>
                <button className="secondary compact" onClick={() => setProfile(customer
                  ? workspace.customers.find(item => normalized(item.name) === key) ?? { name, city: recent.find(row => normalized(row.data.customer) === key)?.data.city ?? "", fee: recent.find(row => normalized(row.data.customer) === key)?.data.customerFee ?? "" }
                  : workspace.products.find(item => normalized(item.name) === key) ?? { name, rate: "", cost: "" })}>Edit defaults</button>
                <button className="icon-button" title="View sales" aria-label={"View sales for " + name} onClick={() => { selectTab("Sales sheet"); setFilter(customer ? "customer" : "product", name); setFilterOpen(true); }}><ArrowRight size={17} /></button></div>;
            })}
            {!(tab === "Customers" ? customers : products).some(name => includes(name, query)) && <div className="empty"><h3>{loading ? "Loading…" : "No matching entries"}</h3></div>}
          </div>}
          {(["Invoices", "Payments", "Trash"] as Tab[]).includes(tab) && <div className="directory">
            {(tab === "Trash" ? workspace.rows.filter(row => row.deletedAt && Date.now() - row.deletedAt < retention && [row.data.customer, invoiceNumber(row.number), ...row.data.items.map(item => item.product)].some(value => includes(value, query))) : filtered).map(row => {
              const all = totals(row.data);
              return <div className="list-row" key={row.id}><div className="list-icon">{tab === "Trash" ? <Trash2 size={18} /> : <FileText size={18} />}</div>
                <div className="list-title"><strong>{invoiceNumber(row.number)} · {row.data.customer || "Unnamed customer"}</strong><span>{row.deletedAt ? "Expires " + timeLabel(row.deletedAt + retention) : dateLabel(row.data.date) + " · " + row.data.items.filter(item => activeItem(item)).length + " items"}</span></div>
                {tab !== "Trash" && <div className="list-money"><strong>PKR {money(tab === "Payments" ? all.pending : all.total)}</strong><span>{tab === "Payments" ? "Paid PKR " + money(all.paid) : status(row.data)}</span></div>}
                {tab === "Trash" ? <button className="secondary compact" disabled={busy} onClick={() => void mutate({ action: "restore", id: row.id, revision: row.revision }, "Sale restored.")}>Restore</button>
                  : <button className="secondary compact" onClick={() => tab === "Payments" ? start(row) : setInvoice(row)}>{tab === "Payments" ? "Update payment" : "View invoice"}</button>}
              </div>;
            })}
            {(tab === "Trash" ? !workspace.rows.some(row => row.deletedAt && Date.now() - row.deletedAt < retention && [row.data.customer, invoiceNumber(row.number), ...row.data.items.map(item => item.product)].some(value => includes(value, query))) : !filtered.length) && <div className="empty"><h3>{loading ? "Loading…" : tab === "Trash" && !query ? "Trash is empty" : "No matching sales"}</h3></div>}
          </div>}
        </section>
        {tab === "Reports" && report && <>
          <div className="stats report-stats">
            {([["Sales", report.sales], ["Cost", report.cost], ["Net profit", report.profit], ["Outstanding", report.pending]] as const).map(([label, value]) =>
              <div className="stat" key={label}><div className="stat-top">{label}</div><div className="stat-value">{value !== null && <small>PKR </small>}{money(value)}</div></div>)}
          </div>
          <ReportCharts data={report} onInstrument={name => { setFilter("product", name); setFilterOpen(true); }} onCustomer={name => { setFilter("customer", name); setFilterOpen(true); }} />
          <p className="report-note">Sales, cost and profit use matching instrument rows. Received and outstanding amounts use the whole invoice.</p>
        </>}
      </main>
    </div>
    {rowMenu && <Modal title={invoiceNumber(rowMenu.number)} close={() => setRowMenu(null)}><div className="dialog-body action-list">
      <button className="secondary" onClick={() => { void showHistory(rowMenu); setRowMenu(null); }}><HistoryIcon size={17} /> Version history</button>
      <button className="secondary danger-icon" onClick={() => { setTrash(rowMenu); setRowMenu(null); }}><Trash2 size={17} /> Move to Trash</button>
    </div></Modal>}
    {details && edit && <Modal title="Invoice details" close={() => setDetails(false)}>
      <div className="dialog-body"><p className="muted">These optional fields appear on the invoice or set a default for this sale.</p>
        <div className="form-grid">{([
          ["city", "Customer city"], ["surgeon", "Surgeon name"], ["patient", "Patient name"],
          ["room", "Room number"], ["ip", "IP number"],
        ] as const).map(([key, label]) => <label key={key}>{label}<input value={edit.data[key]} onChange={event => field(key, event.target.value)} /></label>)}
          <label>Commission / tax default<input placeholder="e.g. 1% or 100" value={edit.data.customerFee} onChange={event => field("customerFee", event.target.value)} /></label>
        </div>
        <button className="secondary" onClick={() => update(data => ({ ...data, items: data.items.map(item => ({ ...item, fee: data.customerFee })) }))}>Apply commission / tax to all items</button>
      </div><div className="dialog-actions"><button className="primary" onClick={() => setDetails(false)}><ArrowLeft size={16} /> Back to sheet</button></div>
    </Modal>}
    {invoice && <Modal title={invoiceNumber(invoice.number)} close={() => setInvoice(null)} wide>
      <div className="invoice-wrap"><Invoice row={invoice} /></div>
      <div className="dialog-actions"><button className="primary" onClick={() => window.print()}><Printer size={17} /> Print / Save PDF</button></div>
    </Modal>}
    {trash && <Modal title="Move sale to Trash?" close={() => setTrash(null)}>
      <div className="dialog-body"><p>{invoiceNumber(trash.number)} and its sale details can be restored for 14 days.</p></div>
      <div className="dialog-actions"><button className="secondary" onClick={() => setTrash(null)}>Cancel</button><button className="primary destructive" disabled={busy} onClick={() => void mutate({ action: "trash", id: trash.id, revision: trash.revision }, "Sale moved to Trash.", () => setTrash(null))}>Move to Trash</button></div>
      {message?.error && <p className="dialog-error" role="alert">{message.text}</p>}
    </Modal>}
    {history && <Modal title={"History · " + invoiceNumber(history.row.number)} close={() => setHistory(null)}>
      <div className="dialog-body">{history.list.map(version => <div className="history-row" key={version.revision}>
        <div><strong>Version {version.revision}</strong><p>{timeLabel(version.savedAt)}</p></div>
        <button className="secondary compact" onClick={() => { setInvoice({ ...history.row, data: version.data }); setHistory(null); }}>View invoice</button>
      </div>)}</div>
    </Modal>}
    {profile && <Modal title={tab === "Customers" ? "Customer defaults" : "Instrument defaults"} close={() => setProfile(null)}>
      <div className="dialog-body"><div className="form-grid"><label>Name<input value={profile.name} onChange={event => setProfile({ ...profile, name: event.target.value })} /></label>
        {(tab === "Customers" ? [["city", "City"], ["fee", "Commission / tax (PKR or %)"]] as const : [["rate", "Selling rate"], ["cost", "Cost rate"]] as const).map(([key, label]) =>
          <label key={key}>{label}<input value={profile[key] ?? ""} onChange={event => setProfile({ ...profile, [key]: event.target.value })} /></label>)}</div>
      </div><div className="dialog-actions"><button className="primary" disabled={busy} onClick={() => void mutate({ action: tab === "Customers" ? "customer" : "product", ...profile }, "Defaults saved.", () => setProfile(null))}>Save defaults</button></div>
      {message?.error && <p className="dialog-error" role="alert">{message.text}</p>}
    </Modal>}
    {help && <Modal title="Quick guide" close={() => setHelp(false)}><div className="dialog-body guide">
      <p><strong>Enter a sale.</strong> Click New sale, fill any cells you have, and use Tab to move across the sheet. Press Tab or Enter to accept the highlighted suggestion, or press Escape to keep what you typed.</p>
      <p><strong>Add instruments.</strong> Use Add another instrument to put multiple products on one invoice. Enter the amount paid once for the sale.</p>
      <p><strong>Update or print.</strong> Use the actions at the right end of a saved row. Choose Save as PDF in your browser’s print dialog.</p>
    </div></Modal>}
  </div>;
}
