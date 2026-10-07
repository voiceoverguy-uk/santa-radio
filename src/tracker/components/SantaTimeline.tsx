"use client";

import { useRef, useEffect } from "react";
import { santaStops } from "@/data/santaRouteStops";
import { getVisitedStops, getCurrentStopId } from "@/lib/santaRoute";

interface SantaTimelineProps {
  effectiveTime: Date;
}

export default function SantaTimeline({ effectiveTime }: SantaTimelineProps) {
  const visited = getVisitedStops(effectiveTime);
  const currentId = getCurrentStopId(effectiveTime);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const el = currentRef.current;
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const scrollLeft =
        elRect.left - containerRect.left + container.scrollLeft - containerRect.width / 2 + elRect.width / 2;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      container.scrollTo({ left: scrollLeft, behavior: reducedMotion ? "instant" : "smooth" });
    }
  }, [currentId]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="sm:hidden space-y-2">
        {santaStops.map((stop, i) => {
          const isVisited = visited.has(stop.id);
          const isCurrent = stop.id === currentId;

          return (
            <div key={stop.id} className="flex items-center gap-3">
              <div className="flex-shrink-0 relative">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 transition-all ${
                    isCurrent
                      ? "border-santa-gold bg-santa-gold/20 shadow-[0_0_12px_rgba(212,175,55,0.32)]"
                      : isVisited
                      ? "border-santa-red-light/70 bg-santa-red/20"
                      : "border-white/20 bg-white/5"
                  }`}
                >
                  {stop.flag}
                </div>
                {i < santaStops.length - 1 && (
                  <div
                    className={`absolute top-8 left-1/2 w-px h-4 -translate-x-1/2 ${
                      isVisited ? "bg-santa-red-light/60" : "bg-white/20"
                    }`}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                <div>
                  <p
                    className={`text-sm font-medium truncate ${
                      isCurrent ? "tracker-stop-current" : isVisited ? "tracker-stop-visited" : "tracker-stop-upcoming"
                    }`}
                  >
                    {stop.displayLabel}
                  </p>
                  <p className="tracker-meta text-[10px] uppercase tracking-wider">
                    UTC{stop.utcOffset >= 0 ? "+" : ""}{stop.utcOffset}
                  </p>
                </div>
                <span className={`flex-shrink-0 text-[10px] rounded-full px-2 py-0.5 uppercase tracking-wider font-medium ${
                  isCurrent
                    ? "tracker-pill"
                    : "text-gray-400"
                }`}>
                  {isCurrent ? "Now" : isVisited ? "Visited" : "Upcoming"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div
        ref={scrollRef}
        tabIndex={0}
        aria-label="Santa's estimated journey timeline; scroll horizontally to see all stops"
          className="hidden sm:block overflow-x-auto pb-4 scrollbar-thin"
        style={{ scrollbarColor: "rgba(212,175,55,0.45) transparent" }}
      >
        <div className="relative min-w-max px-8">
          <div className="tracker-timeline-line absolute top-5 left-8 right-8 h-px" />

          <div className="flex items-start">
            {santaStops.map((stop) => {
              const isVisited = visited.has(stop.id);
              const isCurrent = stop.id === currentId;

              return (
                <div
                  key={stop.id}
                  ref={isCurrent ? currentRef : undefined}
                  className="flex flex-col items-center flex-shrink-0"
                  style={{ width: "120px" }}
                >
                  <div
                    className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center text-base border-2 transition-all ${
                      isCurrent
                        ? "border-santa-gold bg-santa-gold/20 shadow-[0_0_16px_rgba(212,175,55,0.38)]"
                        : isVisited
                        ? "border-santa-red-light/70 bg-santa-red/20"
                        : "border-white/20 bg-white/5"
                    }`}
                  >
                    {stop.flag}
                  </div>

                  <div className="mt-3 text-center">
                    <p
                      className={`text-xs font-medium leading-tight ${
                        isCurrent ? "tracker-stop-current" : isVisited ? "tracker-stop-visited" : "tracker-stop-upcoming"
                      }`}
                    >
                      {stop.displayLabel}
                    </p>
                    <p className="tracker-meta text-[9px] mt-0.5">
                      UTC{stop.utcOffset >= 0 ? "+" : ""}{stop.utcOffset}
                    </p>
                    <span className={`inline-block mt-1 text-[9px] rounded-full px-1.5 py-0.5 uppercase tracking-wider font-medium ${
                      isCurrent
                        ? "tracker-pill"
                        : "text-gray-400"
                    }`}>
                      {isCurrent ? "Now" : isVisited ? "Visited" : "Upcoming"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
