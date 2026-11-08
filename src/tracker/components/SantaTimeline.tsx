"use client";

import { useRef, useEffect, useMemo, useState, useId } from "react";
import { santaStops, formatStopOffset, formatStopArrival, getStopArrivalDate } from "@/data/santaRouteStops";
import { getVisitedStops, getCurrentStopId } from "@/lib/santaRoute";
import { MAP_REGIONS, stopRegion } from "./trackerCamera";
import "../tracker-journey.css";

interface SantaTimelineProps {
  effectiveTime: Date;
}

type Status = "all" | "visited" | "upcoming";

export default function SantaTimeline({ effectiveTime }: SantaTimelineProps) {
  const year = effectiveTime.getUTCFullYear();
  const uid = useId();
  const routeStops = useMemo(
    () => [...santaStops].sort((a, b) => getStopArrivalDate(a, year).getTime() - getStopArrivalDate(b, year).getTime()),
    [year],
  );
  const visited = getVisitedStops(effectiveTime);
  const currentId = getCurrentStopId(effectiveTime);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const listRef = useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();
  const filtered = routeStops
    .map((stop, i) => ({ stop, n: i + 1 }))
    .filter(({ stop }) => {
      if (region && stopRegion(stop) !== region) return false;
      const v = visited.has(stop.id);
      if (status === "visited" && !v) return false;
      if (status === "upcoming" && v) return false;
      if (q && !`${stop.name} ${stop.displayLabel} ${stop.region}`.toLowerCase().includes(q)) return false;
      return true;
    });

  const jumpToCurrent = (smooth: boolean) => {
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>("[data-current='true']");
    if (!list || !el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    list.scrollTo({ top: el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2, behavior: smooth && !reduced ? "smooth" : "auto" });
  };

  useEffect(() => {
    jumpToCurrent(true);
  }, [currentId]);

  const pct = (visited.size / routeStops.length) * 100;

  return (
    <div className="max-w-6xl mx-auto tj-tl">
      <div className="tj-tl-progress" aria-hidden="true"><span style={{ transform: `scaleX(${pct / 100})` }} /></div>
      <div className="tj-tl-head">
        <label className="sr-only" htmlFor={`${uid}-q`}>Search destinations</label>
        <input id={`${uid}-q`} className="tj-input" type="search" placeholder={`Search ${routeStops.length} stops`} value={query} onChange={(e) => setQuery(e.target.value)} style={{ flex: "1 1 10rem" }} />
        <label className="sr-only" htmlFor={`${uid}-r`}>Filter by region</label>
        <select id={`${uid}-r`} className="tj-select" value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="">All regions</option>
          {MAP_REGIONS.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
        </select>
        <div role="group" aria-label="Filter by status" style={{ display: "flex", gap: 4 }}>
          {(["all", "visited", "upcoming"] as Status[]).map((st) => (
            <button key={st} type="button" className="tj-btn" aria-pressed={status === st} onClick={() => setStatus(st)}>{st}</button>
          ))}
        </div>
        <button type="button" className="tj-btn" disabled={!currentId} onClick={() => { setQuery(""); setRegion(""); setStatus("all"); requestAnimationFrame(() => jumpToCurrent(true)); }}>
          Jump to Santa
        </button>
        <span className="tracker-meta text-xs" aria-live="polite" style={{ marginLeft: "auto" }}>
          {filtered.length} of {routeStops.length} · {visited.size} visited
        </span>
      </div>

      <div ref={listRef} className="tj-tl-list" tabIndex={0} role="list" aria-label="Santa's estimated journey timeline; scroll to see all stops" style={{ position: "relative" }}>
        {filtered.length === 0 && (
          <div className="tj-empty">
            No stops match that search.{" "}
            <button type="button" className="tj-btn" onClick={() => { setQuery(""); setRegion(""); setStatus("all"); }}>Clear filters</button>
          </div>
        )}
        {filtered.map(({ stop, n }) => {
          const isVisited = visited.has(stop.id);
          const isCurrent = stop.id === currentId;
          return (
            <div key={stop.id} role="listitem" data-current={isCurrent ? "true" : undefined} aria-current={isCurrent ? "location" : undefined} className={`tj-row ${isCurrent ? "tj-row-current" : ""}`}>
              <span className="tj-num">{n}</span>
              <div className="min-w-0" style={{ display: "flex" }}>
                <span className={`tj-flag ${isCurrent ? "tj-flag-current" : isVisited ? "tj-flag-visited" : ""}`}>{stop.flag}</span>
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${isCurrent ? "tracker-stop-current" : isVisited ? "tracker-stop-visited" : "tracker-stop-upcoming"}`}>
                    {stop.name} <span className="tracker-meta text-[10px] uppercase tracking-wider">· {stopRegion(stop)}</span>
                  </p>
                  <p className="tracker-copy text-xs leading-relaxed mt-1" data-santa-activity={stop.id}>{stop.activity}</p>
                  <p className="tracker-meta text-[10px] uppercase tracking-wider mt-1">
                    {formatStopArrival(stop, year)} · Representative clock: {formatStopOffset(stop, year)}
                  </p>
                </div>
              </div>
              <span className={`flex-shrink-0 text-[10px] rounded-full px-2 py-0.5 uppercase tracking-wider font-medium ${isCurrent ? "tracker-pill" : "tracker-meta"}`}>
                {isCurrent ? "Now" : isVisited ? "Visited" : "Upcoming"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
