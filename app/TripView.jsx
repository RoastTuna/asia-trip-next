"use client";

import { useEffect, useRef, useState } from "react";
import { supabase, TRIP_ID } from "../lib/supabase";
import { seedTrip, ensureShape } from "../lib/seed";

const SAVE_DEBOUNCE_MS = 400;

export default function TripView() {
  const [trip, setTrip] = useState(null);
  const [checks, setChecks] = useState({});
  const [tab, setTab] = useState("itinerary");
  const [edit, setEdit] = useState(false);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const lastLocalWriteAt = useRef(0);
  const saveTimer = useRef(null);
  const checksTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("trips")
          .select("data, checks, updated_at")
          .eq("id", TRIP_ID)
          .maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        if (!data) {
          const insert = await supabase
            .from("trips")
            .insert({ id: TRIP_ID, data: seedTrip, checks: {} })
            .select()
            .single();
          if (insert.error) throw insert.error;
          setTrip(insert.data.data);
          setChecks(insert.data.checks || {});
        } else {
          const { trip: shaped, changed } = ensureShape(data.data);
          setTrip(shaped);
          setChecks(data.checks || {});
          if (changed) {
            lastLocalWriteAt.current = Date.now();
            await supabase.from("trips").update({ data: shaped }).eq("id", TRIP_ID);
          }
        }
        setStatus("live");
      } catch (e) {
        console.error(e);
        setError(e.message || String(e));
        setStatus("error");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("trip-" + TRIP_ID)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trips", filter: `id=eq.${TRIP_ID}` },
        (payload) => {
          const remoteAt = new Date(payload.new.updated_at).getTime();
          if (remoteAt <= lastLocalWriteAt.current + 250) return;
          if (payload.new.data) setTrip(payload.new.data);
          if (payload.new.checks) setChecks(payload.new.checks);
        }
      )
      .subscribe((s) => {
        if (s === "SUBSCRIBED") setStatus("live");
      });
    return () => { supabase.removeChannel(channel); };
  }, []);

  function scheduleSave(nextTrip) {
    setTrip(nextTrip);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      lastLocalWriteAt.current = Date.now();
      const { error } = await supabase
        .from("trips")
        .update({ data: nextTrip })
        .eq("id", TRIP_ID);
      if (error) setError(error.message);
    }, SAVE_DEBOUNCE_MS);
  }

  function scheduleChecksSave(nextChecks) {
    setChecks(nextChecks);
    clearTimeout(checksTimer.current);
    checksTimer.current = setTimeout(async () => {
      lastLocalWriteAt.current = Date.now();
      const { error } = await supabase
        .from("trips")
        .update({ checks: nextChecks })
        .eq("id", TRIP_ID);
      if (error) setError(error.message);
    }, SAVE_DEBOUNCE_MS);
  }

  if (status === "error" && !trip) {
    return <ConfigError message={error} />;
  }
  if (!trip) {
    return <div style={{ padding: 48, color: "var(--muted)" }}>Loading…</div>;
  }

  return (
    <>
      <header className="hero">
        <div className="hero-row">
          <div>
            <h1>{trip.title}</h1>
            <p className="muted">{trip.subtitle}</p>
            <Countdown firstDate={trip.legs[0]?.date} />
            <PeopleBar
              people={trip.people}
              edit={edit}
              onChange={(people) => scheduleSave({ ...trip, people })}
            />
          </div>
          <div className="hero-actions">
            <span className={`status-pill ${status}`}>
              {status === "live" ? "● live" : status === "error" ? "offline" : "…"}
            </span>
            <button className="ghost" onClick={() => setEdit((v) => !v)}>
              {edit ? "Done" : "✎ Edit"}
            </button>
          </div>
        </div>
        {error && <div className="error-banner">{error} <button className="ghost" onClick={() => setError(null)}>dismiss</button></div>}
      </header>

      <nav className="tabs">
        {["itinerary", "map", "packing", "todos"].map((t) => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>

      <main>
        {tab === "itinerary" && (
          <Itinerary trip={trip} edit={edit} onChange={scheduleSave} />
        )}
        {tab === "map" && <MapView trip={trip} />}
        {tab === "packing" && (
          <PackingList
            trip={trip}
            checks={checks}
            edit={edit}
            onTripChange={scheduleSave}
            onChecksChange={scheduleChecksSave}
          />
        )}
        {tab === "todos" && (
          <TodoList
            trip={trip}
            checks={checks}
            edit={edit}
            onTripChange={scheduleSave}
            onChecksChange={scheduleChecksSave}
          />
        )}
      </main>

      <footer>
        Live-synced via Supabase. Anyone with this link can edit.
      </footer>
    </>
  );
}

function PeopleBar({ people, edit, onChange }) {
  if (!people || people.length === 0) return null;
  function patch(idx, key, value) {
    const next = people.map((p, i) => (i === idx ? { ...p, [key]: value } : p));
    onChange(next);
  }
  return (
    <div className="people-bar">
      {people.map((p, i) => (
        <span key={p.id} className="person">
          {edit ? (
            <>
              <input type="color" value={p.color} onChange={(e) => patch(i, "color", e.target.value)} />
              <input type="text" value={p.name} onChange={(e) => patch(i, "name", e.target.value)} />
            </>
          ) : (
            <>
              <span className="person-swatch" style={{ background: p.color }} />
              <span>{p.name}</span>
            </>
          )}
        </span>
      ))}
    </div>
  );
}

function Countdown({ firstDate }) {
  if (!firstDate) return null;
  const days = Math.ceil((new Date(firstDate) - new Date()) / 86400000);
  let text;
  if (days > 1) text = `${days} days until departure`;
  else if (days === 1) text = "Leaving tomorrow";
  else if (days === 0) text = "Leaving today!";
  else text = "Trip in progress / past";
  return <p className="countdown">{text}</p>;
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function fmtRange(start, end) {
  if (!end || end === start) return fmtDate(start);
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}

function Itinerary({ trip, edit, onChange }) {
  function update(idx, patch) {
    const legs = trip.legs.map((l, i) => (i === idx ? { ...l, ...patch } : l));
    onChange({ ...trip, legs });
  }
  function updateNested(idx, key, subKey, value) {
    const legs = trip.legs.map((l, i) =>
      i === idx ? { ...l, [key]: { ...l[key], [subKey]: value } } : l
    );
    onChange({ ...trip, legs });
  }
  function deleteLeg(idx) {
    if (!confirm(`Delete "${trip.legs[idx].from.name}" leg?`)) return;
    onChange({ ...trip, legs: trip.legs.filter((_, i) => i !== idx) });
  }
  function addLeg() {
    const prev = trip.legs[trip.legs.length - 1];
    const from = prev?.to || { name: "", lat: 0, lon: 0 };
    const today = new Date().toISOString().slice(0, 10);
    const firstPerson = trip.people?.[0]?.id || "shao";
    const newLeg = {
      id: "leg-" + Date.now(),
      type: "flight",
      participants: [firstPerson],
      flightNumber: "",
      date: today,
      departTime: "",
      arriveTime: "",
      from: { ...from },
      to: { name: "", lat: 0, lon: 0 },
      notes: "",
    };
    onChange({ ...trip, legs: [...trip.legs, newLeg] });
  }

  return (
    <section className="panel active">
      <ol className="timeline">
        {trip.legs.map((leg, i) => (
          <LegCard
            key={leg.id}
            leg={leg}
            people={trip.people || []}
            edit={edit}
            onPatch={(patch) => update(i, patch)}
            onPatchNested={(k, s, v) => updateNested(i, k, s, v)}
            onDelete={() => deleteLeg(i)}
          />
        ))}
      </ol>
      {edit && (
        <div className="add-row">
          <button className="add-btn" onClick={addLeg}>+ Add leg</button>
        </div>
      )}
    </section>
  );
}

function LegCard({ leg, people, edit, onPatch, onPatchNested, onDelete }) {
  const isFlight = leg.type === "flight";
  const participants = leg.participants || [];
  const activePeople = people.filter((p) => participants.includes(p.id));

  function toggleParticipant(personId) {
    const next = participants.includes(personId)
      ? participants.filter((id) => id !== personId)
      : [...participants, personId];
    onPatch({ participants: next });
  }

  return (
    <li>
      <span className={`dot ${isFlight ? "flight" : ""}`} />
      <div className="card">
        {edit && <button className="delete-btn" onClick={onDelete}>×</button>}
        <div className="when">{fmtRange(leg.date, leg.endDate)}</div>
        <div className="what">
          <span className="badge">{leg.type}</span>
          {isFlight ? `${leg.from.name} → ${leg.to.name}` : leg.from.name}
          {isFlight && leg.flightNumber && (
            <a
              className="flight-link"
              href={`https://www.flightaware.com/live/flight/${encodeURIComponent(leg.flightNumber.replace(/\s+/g, ""))}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Check flight status on FlightAware"
            >
              ✈ {leg.flightNumber} ↗
            </a>
          )}
        </div>
        {isFlight && leg.departTime && leg.arriveTime && (
          <div className="times">Depart {leg.departTime} → Arrive {leg.arriveTime}</div>
        )}
        {activePeople.length > 0 && (
          <div className="participant-chips">
            {activePeople.map((p) => (
              <span key={p.id} className="participant-chip" title={p.name}>
                <span className="person-swatch" style={{ background: p.color }} />
                {p.name}
              </span>
            ))}
          </div>
        )}
        {leg.notes && <div className="notes">{leg.notes}</div>}
      </div>
      {edit && (
        <div className="edit-grid">
          <label>Type
            <select value={leg.type} onChange={(e) => onPatch({ type: e.target.value })}>
              <option value="flight">flight</option>
              <option value="stay">stay</option>
              <option value="activity">activity</option>
            </select>
          </label>
          <label>Date
            <input type="date" value={leg.date || ""} onChange={(e) => onPatch({ date: e.target.value })} />
          </label>
          {(leg.type === "stay" || leg.type === "activity") && (
            <label>End date
              <input type="date" value={leg.endDate || ""} onChange={(e) => onPatch({ endDate: e.target.value })} />
            </label>
          )}
          {isFlight && (
            <>
              <label>Depart time
                <input type="time" value={leg.departTime || ""} onChange={(e) => onPatch({ departTime: e.target.value })} />
              </label>
              <label>Arrive time
                <input type="time" value={leg.arriveTime || ""} onChange={(e) => onPatch({ arriveTime: e.target.value })} />
              </label>
            </>
          )}
          <label className="full">From name
            <input type="text" value={leg.from.name} onChange={(e) => onPatchNested("from", "name", e.target.value)} />
          </label>
          <label>From lat
            <input type="number" step="0.0001" value={leg.from.lat} onChange={(e) => onPatchNested("from", "lat", parseFloat(e.target.value) || 0)} />
          </label>
          <label>From lon
            <input type="number" step="0.0001" value={leg.from.lon} onChange={(e) => onPatchNested("from", "lon", parseFloat(e.target.value) || 0)} />
          </label>
          {isFlight && (
            <>
              <label className="full">To name
                <input type="text" value={leg.to.name} onChange={(e) => onPatchNested("to", "name", e.target.value)} />
              </label>
              <label>To lat
                <input type="number" step="0.0001" value={leg.to.lat} onChange={(e) => onPatchNested("to", "lat", parseFloat(e.target.value) || 0)} />
              </label>
              <label>To lon
                <input type="number" step="0.0001" value={leg.to.lon} onChange={(e) => onPatchNested("to", "lon", parseFloat(e.target.value) || 0)} />
              </label>
            </>
          )}
          {isFlight && (
            <label className="full">Flight number
              <input
                type="text"
                value={leg.flightNumber || ""}
                placeholder="e.g. BR016"
                onChange={(e) => onPatch({ flightNumber: e.target.value })}
              />
            </label>
          )}
          {people.length > 0 && (
            <label className="full">Who's on this leg
              <div className="participant-toggles">
                {people.map((p) => (
                  <label key={p.id} className="participant-toggle">
                    <input
                      type="checkbox"
                      checked={participants.includes(p.id)}
                      onChange={() => toggleParticipant(p.id)}
                    />
                    <span className="person-swatch" style={{ background: p.color }} />
                    {p.name}
                  </label>
                ))}
              </div>
            </label>
          )}
          <label className="full">Notes
            <textarea value={leg.notes || ""} onChange={(e) => onPatch({ notes: e.target.value })} />
          </label>
        </div>
      )}
    </li>
  );
}

function MapView({ trip }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    let cleanup = () => {};
    function init() {
      if (!window.L || !containerRef.current || mapRef.current) return;
      const L = window.L;
      const map = L.map(containerRef.current);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 18,
      }).addTo(map);
      draw(map, L, trip);
      cleanup = () => { map.remove(); mapRef.current = null; };
    }
    if (window.L) {
      init();
    } else {
      const s = document.createElement("script");
      s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      s.crossOrigin = "";
      s.onload = init;
      document.head.appendChild(s);
    }
    return () => cleanup();
  }, []);

  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    draw(mapRef.current, window.L, trip);
  }, [trip]);

  return (
    <section className="panel active">
      <div id="leaflet-map" ref={containerRef} />
    </section>
  );
}

function draw(map, L, trip) {
  map.eachLayer((layer) => {
    if (layer instanceof L.Marker || layer instanceof L.Polyline) map.removeLayer(layer);
  });
  const points = [];
  const seen = new Set();
  for (const leg of trip.legs) {
    for (const p of [leg.from, leg.to]) {
      const key = `${p.lat},${p.lon}`;
      if (seen.has(key) || (p.lat === 0 && p.lon === 0)) continue;
      seen.add(key);
      L.marker([p.lat, p.lon]).addTo(map).bindPopup(p.name);
      points.push([p.lat, p.lon]);
    }
  }
  const peopleById = Object.fromEntries((trip.people || []).map((p) => [p.id, p]));
  for (const leg of trip.legs.filter((l) => l.type === "flight")) {
    if (leg.from.lat === 0 || leg.to.lat === 0) continue;
    const parts = leg.participants || [];
    const color = parts.length === 1 && peopleById[parts[0]]
      ? peopleById[parts[0]].color
      : "#c2410c";
    L.polyline([[leg.from.lat, leg.from.lon], [leg.to.lat, leg.to.lon]],
      { color, weight: 2, dashArray: "6 6" }).addTo(map);
  }
  if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
  else map.setView([20, 120], 4);
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);
}

function PackingList({ trip, checks, edit, onTripChange, onChecksChange }) {
  const [label, setLabel] = useState("");
  const [cat, setCat] = useState("");
  const groups = {};
  for (const item of trip.packing) (groups[item.category || "Other"] ||= []).push(item);
  const done = trip.packing.filter((i) => checks["pack:" + i.id]).length;

  function toggle(id) {
    const k = "pack:" + id;
    onChecksChange({ ...checks, [k]: !checks[k] });
  }
  function del(id) {
    if (!confirm("Delete this item?")) return;
    onTripChange({ ...trip, packing: trip.packing.filter((i) => i.id !== id) });
  }
  function add() {
    if (!label.trim()) return;
    const item = { id: slugify(label), label: label.trim(), category: cat.trim() || "Other" };
    onTripChange({ ...trip, packing: [...trip.packing, item] });
    setLabel(""); setCat("");
  }
  function uncheckAll() {
    if (!confirm("Uncheck all packing items?")) return;
    const next = { ...checks };
    for (const i of trip.packing) delete next["pack:" + i.id];
    onChecksChange(next);
  }

  return (
    <section className="panel active">
      <div className="list-meta">
        <span className="muted">{done} / {trip.packing.length} done</span>
        <button className="ghost" onClick={uncheckAll}>Uncheck all</button>
      </div>
      {Object.entries(groups).map(([category, items]) => (
        <div key={category}>
          <div className="category-title">{category}</div>
          <ul className="checklist">
            {items.map((item) => (
              <li key={item.id} className={checks["pack:" + item.id] ? "done" : ""}>
                <input type="checkbox" id={"p-" + item.id} checked={!!checks["pack:" + item.id]} onChange={() => toggle(item.id)} />
                <label htmlFor={"p-" + item.id}>{item.label}</label>
                {edit && <button className="delete-btn" onClick={() => del(item.id)}>×</button>}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {edit && (
        <div className="add-row">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="New item…" />
          <input className="cat" value={cat} onChange={(e) => setCat(e.target.value)} placeholder="Category" />
          <button className="add-btn" onClick={add}>+ Add</button>
        </div>
      )}
    </section>
  );
}

function TodoList({ trip, checks, edit, onTripChange, onChecksChange }) {
  const [label, setLabel] = useState("");
  const done = trip.todos.filter((i) => checks["todo:" + i.id]).length;

  function toggle(id) {
    const k = "todo:" + id;
    onChecksChange({ ...checks, [k]: !checks[k] });
  }
  function del(id) {
    if (!confirm("Delete this to-do?")) return;
    onTripChange({ ...trip, todos: trip.todos.filter((i) => i.id !== id) });
  }
  function add() {
    if (!label.trim()) return;
    const item = { id: slugify(label), label: label.trim() };
    onTripChange({ ...trip, todos: [...trip.todos, item] });
    setLabel("");
  }
  function uncheckAll() {
    if (!confirm("Uncheck all to-dos?")) return;
    const next = { ...checks };
    for (const i of trip.todos) delete next["todo:" + i.id];
    onChecksChange(next);
  }

  return (
    <section className="panel active">
      <div className="list-meta">
        <span className="muted">{done} / {trip.todos.length} done</span>
        <button className="ghost" onClick={uncheckAll}>Uncheck all</button>
      </div>
      <ul className="checklist">
        {trip.todos.map((item) => (
          <li key={item.id} className={checks["todo:" + item.id] ? "done" : ""}>
            <input type="checkbox" id={"t-" + item.id} checked={!!checks["todo:" + item.id]} onChange={() => toggle(item.id)} />
            <label htmlFor={"t-" + item.id}>{item.label}</label>
            {edit && <button className="delete-btn" onClick={() => del(item.id)}>×</button>}
          </li>
        ))}
      </ul>
      {edit && (
        <div className="add-row">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="New to-do…" />
          <button className="add-btn" onClick={add}>+ Add</button>
        </div>
      )}
    </section>
  );
}

function ConfigError({ message }) {
  return (
    <div style={{ maxWidth: 640, margin: "80px auto", padding: 24, fontFamily: "system-ui" }}>
      <h2 style={{ color: "var(--danger)" }}>Couldn't load trip</h2>
      <p className="muted">{message}</p>
      <p>Check that you've:</p>
      <ol>
        <li>Created a <code>trips</code> table by running <code>supabase/schema.sql</code> in Supabase SQL Editor.</li>
        <li>Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in <code>.env.local</code> (or in Vercel env vars).</li>
        <li>Enabled Realtime on the <code>trips</code> table.</li>
      </ol>
    </div>
  );
}
