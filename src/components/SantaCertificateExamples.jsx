import { useEffect, useRef, useState } from "react";
import { certificateExamples as certificates, allCertificateExamples } from "../lib/santaCertificateExamples.js";
import "./SantaCertificateExamples.css";

function prefersReducedMotion() {
  return typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function SantaCertificateExamples({ activeExampleName = null }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previewButtonRef = useRef(null);

  const activeCertificate = allCertificateExamples.find(item => item.name === activeExampleName);
  const selectedCertificate = activeCertificate || certificates[selectedIndex];

  useEffect(() => {
    const index = certificates.findIndex(item => item.name === activeExampleName);
    if (index >= 0) setSelectedIndex(index);
  }, [activeExampleName]);

  useEffect(() => {
    if (activeExampleName || reducedMotion || hovered || focused || enlarged) return undefined;
    const timer = window.setInterval(() => {
      setSelectedIndex((index) => (index + 1) % certificates.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [activeExampleName, reducedMotion, hovered, focused, enlarged]);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const restoreFocus = () => {
      setEnlarged(false);
      previewButtonRef.current?.focus({ preventScroll: true });
    };
    dialog.addEventListener("close", restoreFocus);
    return () => dialog.removeEventListener("close", restoreFocus);
  }, []);

  const openDialog = () => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    setZoomed(false);
    dialog.showModal();
    setEnlarged(true);
    closeButtonRef.current?.focus();
  };

  const closeDialog = () => {
    if (dialogRef.current?.open) dialogRef.current.close();
  };

  return (
    <section
      className="santa-certificate-examples"
      aria-labelledby="santa-certificate-examples-title"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false);
        }
      }}
    >
      <div className="santa-certificate-examples__heading">
        <h3 id="santa-certificate-examples-title">FREE Certificate examples</h3>
      </div>

      <div className="santa-certificate-examples__stage">
        <button
          ref={previewButtonRef}
          className="santa-certificate-examples__preview"
          type="button"
          onClick={openDialog}
          aria-label={`Open ${selectedCertificate.name}'s certificate example`}
          aria-haspopup="dialog"
        >
          <img
            src={selectedCertificate.src}
            alt={selectedCertificate.alt}
            className="santa-certificate-examples__image"
          />
          <span className="santa-certificate-examples__zoom-hint">View full certificate</span>
        </button>
      </div>

      <dialog
        ref={dialogRef}
        className="santa-certificate-dialog"
        aria-label={`${selectedCertificate.name}'s certificate example`}
        onKeyDown={event => {
          if (event.key === "Tab") {
            const controls = [...dialogRef.current.querySelectorAll('button, [tabindex="0"]')];
            const first = controls[0], last = controls.at(-1);
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current) closeDialog();
        }}
      >
        <div className="santa-certificate-dialog__content">
          <div className="santa-certificate-dialog__top">
            <p>{selectedCertificate.name}’s certificate</p>
            <button
              type="button"
              className="santa-certificate-dialog__close"
              aria-pressed={zoomed}
              onClick={() => setZoomed(value => !value)}
            >{zoomed ? "Fit full certificate" : "Zoom in to read"}</button>
            <button
              ref={closeButtonRef}
              className="santa-certificate-dialog__close"
              type="button"
              onClick={closeDialog}
              aria-label="Close certificate preview"
            >
              Close
            </button>
          </div>
          <div className={`santa-certificate-dialog__artwork${zoomed ? " is-zoomed" : ""}`}
            tabIndex={zoomed ? 0 : undefined}
            role="region" aria-label="Certificate artwork">
          <img
            src={selectedCertificate.src}
            alt={selectedCertificate.alt}
            className="santa-certificate-dialog__image"
          />
          </div>
          {zoomed && <p className="santa-certificate-dialog__help">Scroll across and down to read the full certificate. Choose “Fit full certificate” to see all the artwork together.</p>}
        </div>
      </dialog>
    </section>
  );
}
