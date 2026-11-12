"use client";

import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Slot = { id: string; provider: string; start: string; end: string; available: boolean };
type Booking = { id: string; name: string; email: string };
type LoadState = "loading" | "ready" | "error";

const dateTime = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" }).format(new Date(value));
const time = (value: string) => new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(new Date(value));

export default function Page() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [provider, setProvider] = useState("");
  const [selected, setSelected] = useState<Slot | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState("Please check your connection and try again.");
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<Booking | null>(null);
  const requestKey = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoadState("loading");
    try {
      const response = await fetch("/api/web/slots", { cache: "no-store" });
      if (response.status === 401 || response.status === 403) throw new Error("This site is asking visitors to sign in. The Netlify project must be public before appointment times can load.");
      if (!response.ok) throw new Error("Appointment times are unavailable. Please try again shortly.");
      const data: { slots?: Slot[] } = await response.json();
      if (!Array.isArray(data.slots)) throw new Error("Slots are unavailable right now.");
      setSlots(data.slots);
      setSelected((current) => current && data.slots?.find((slot) => slot.id === current.id && slot.available) || null);
      setLoadState("ready");
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "Please check your connection and try again.");
      setSlots([]);
      setSelected(null);
      setLoadState("error");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const providers = useMemo(() => [...new Set(slots.map((slot) => slot.provider))].sort(), [slots]);
  const visibleSlots = useMemo(() => slots.filter((slot) => slot.available && new Date(slot.start).getTime() > Date.now() && (!provider || slot.provider === provider)), [slots, provider]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) { setNotice("Choose an appointment time first."); return; }
    setBusy(true);
    setNotice("");
    try {
      requestKey.current ??= crypto.randomUUID();
      const response = await fetch("/api/web/bookings", {
        method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey.current },
        body: JSON.stringify({ slot_id: selected.id, name, email }),
      });
      const body: Booking & { error?: string } = await response.json();
      if (!response.ok) {
        setNotice(response.status === 409 ? "That time was just booked. Please choose another." : body.error || "We couldn't book this appointment. Please try again.");
        if (response.status === 429) requestKey.current = null;
        if (response.status === 409 || response.status === 404) void load();
        return;
      }
      setConfirmation(body);
    } catch {
      setNotice("We couldn't connect. Please check your connection and try again.");
    } finally { setBusy(false); }
  }

  if (confirmation) return (
    <main className="clinic-shell confirmation-shell">
      <div className="brand"><span className="brand-mark" aria-hidden="true">✳</span><span>Koya Clinic</span></div>
      <section className="confirmation-card" aria-live="polite">
        <span className="success-icon" aria-hidden="true">✓</span>
        <p className="eyebrow">Appointment confirmed</p><h1>You&apos;re all set.</h1>
        <p className="muted">Your visit is booked. Keep this confirmation for your records.</p>
        <div className="confirmation-details">
          <div><span>Provider</span><strong>{selected?.provider}</strong></div>
          <div><span>When</span><strong>{selected && `${dateTime(selected.start)} – ${time(selected.end)}`}</strong></div>
          <div><span>Patient</span><strong>{confirmation.name}</strong></div>
          <div><span>Email</span><strong>{confirmation.email}</strong></div>
          <div><span>Booking reference</span><strong className="booking-id">{confirmation.id}</strong></div>
        </div>
        <button className="primary-button" onClick={() => { setConfirmation(null); setSelected(null); setNotice(""); requestKey.current = null; void load(); }}>Book another appointment</button>
      </section>
    </main>
  );

  return (
    <main className="clinic-shell">
      <header className="site-header"><div className="brand"><span className="brand-mark" aria-hidden="true">✳</span><span>Koya Clinic</span></div><span className="header-note">Appointments, made simple</span></header>
      <div className="hero"><p className="eyebrow">Book a visit</p><h1>Care that fits your day.</h1><p>Choose an available time, add your details, and get an instant confirmation.</p></div>
      <div className="booking-layout">
        <section className="slots-section" aria-labelledby="slots-title">
          <div className="section-heading"><div><p className="step-label">01 / Choose a time</p><h2 id="slots-title">Available appointments</h2></div><label className="filter-label">Provider<select value={provider} onChange={(event) => { setProvider(event.target.value); setSelected(null); setNotice(""); requestKey.current = null; }}><option value="">All providers</option>{providers.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div>
          {loadState === "loading" && <div className="state-card" role="status">Finding available appointments…</div>}
          {loadState === "error" && <div className="state-card" role="alert"><strong>We couldn&apos;t load appointments.</strong><p>{loadError}</p><button className="text-button" onClick={() => void load()}>Try again</button></div>}
          {loadState === "ready" && visibleSlots.length === 0 && <div className="state-card"><strong>No times available{provider ? ` for ${provider}` : ""}.</strong><p>Try another provider or check back later.</p>{provider && <button className="text-button" onClick={() => setProvider("")}>See all providers</button>}</div>}
          {loadState === "ready" && visibleSlots.length > 0 && <div className="slot-list">{visibleSlots.map((slot) => <button type="button" key={slot.id} aria-pressed={selected?.id === slot.id} className={`slot-card ${selected?.id === slot.id ? "slot-selected" : ""}`} onClick={() => { setSelected(slot); setNotice(""); requestKey.current = null; }}><span className="slot-info"><strong>{slot.provider}</strong><span>{dateTime(slot.start)}</span><small>Until {time(slot.end)}</small></span><span className="slot-action">{selected?.id === slot.id ? "Selected ✓" : "Choose time"}</span></button>)}</div>}
        </section>
        <aside className="details-panel" aria-labelledby="details-title">
          <p className="step-label">02 / Your details</p>
          <h2 id="details-title">Confirm your visit</h2>
          <div className="chosen-time">
            {selected ? <><span>Selected appointment</span><strong>{selected.provider}</strong><span>{dateTime(selected.start)} – {time(selected.end)}</span></> : <span>{loadState === "error" ? "Appointment times could not load. Check the message under Available appointments." : loadState === "ready" && visibleSlots.length === 0 ? "No appointment times are available yet." : "Choose a time to continue."}</span>}
          </div>
          <form onSubmit={submit}>
            <label htmlFor="patient-name">Full name</label>
            <input id="patient-name" name="name" autoComplete="name" required maxLength={120} value={name} onChange={(event) => { setName(event.target.value); requestKey.current = null; }} placeholder="Your full name" />
            <label htmlFor="patient-email">Email address</label>
            <input id="patient-email" name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => { setEmail(event.target.value); requestKey.current = null; }} placeholder="you@example.com" />
            {notice && <p className="form-notice" role="alert">{notice}</p>}
            <button className="primary-button" type={selected ? "submit" : "button"} disabled={busy} onClick={!selected ? loadState === "error" ? () => void load() : () => document.getElementById("slots-title")?.scrollIntoView?.({ behavior: "smooth", block: "start" }) : undefined}>{busy ? "Confirming…" : selected ? "Confirm appointment" : loadState === "error" ? "Retry loading times" : "Choose an appointment time"}</button>
            <p className="privacy-note">Your details are used to confirm this appointment.</p>
          </form>
        </aside>
      </div>
    </main>
  );
}
