"use client";

import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Slot = { id: string; provider: string; start: string; end: string; available: boolean };
type Booking = { id: string; name: string; email: string };
type LoadState = "loading" | "ready" | "error";
const dateTime = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" }).format(new Date(value));
const time = (value: string) => new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(new Date(value));
const dayKey = (value: string | Date) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const monthKey = (date: Date) => date.getFullYear() * 12 + date.getMonth();
const monthFromKey = (key: number) => new Date(Math.floor(key / 12), key % 12, 1);

export default function Page() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [provider, setProvider] = useState("");
  const [day, setDay] = useState("");
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [selected, setSelected] = useState<Slot | null>(null);
  const [step, setStep] = useState<"schedule" | "details">("schedule");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState("Please check your connection and try again.");
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<Booking | null>(null);
  const requestKey = useRef<string | null>(null);
  const providerRef = useRef("");

  const load = useCallback(async () => {
    setLoadState("loading");
    try {
      const response = await fetch("/api/web/slots", { cache: "no-store" });
      if (response.status === 401 || response.status === 403) throw new Error("This site is asking visitors to sign in. The Netlify project must be public before appointment times can load.");
      if (!response.ok) throw new Error("Appointment times are unavailable. Please try again shortly.");
      const data: { slots?: Slot[] } = await response.json();
      if (!Array.isArray(data.slots)) throw new Error("Slots are unavailable right now.");
      setSlots(data.slots);
      const future = data.slots.filter((slot) => slot.available && new Date(slot.start).getTime() > Date.now() && (!providerRef.current || slot.provider === providerRef.current));
      const first = future[0];
      setDay(first ? dayKey(first.start) : "");
      if (first) setMonth(monthKey(new Date(first.start)));
      setSelected(null);
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
  const futureSlots = useMemo(() => slots.filter((slot) => slot.available && new Date(slot.start).getTime() > Date.now() && (!provider || slot.provider === provider)), [slots, provider]);
  const availableDays = useMemo(() => new Set(futureSlots.map((slot) => dayKey(slot.start))), [futureSlots]);
  const visibleSlots = useMemo(() => futureSlots.filter((slot) => dayKey(slot.start) === day), [futureSlots, day]);
  const availableMonths = futureSlots.map((slot) => monthKey(new Date(slot.start)));
  const firstMonth = availableMonths.length ? Math.min(...availableMonths) : month;
  const lastMonth = availableMonths.length ? Math.max(...availableMonths) : month;
  const monthDate = monthFromKey(month);
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(monthDate);
  const firstWeekday = monthDate.getDay();
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const calendarCells: (Date | null)[] = [...Array<null>(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => new Date(monthDate.getFullYear(), monthDate.getMonth(), index + 1))];

  function changeProvider(value: string) {
    setProvider(value);
    providerRef.current = value;
    const first = slots.find((slot) => slot.available && new Date(slot.start).getTime() > Date.now() && (!value || slot.provider === value));
    setDay(first ? dayKey(first.start) : "");
    if (first) setMonth(monthKey(new Date(first.start)));
    setSelected(null); setNotice(""); requestKey.current = null;
  }
  function changeMonth(direction: number) {
    const next = month + direction;
    if (next < firstMonth || next > lastMonth) return;
    setMonth(next);
    const first = futureSlots.find((slot) => monthKey(new Date(slot.start)) === next);
    setDay(first ? dayKey(first.start) : "");
    setSelected(null); setNotice(""); requestKey.current = null;
  }
  function continueToDetails() {
    if (loadState === "error") { void load(); return; }
    if (!selected) { setNotice("Choose one of the available times to continue."); return; }
    setNotice(""); setStep("details");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) { setNotice("Choose an appointment time first."); setStep("schedule"); return; }
    setBusy(true); setNotice("");
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
        if (response.status === 409 || response.status === 404) { setStep("schedule"); void load(); }
        return;
      }
      setConfirmation(body);
    } catch {
      setNotice("We couldn't connect. Please check your connection and try again.");
    } finally { setBusy(false); }
  }

  const brand = <div className="brand"><span className="brand-symbol" aria-hidden="true">+</span><span>Koya Clinic</span></div>;
  if (confirmation) return <main className="page-frame confirmation-page">
    <header className="topbar">{brand}<span>Appointment booking</span></header>
    <section className="confirmation-content" aria-live="polite">
      <div className="success-mark" aria-hidden="true">✓</div>
      <p className="eyebrow">Appointment confirmed</p><h1>You&apos;re all set.</h1>
      <p className="support-copy">Your appointment is booked. Save the reference below for your records.</p>
      <dl className="booking-summary">
        <div><dt>Clinician</dt><dd>{selected?.provider}</dd></div>
        <div><dt>Date &amp; time</dt><dd>{selected && `${dateTime(selected.start)} – ${time(selected.end)}`}</dd></div>
        <div><dt>Patient</dt><dd>{confirmation.name}</dd></div>
        <div><dt>Email</dt><dd>{confirmation.email}</dd></div>
        <div><dt>Booking reference</dt><dd className="booking-id">{confirmation.id}</dd></div>
      </dl>
      <button type="button" className="primary-button" onClick={() => { setConfirmation(null); setSelected(null); setStep("schedule"); setNotice(""); requestKey.current = null; void load(); }}>Book another appointment</button>
    </section>
  </main>;

  return <main className="page-frame">
    <header className="topbar">{brand}<span>Appointment booking</span></header>
    <div className="booking-window">
      <aside className="booking-sidebar" aria-label="Booking progress">
        <div className="sidebar-title"><span className="sidebar-kicker">A simpler way to visit</span><h1>Book an appointment.</h1><p>Choose a time that works for you. No account needed.</p></div>
        <ol className="steps">
          <li className={step === "schedule" ? "current" : "complete"}><span className="step-number">1</span><span><strong>Date &amp; time</strong><small>Choose an open slot</small></span></li>
          <li className={step === "details" ? "current" : ""}><span className="step-number">2</span><span><strong>Your details</strong><small>Name and email</small></span></li>
          <li><span className="step-number">3</span><span><strong>Confirmation</strong><small>Booking reference</small></span></li>
        </ol>
        {step === "schedule" && providers.length > 1 && <label className="provider-filter">Clinician <select aria-label="Provider" value={provider} onChange={(event) => changeProvider(event.target.value)}><option value="">All clinicians</option>{providers.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>}
        <p className="sidebar-note">Your details are only used to confirm your visit.</p>
      </aside>

      {step === "schedule" ? <div className="schedule-layout">
        <section className="calendar-panel" aria-labelledby="schedule-title">
          <div className="panel-heading"><p className="eyebrow">Step 1 of 2</p><h2 id="schedule-title">Choose a date &amp; time</h2><p>Dates with appointments are marked below.</p></div>
          <div className="month-bar"><h3>{monthLabel}</h3><div className="month-buttons"><button type="button" aria-label="Previous month" disabled={month <= firstMonth} onClick={() => changeMonth(-1)}>‹</button><button type="button" aria-label="Next month" disabled={month >= lastMonth} onClick={() => changeMonth(1)}>›</button></div></div>
          <div className="calendar-grid" role="group" aria-label={monthLabel}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => <span className="weekday" key={label}>{label}</span>)}
            {calendarCells.map((date, index) => date ? <button type="button" key={dayKey(date)} className={`date-cell ${dayKey(date) === day ? "date-selected" : ""}`} aria-label={new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(date)} aria-pressed={dayKey(date) === day} disabled={!availableDays.has(dayKey(date))} onClick={() => { setDay(dayKey(date)); setSelected(null); setNotice(""); requestKey.current = null; }}>{date.getDate()}</button> : <span key={`blank-${index}`} aria-hidden="true" />)}
          </div>
          <p className="calendar-caption"><span aria-hidden="true" className="legend-dot" />Available appointment</p>
        </section>
        <section className="times-panel" aria-labelledby="times-title">
          <div className="times-heading"><p className="eyebrow">Available times</p><h3 id="times-title">{day ? new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date(`${day}T12:00:00`)) : "Select a date"}</h3></div>
          {loadState === "loading" && <p className="status-message" role="status">Finding available appointments…</p>}
          {loadState === "error" && <div className="status-message" role="alert"><strong>We couldn&apos;t load appointments.</strong><p>{loadError}</p></div>}
          {loadState === "ready" && visibleSlots.length === 0 && <div className="status-message"><strong>No appointment times available{provider ? ` for ${provider}` : ""}.</strong><p>{slots.length === 0 ? "The clinic has not published any appointments yet." : "Try another date or clinician, or check back later."}</p></div>}
          {loadState === "ready" && visibleSlots.length > 0 && <div className="time-list">{visibleSlots.map((slot) => <button type="button" key={slot.id} className={`time-option ${selected?.id === slot.id ? "time-selected" : ""}`} aria-pressed={selected?.id === slot.id} onClick={() => { setSelected(slot); setNotice(""); requestKey.current = null; }}><span><strong>{time(slot.start)}</strong><small>{slot.provider}</small></span><span className="time-indicator" aria-hidden="true">{selected?.id === slot.id ? "✓" : ""}</span></button>)}</div>}
          {notice && <p className="form-notice" role="alert">{notice}</p>}
          <button type="button" className="primary-button continue-button" onClick={continueToDetails}>{loadState === "error" ? "Retry loading times" : selected ? "Continue" : "Choose an appointment time"}<span aria-hidden="true">→</span></button>
        </section>
      </div> : <section className="details-step" aria-labelledby="details-title">
        <button type="button" className="back-button" onClick={() => { setStep("schedule"); setNotice(""); }}>← Back to date &amp; time</button>
        <p className="eyebrow">Step 2 of 2</p><h2 id="details-title">Your details</h2><p className="support-copy">We&apos;ll use these to confirm your appointment.</p>
        <div className="selected-appointment"><span className="eyebrow">Selected appointment</span><strong>{selected?.provider}</strong><span>{selected && `${dateTime(selected.start)} – ${time(selected.end)}`}</span></div>
        <form onSubmit={submit}>
          <label htmlFor="patient-name">Full name</label><input id="patient-name" name="name" autoComplete="name" required maxLength={120} value={name} onChange={(event) => { setName(event.target.value); requestKey.current = null; }} placeholder="Your full name" />
          <label htmlFor="patient-email">Email address</label><input id="patient-email" name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => { setEmail(event.target.value); requestKey.current = null; }} placeholder="you@example.com" />
          {notice && <p className="form-notice" role="alert">{notice}</p>}
          <button className="primary-button" type="submit" disabled={busy}>{busy ? "Confirming…" : "Confirm appointment"}</button>
        </form>
      </section>}
    </div>
  </main>;
}
