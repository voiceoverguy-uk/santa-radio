"use client";

import { useState, useEffect, useCallback, Suspense, type ReactNode } from "react";
import { getDashboardData, isHolidaySeason, isChristmasInJuly, getRandomHoliday, type HolidayDestination } from "@/lib/santaRoute";
import { santaStops } from "@/data/santaRouteStops";
import { additionalChristmasFacts } from "@/data/christmasFacts";
import {
  type PreviewState,
  getEffectiveTime,
  loadPreviewState,
  getDefaultPreviewState,
} from "@/lib/santaPreview";
import SantaMap from "./SantaMap";
import SantaStats from "./SantaStats";
import SantaStory from "./SantaStory";
import SantaTimeline from "./SantaTimeline";
import SantaPreviewPanel from "./SantaPreviewPanel";

const funFacts = [
  "In Iceland, 13 Yule Lads visit children on the 13 nights before Christmas, each leaving a gift in shoes left on windowsills.",
  "A Ukrainian Christmas folktale inspires spider-web tree ornaments, which some families use as symbols of good luck.",
  "A Norwegian Christmas Eve folk belief tells of hiding brooms so witches cannot take them for a ride.",
  "Roller-skating to early Christmas services is a festive tradition associated with Caracas in Venezuela.",
  "In Catalonia, some families keep a Tió de Nadal, a decorated log that is playfully encouraged to produce small gifts.",
  "In Japan, a Christmas fried-chicken meal has become a popular seasonal custom, with some orders placed well in advance.",
  "In the Czech Republic, single women throw a shoe over their shoulder on Christmas Eve. If it lands pointing toward the door, they'll marry within the year.",
  "Australians often celebrate Christmas with a BBQ on the beach, and Santa sometimes arrives by surfboard!",
  "In Finland, families visit saunas on Christmas Eve before the celebrations begin, a tradition dating back centuries.",
  "Traditional Greenlandic festive foods can include mattak, whale skin with blubber, and kiviak, a fermented bird dish; customs vary between communities.",
  ...additionalChristmasFacts,
];

interface SantaTrackerProps {
  showPreview?: boolean;
  heading?: ReactNode;
  introCopy?: ReactNode;
}

function TrackerHero({ children }: { children: ReactNode }) {
  return (
    <section className="tracker-hero relative overflow-hidden pt-24 pb-16 sm:pt-32 sm:pb-20">
      <div className="absolute inset-0 star-field" />
      <div className="tracker-hero-wash absolute inset-0" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 text-center">
        {children}
      </div>
    </section>
  );
}

function SantaTrackerInner({ showPreview = false, heading, introCopy }: SantaTrackerProps) {

  const [previewState, setPreviewState] = useState<PreviewState>(getDefaultPreviewState);
  const [effectiveTime, setEffectiveTime] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);
  const [currentFactIndex, setCurrentFactIndex] = useState(0);
  const [holiday, setHoliday] = useState<HolidayDestination | null>(null);
  const holidaySeason = effectiveTime !== null && isHolidaySeason(effectiveTime);

  useEffect(() => {
    setMounted(true);
    const initialPreview = showPreview ? loadPreviewState() : getDefaultPreviewState();
    setPreviewState(initialPreview);
    setEffectiveTime(showPreview ? getEffectiveTime(initialPreview) : new Date());
  }, [showPreview]);

  useEffect(() => {
    if (!effectiveTime) return;
    setHoliday(holidaySeason ? getRandomHoliday() : null);
  }, [holidaySeason]);

  useEffect(() => {
    const interval = setInterval(() => {
      setEffectiveTime(showPreview ? getEffectiveTime(previewState) : new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, [previewState, showPreview]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFactIndex((prev) => (prev + 1) % funFacts.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const handlePreviewChange = useCallback((state: PreviewState) => {
    setPreviewState(state);
    setEffectiveTime(getEffectiveTime(state));
  }, []);

  if (!mounted || !effectiveTime) {
    return <TrackerSkeleton heading={heading} introCopy={introCopy} />;
  }

  const data = getDashboardData(effectiveTime);
  const isLive = data.mode === "LIVE";
  const isComplete = data.mode === "COMPLETE";
   const onHoliday = data.mode === "OFF_SEASON" && holidaySeason && holiday !== null;
  const inJuly = data.mode === "OFF_SEASON" && isChristmasInJuly(effectiveTime);
  const showStatusMessage = !heading || isLive || isComplete || Boolean(onHoliday && holiday);

  if (onHoliday && holiday) {
    data.holiday = holiday;
    data.statusHeadline = inJuly
      ? `🎄 Celebrating Christmas in July in ${holiday.name}`
      : `🏖️ Santa is on holiday in ${holiday.name}`;
    data.statusSubtext = holiday.activity;
    data.currentStopName = holiday.name;
    data.currentStopFlag = inJuly ? "🎄" : "🏖️";
    data.currentStopRegion = holiday.country;
    const x = ((holiday.lng + 180) / 360) * 100;
    const y = ((90 - holiday.lat) / 180) * 100;
    data.mapPosition = { lat: holiday.lat, lng: holiday.lng, x, y };
  }

  const statusColor =
    isLive
      ? "bg-green-500"
      : isComplete
      ? "bg-santa-gold"
      : data.mode === "PREPARING"
      ? "bg-santa-gold"
      : onHoliday && inJuly
      ? "bg-green-500"
      : onHoliday
      ? "bg-santa-gold"
      : "bg-green-500";

  const statusLabel =
    isLive
      ? "Delivering Now"
      : isComplete
      ? "Journey Complete"
      : data.mode === "PREPARING"
      ? "Preparing for Takeoff"
      : onHoliday && inJuly && holiday
      ? `🎄 Christmas in July — ${holiday.name}`
      : onHoliday && holiday
      ? `🏖️ On Holiday in ${holiday.name}`
      : "At the North Pole";

  const statusMessage = showStatusMessage && <p className="tracker-copy tracker-status-message mt-4 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
    {isLive || isComplete
      ? data.statusSubtext
      : onHoliday && inJuly && holiday
      ? `It's Christmas in July! Santa's celebrating mid-year festivities while ${holiday.activity.charAt(0).toLowerCase()}${holiday.activity.slice(1)}. Festive fun doesn't stop just because it's summer!`
      : onHoliday && holiday
      ? `Santa's taking a well-earned break! He's currently ${holiday.activity.charAt(0).toLowerCase()}${holiday.activity.slice(1)}. He'll be back at the North Pole on 1 December.`
      : "Follow Santa as Christmas Eve midnight sweeps across the globe. From the Pacific Islands to American Samoa, watch his estimated journey unfold in real time."}
  </p>;

  return (
    <div className="tracker-shell min-h-screen text-white">
      {showPreview && previewState.enabled && (
        <div className="bg-santa-gold/10 border-b border-santa-gold/20 px-4 py-2 text-center mt-16 sm:mt-20">
          <span className="text-xs text-santa-gold font-medium uppercase tracking-wider">
            Preview Mode Active: Simulated Christmas Eve
          </span>
        </div>
      )}

      <TrackerHero>
          {heading ?? <h1 className="tracker-heading text-3xl sm:text-4xl lg:text-5xl tracking-tight">
            Track Santa&apos;s Journey
            <br />
            <span className="tracker-heading-accent">Around the World</span>
          </h1>}

          <div className="mt-8 w-full">
            <SantaMap effectiveTime={effectiveTime} mapPosition={data.mapPosition} onHoliday={onHoliday} />
          </div>

          <div className="tracker-status inline-flex items-center gap-2 rounded-full px-4 py-1.5 mt-3 mb-6">
            <span className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`} />
            <span className="text-xs font-medium uppercase tracking-wider">
              {statusLabel}
            </span>
          </div>

          {onHoliday && statusMessage}

          {onHoliday && introCopy && showStatusMessage && (
            <div className="tracker-copy-divider" aria-hidden="true">
              <span className="tracker-copy-divider-flourish" />
            </div>
          )}

          {introCopy}

          {introCopy && showStatusMessage && (
            <div className="tracker-copy-divider" aria-hidden="true">
              <span className="tracker-copy-divider-flourish" />
            </div>
          )}

          {!onHoliday && statusMessage}

          {!isLive && !isComplete && (
            <div className="mt-8">
              <p className="tracker-countdown-label text-xs uppercase tracking-widest mb-3">
                Countdown to Santa&apos;s Departure
              </p>
              <div className="tracker-countdown-grid inline-flex items-center gap-3 sm:gap-4">
                {[
                  { label: "Days", value: data.countdownToChristmasEve.days },
                  { label: "Hours", value: data.countdownToChristmasEve.hours },
                  { label: "Mins", value: data.countdownToChristmasEve.minutes },
                  { label: "Secs", value: data.countdownToChristmasEve.seconds },
                ].map((unit, i, arr) => (
                  <div key={unit.label} className="tracker-countdown-cell flex items-center gap-3 sm:gap-4">
                    <div className="tracker-countdown-unit text-center">
                      <div className="tracker-countdown-value text-2xl sm:text-3xl tabular-nums">
                        {String(unit.value).padStart(2, "0")}
                      </div>
                      <div className="tracker-countdown-label text-[10px] uppercase tracking-wider mt-0.5">
                        {unit.label}
                      </div>
                    </div>
                    {i < arr.length - 1 && (
                      <span className="tracker-countdown-separator text-xl text-santa-gold/70 font-light">:</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(isLive || isComplete) && (
            <div className="tracker-card mt-6 inline-flex items-center gap-4 rounded-xl px-6 py-3">
              <div className="text-center">
                <div className="tracker-progress-value text-2xl tabular-nums">
                  {data.progressPercent.toFixed(1)}%
                </div>
                <div className="tracker-countdown-label text-[10px] uppercase tracking-wider">
                  Journey Progress
                </div>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <div className="text-2xl font-bold text-santa-gold tabular-nums">
                  {data.visitedCount}/{santaStops.length}
                </div>
                <div className="tracker-countdown-label text-[10px] uppercase tracking-wider">
                  Regions Visited
                </div>
              </div>
            </div>
          )}
      </TrackerHero>

      <section className="px-4 sm:px-6 pb-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="tracker-section-title text-lg sm:text-xl mb-4">
              Updating Estimated Dashboard
          </h2>
          <SantaStats effectiveTime={effectiveTime} holiday={onHoliday ? holiday : undefined} />
        </div>
      </section>

      <section className="px-4 sm:px-6 pb-12">
        <div className="max-w-6xl mx-auto">
          <SantaStory effectiveTime={effectiveTime} holiday={onHoliday ? holiday : undefined} />
        </div>
      </section>

      <section className="px-4 sm:px-6 pb-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="tracker-section-title text-lg sm:text-xl mb-2 text-center">
            Santa&apos;s Estimated Journey Timeline
          </h2>
          <p className="tracker-copy text-center text-xs mb-6">
            60 estimated stops across 37 Christmas UTC offsets, from the Pacific Islands to American Samoa. Times use local midnight at a representative place, not every year-round time zone. Santa&apos;s activities are make-believe.
          </p>
          <SantaTimeline effectiveTime={effectiveTime} />
        </div>
      </section>

      <section className="px-4 sm:px-6 pb-12">
        <div className="max-w-3xl mx-auto">
          <h2 className="tracker-section-title text-lg sm:text-xl mb-4 text-center">
            Christmas Around the World
          </h2>
          <div className="tracker-story-card relative p-6 min-h-[80px]">
            <span className="text-santa-gold text-2xl mr-2">🎄</span>
            <p className="inline tracker-copy text-sm leading-relaxed">
              {funFacts[currentFactIndex]}
            </p>
          </div>
        </div>
      </section>

      {showPreview && (
        <SantaPreviewPanel
          previewState={previewState}
          onPreviewChange={handlePreviewChange}
          effectiveTime={effectiveTime}
        />
      )}
    </div>
  );
}

function TrackerSkeleton({ heading, introCopy }: Pick<SantaTrackerProps, "heading" | "introCopy">) {
  if (heading) {
    return (
      <div className="tracker-shell min-h-screen text-white">
        <TrackerHero>
          {/* Reserve the existing status badge's space without inventing a status. */}
          <div aria-hidden="true" className="h-8 mb-6" />
          {heading}
          {introCopy}
          <div role="status" className="tracker-meta mt-8 text-sm">
            Loading Santa Tracker...
          </div>
        </TrackerHero>
      </div>
    );
  }
  return (
    <div className="tracker-shell min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">🎅</div>
        <div className="tracker-meta text-sm">Loading Santa Tracker...</div>
      </div>
    </div>
  );
}

export default function SantaTrackerClient({ showPreview = false, heading, introCopy }: SantaTrackerProps) {
  return (
    <Suspense fallback={<TrackerSkeleton heading={heading} introCopy={introCopy} />}>
      <SantaTrackerInner showPreview={showPreview} heading={heading} introCopy={introCopy} />
    </Suspense>
  );
}
