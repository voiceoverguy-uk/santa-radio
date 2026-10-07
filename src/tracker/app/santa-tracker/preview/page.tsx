import { Helmet } from "react-helmet-async";
import SantaTrackerClient from "@/components/SantaTrackerClient";
import "../../../tracker.css";

export const metadata = { robots: { index: false, follow: true } };

export default function SantaTrackerPreviewPage() {
  return (
    <main className="santa-tracker">
      <Helmet>
        <title>Development Preview | Santa Tracker — Santa Radio</title>
        <meta name="robots" content="noindex, follow" />
        <meta name="description" content="Development-only Santa Tracker time-jump controls. Simulated dates do not affect the visitor tracker." />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600&display=swap" />
      </Helmet>
      <SantaTrackerClient showPreview />
    </main>
  );
}
