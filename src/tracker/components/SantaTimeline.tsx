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
                      ? "border-santa-red bg-santa-red/20 shadow-[0_0_12px_rgba(156,6,11,0.4)]"
                      : isVisited
                      ? "border-santa-red/50 bg-santa-red/10"
                      : "border-white/20 bg-white/5"
                  }`}
                >
                  {stop.flag}
                </div>
                {i < santaStops.length - 1 && (
                  <div
                    className={`absolute top-8 left-1/2 w-px h-4 -translate-x-1/2 ${
                      isVisited ? "bg-santa-red/30" : "bg-white/10"
                    }`}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                <div>
                  <p
                    className={`text-sm font-medium truncate ${
                      isCurrent ? "text-white" : isVisited ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    {stop.displayLabel}
                  </p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                    UTC{stop.utcOffset >= 0 ? "+" : ""}{stop.utcOffset}
                  </p>
                </div>
                <span className={`flex-shrink-0 text-[10px] rounded-full px-2 py-0.5 uppercase tracking-wider font-medium ${
                  isCurrent
                    ? "bg-santa-red/20 text-santa-red-light border border-santa-red/30"
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
        style={{ scrollbarColor: "rgba(156,6,11,0.3) transparent" }}
      >
        <div className="relative min-w-max px-8">
          <div className="absolute top-5 left-8 right-8 h-px bg-white/10" />

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
                        ? "border-santa-red bg-santa-red/20 shadow-[0_0_16px_rgba(156,6,11,0.5)]"
                        : isVisited
                        ? "border-santa-red/50 bg-santa-red/10"
                        : "border-white/20 bg-white/5"
                    }`}
                  >
                    {stop.flag}
                  </div>

                  <div className="mt-3 text-center">
                    <p
                      className={`text-xs font-medium leading-tight ${
                        isCurrent ? "text-white" : isVisited ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      {stop.displayLabel}
                    </p>
                    <p className="text-[9px] text-gray-600 mt-0.5">
                      UTC{stop.utcOffset >= 0 ? "+" : ""}{stop.utcOffset}
                    </p>
                    <span className={`inline-block mt-1 text-[9px] rounded-full px-1.5 py-0.5 uppercase tracking-wider font-medium ${
                      isCurrent
                        ? "bg-santa-red/20 text-santa-red-light border border-santa-red/30"
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
