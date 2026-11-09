import { Helmet } from "react-helmet-async";
import SantaTrackerClient from "../../components/SantaTrackerClient";
import "../../tracker.css";

export default function SantaTrackerStreamPage() {
  return <main className="santa-tracker tracker-capture" aria-label="Santa Tracker capture map">
    <Helmet>
      <title>Santa Tracker Map | Santa Radio</title>
      <meta name="robots" content="noindex, follow" />
      <meta name="description" content="Santa Radio’s live-updating estimated Santa Tracker map for streaming capture." />
    </Helmet>
    <SantaTrackerClient mapOnly />
  </main>;
}
