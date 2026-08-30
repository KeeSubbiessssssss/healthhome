"use client";

import { useMemo, useState } from "react";

type IconName = "grid" | "pulse" | "box" | "users" | "settings" | "chevron" | "more" | "plus" | "refresh";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    pulse: <path d="M3 12h4l2.3-5.5L14 18l2.2-6H21" />,
    box: <><path d="m3.5 7.5 8.5 4.7 8.5-4.7" /><path d="M12 21.5v-9.3" /><path d="m4 7.3 8-4.5 8 4.5v9.4l-8 4.6-8-4.6Z" /></>,
    users: <><path d="M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-4A4.5 4.5 0 0 0 3 18.5V20" /><circle cx="9.5" cy="7" r="3.5" /><path d="M17 14a4 4 0 0 1 4 4v2" /><path d="M16 3.7a3.5 3.5 0 0 1 0 6.6" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.27 2.27-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.57v.09h-3.2v-.09a1.7 1.7 0 0 0-1.03-1.57 1.7 1.7 0 0 0-1.88.34l-.06.06-2.27-2.27.06-.06A1.7 1.7 0 0 0 6.52 15a1.7 1.7 0 0 0-1.57-1.03h-.09v-3.2h.09A1.7 1.7 0 0 0 6.52 9.74a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.27-2.27.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.03-1.57v-.09h3.2v.09a1.7 1.7 0 0 0 1.03 1.57 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.27 2.27-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.57 1.03h.09v3.2h-.09A1.7 1.7 0 0 0 19.4 15Z" /></>,
    chevron: <path d="m9 18 6-6-6-6" />, more: <><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></>, plus: <path d="M12 5v14M5 12h14" />,
    refresh: <><path d="M20 11a8.1 8.1 0 0 0-14.9-3L3 10" /><path d="M3 4v6h6" /><path d="M4 13a8.1 8.1 0 0 0 14.9 3l2.1-2" /><path d="M21 20v-6h-6" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

const readings = [[0,142],[8,132],[18,146],[27,127],[38,157],[49,139],[60,151],[71,131],[82,145],[93,136],[104,164],[115,145],[126,153],[137,138],[148,143],[159,126],[170,133],[181,119],[192,131],[203,122],[214,128],[225,116],[236,121],[247,112],[258,118],[269,108],[280,115],[291,104],[302,111],[313,99],[324,108],[335,101],[346,105],[357,99],[368,106],[379,94],[390,102],[401,97],[412,103],[423,99],[434,109],[445,101],[456,109],[467,104],[478,112],[489,108],[500,117],[511,113],[522,126],[533,120],[544,133],[555,127],[566,137],[577,129],[588,141],[599,135],[610,146],[621,139],[632,151],[643,142],[654,155],[665,147],[676,161],[687,154],[698,169],[709,160],[720,168]];
const inventory = [{ name: "Dexcom G7 Sensors", detail: "4 remaining", state: "good" }, { name: "Alcohol wipes", detail: "Low · 1 box", state: "low" }, { name: "Test strips", detail: "2 boxes", state: "good" }];

export default function Home() {
  const [range, setRange] = useState("24 hours");
  const [synced, setSynced] = useState("Updated just now");
  const [activeNav, setActiveNav] = useState("Overview");
  const chartPoints = useMemo(() => readings.map(([x, y]) => `${x},${212 - (y - 80) * 1.24}`).join(" "), []);
  const navItems: { label: string; icon: IconName }[] = [{ label: "Overview", icon: "grid" }, { label: "Glucose", icon: "pulse" }, { label: "Inventory", icon: "box" }, { label: "Household", icon: "users" }];
  function refresh() { setSynced("Checking connection…"); window.setTimeout(() => setSynced("Updated just now"), 700); }

  return <main className="app-shell">
    <aside className="sidebar" aria-label="Main navigation">
      <div className="brand"><span className="brand-mark">H</span><span>HealthHome</span></div>
      <nav className="nav-list">{navItems.map(({ label, icon }) => <button key={label} className={`nav-item ${activeNav === label ? "selected" : ""}`} onClick={() => setActiveNav(label)}><Icon name={icon} size={19} /><span>{label}</span></button>)}</nav>
      <div className="sidebar-footer"><button className="nav-item" onClick={() => setActiveNav("Settings")}><Icon name="settings" size={19} /><span>Settings</span></button><div className="profile"><span className="avatar">K</span><span><strong>Kees</strong><small>Home owner</small></span><Icon name="more" size={20} /></div></div>
    </aside>
    <section className="content">
      <header className="topbar"><div><p className="eyebrow">Thursday, 28 August</p><h1>Good evening, Kees.</h1></div><button className="quiet-button" onClick={refresh}><Icon name="refresh" size={17} />Refresh</button></header>
      <section className="notice" aria-label="Prototype privacy notice"><span className="notice-dot" />This is a local prototype using example data. It is not connected to Dexcom.</section>
      <section className="intro-row"><div><h2>Your household at a glance</h2><p>Keep an eye on the things that matter, from one calm place.</p></div><span className="live-status"><i /> {synced}</span></section>
      <section className="metric-grid" aria-label="Health summary">
        <article className="metric-card glucose-card"><div className="card-heading"><div><span className="card-icon coral"><Icon name="pulse" size={19} /></span><p>Glucose</p></div><button aria-label="More glucose options"><Icon name="more" size={19} /></button></div><div className="glucose-reading"><strong>6.0</strong><span>mmol/L</span><b>→</b></div><p className="status-copy"><span className="status-dot" />In range</p><div className="updated"><span>Last reading at 6:42 pm</span><span>{synced}</span></div></article>
        <article className="metric-card inventory-card"><div className="card-heading"><div><span className="card-icon amber"><Icon name="box" size={19} /></span><p>Inventory</p></div><button aria-label="View inventory"><Icon name="chevron" size={19} /></button></div><div className="inventory-total"><strong>12</strong><span>items tracked</span></div><p className="inventory-warning"><span className="warning-dot" />2 items need attention</p><div className="updated"><span>Last updated today</span></div></article>
        <article className="metric-card household-card"><div className="card-heading"><div><span className="card-icon violet"><Icon name="users" size={19} /></span><p>Household</p></div><button aria-label="View household"><Icon name="chevron" size={19} /></button></div><div className="people"><span className="avatar owner">K</span><span className="avatar partner">A</span><span className="member-copy"><strong>2 people</strong><small>Connected to HealthHome</small></span></div><div className="updated"><span>Your private space</span></div></article>
      </section>
      <section className="dashboard-grid">
        <article className="panel glucose-panel"><div className="panel-title"><div><p className="section-kicker">GLUCOSE HISTORY</p><h2>Today&apos;s trend</h2></div><div className="range-tabs">{["6 hours", "12 hours", "24 hours"].map((item) => <button key={item} className={range === item ? "active" : ""} onClick={() => setRange(item)}>{item}</button>)}</div></div><div className="chart-wrap"><div className="chart-scale"><span>180</span><span>140</span><span>100</span><span>60</span></div><svg viewBox="0 0 720 240" role="img" aria-label={`${range} glucose trend using example data`} preserveAspectRatio="none"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f4a07b" stopOpacity=".26" /><stop offset="1" stopColor="#f4a07b" stopOpacity="0" /></linearGradient></defs><path className="grid-line" d="M0 40H720M0 105H720M0 170H720M0 230H720" /><polyline points={`0,240 ${chartPoints} 720,240`} fill="url(#fill)" stroke="none" /><polyline points={chartPoints} fill="none" stroke="#e7794f" strokeWidth="3" vectorEffect="non-scaling-stroke" /><circle cx="720" cy="103" r="5.5" fill="#fff" stroke="#e7794f" strokeWidth="3" vectorEffect="non-scaling-stroke" /></svg><div className="chart-labels"><span>12 am</span><span>6 am</span><span>12 pm</span><span>6 pm</span></div></div><p className="chart-note">Example data only. HealthHome does not provide clinical alerts or treatment advice.</p></article>
        <article className="panel inventory-panel"><div className="panel-title"><div><p className="section-kicker">SHARED INVENTORY</p><h2>Need attention</h2></div><button className="round-add" aria-label="Add inventory item" onClick={() => setActiveNav("Inventory")}><Icon name="plus" size={18} /></button></div><div className="inventory-list">{inventory.map((item) => <button className="inventory-row" key={item.name} onClick={() => setActiveNav("Inventory")}><span className={`supply-icon ${item.state}`}><Icon name="box" size={18} /></span><span className="supply-copy"><strong>{item.name}</strong><small>{item.detail}</small></span><span className={`pill ${item.state}`}>{item.state === "low" ? "Restock" : "On hand"}</span><Icon name="chevron" size={16} /></button>)}</div><button className="text-link" onClick={() => setActiveNav("Inventory")}>View all inventory <Icon name="chevron" size={16} /></button></article>
      </section>
    </section>
  </main>;
}
