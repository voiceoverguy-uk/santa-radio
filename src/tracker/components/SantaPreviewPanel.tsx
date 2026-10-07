"use client";

import { useState, useCallback, useId } from "react";
import { Play, Pause, SkipForward, RotateCcw, Eye, EyeOff } from "lucide-react";
import {
  type PreviewState,
  type JumpTarget,
  activatePreview,
  deactivatePreview,
  getRunFullJourneySpeed,
  getJumpTime,
  savePreviewState,
  JUMP_LABELS,
} from "@/lib/santaPreview";

interface SantaPreviewPanelProps {
  previewState: PreviewState;
  onPreviewChange: (state: PreviewState) => void;
  effectiveTime: Date;
}

export default function SantaPreviewPanel({
  previewState,
  onPreviewChange,
  effectiveTime,
}: SantaPreviewPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const controlsId = useId();

  const handleToggle = useCallback(() => {
    if (previewState.enabled) {
      onPreviewChange(deactivatePreview());
    } else {
      onPreviewChange(activatePreview("route-start", 1));
    }
  }, [previewState.enabled, onPreviewChange]);

  const handleJump = useCallback(
    (target: JumpTarget) => {
      const state = activatePreview(target, previewState.speedMultiplier);
      onPreviewChange(state);
    },
    [previewState.speedMultiplier, onPreviewChange]
  );

  const handleSpeedChange = useCallback(
    (speed: number) => {
      const newState: PreviewState = {
        ...previewState,
        speedMultiplier: speed,
        activatedAtRealMs: Date.now(),
        simulatedStartMs: effectiveTime.getTime(),
        jumpTarget: previewState.jumpTarget,
      };
      savePreviewState(newState);
      onPreviewChange(newState);
    },
    [previewState, effectiveTime, onPreviewChange]
  );

  const handleRunFullJourney = useCallback(
    (minutes: number) => {
      const speed = getRunFullJourneySpeed(minutes);
      const state: PreviewState = {
        enabled: true,
        activatedAtRealMs: Date.now(),
        simulatedStartMs: getJumpTime("route-start").getTime(),
        speedMultiplier: speed,
        jumpTarget: "route-start",
      };
      savePreviewState(state);
      onPreviewChange(state);
    },
    [onPreviewChange]
  );

  const handleReset = useCallback(() => {
    onPreviewChange(deactivatePreview());
  }, [onPreviewChange]);

  const simTime = effectiveTime.toISOString().replace("T", " ").substring(0, 19) + " UTC";

  const speeds = [1, 10, 60, 300];

  return (
    <div className="tracker-preview-panel fixed bottom-4 left-4 z-50 max-w-sm" aria-label="Development journey preview">
      <div className="tracker-preview-surface rounded-2xl border backdrop-blur-lg overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls={controlsId}
          className="tracker-preview-toggle w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            {previewState.enabled ? (
              <Eye size={14} className="text-santa-gold" />
            ) : (
              <EyeOff size={14} className="text-santa-cream/60" />
            )}
            <span className="tracker-preview-toggle text-xs font-medium uppercase tracking-wider">
              Preview Controls
            </span>
          </div>
          <span aria-hidden="true" className="text-santa-cream/70 text-xs">{expanded ? "▼" : "▲"}</span>
        </button>

        <div id={controlsId} hidden={!expanded} role="region" aria-label="Preview controls" className="px-4 pb-4 space-y-3 border-t border-santa-gold/20">
            <div className="flex items-center justify-between pt-3">
              <span className="tracker-meta text-xs">Preview Mode</span>
              <button
                onClick={handleToggle}
                role="switch"
                aria-label="Preview mode"
                aria-checked={previewState.enabled}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  previewState.enabled ? "bg-santa-red" : "bg-gray-600"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                    previewState.enabled ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {previewState.enabled && (
              <>
                <div className="tracker-preview-field rounded-lg px-3 py-2">
                  <p className="tracker-meta text-[10px] uppercase tracking-wider">
                    Simulated Time
                  </p>
                  <p className="text-xs text-white font-mono mt-0.5">{simTime}</p>
                </div>

                <div>
                  <p className="tracker-meta text-[10px] uppercase tracking-wider mb-1.5">
                    Speed
                  </p>
                  <div role="group" aria-label="Preview speed" className="flex gap-1.5">
                    {speeds.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSpeedChange(s)}
                        aria-pressed={previewState.speedMultiplier === s}
                        className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${
                          previewState.speedMultiplier === s
                          ? "tracker-preview-selected"
                          : "tracker-preview-control"
                        }`}
                      >
                        {s}×
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="tracker-meta text-[10px] uppercase tracking-wider mb-1.5">
                    Jump To
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {JUMP_LABELS.map(({ target, label }) => (
                      <button
                        key={target}
                        onClick={() => handleJump(target)}
                        className="tracker-preview-control text-[10px] px-2 py-1 rounded-md border transition-colors"
                      >
                        <SkipForward size={10} className="inline mr-1" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="tracker-meta text-[10px] uppercase tracking-wider mb-1.5">
                    Run Full Journey
                  </p>
                  <div className="flex gap-1.5">
                    {[2, 5, 10].map((m) => (
                      <button
                        key={m}
                        onClick={() => handleRunFullJourney(m)}
                        className="tracker-preview-control flex-1 text-xs py-1.5 rounded-lg border transition-colors"
                      >
                        <Play size={10} className="inline mr-1" />
                        {m}min
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleReset}
                  className="tracker-preview-control w-full text-xs py-2 rounded-lg border transition-colors flex items-center justify-center gap-1.5"
                >
                  <RotateCcw size={12} />
                  Reset to Real Time
                </button>
              </>
            )}
        </div>
      </div>
    </div>
  );
}
