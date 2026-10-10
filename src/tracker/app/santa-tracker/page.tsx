import SantaTrackerClient from "@/components/SantaTrackerClient";
import { getTrackerMetadata } from "@/lib/trackerBrand";
import PageSeo from "../../../seo/PageSeo";
import Breadcrumbs from "../../../seo/Breadcrumbs";
import { trackerMetadata, trackerQuestions } from "../../../seo/catalogue";
import "../../tracker.css";

export const generateMetadata = getTrackerMetadata;
export default function SantaTrackerPage() {
  return <main className="santa-tracker">
    <PageSeo metadata={trackerMetadata()} />
    <SantaTrackerClient introduction={<>
      <Breadcrumbs items={[['Home', '/'], ['Santa Tracker', '/santa-tracker']]} />
      <h1 className="tracker-heading text-3xl sm:text-4xl lg:text-5xl tracking-tight">Track Santa’s Journey<br /><span className="tracker-heading-accent">Around the World</span></h1>
      <p className="tracker-copy mt-3 max-w-2xl mx-auto text-sm sm:text-base">Santa Radio’s Santa Tracker follows an estimated Christmas Eve journey around the world. The journey starts at 10:00 UTC on 24 December and ends at 10:00 UTC on 25 December.</p>
      <p className="tracker-copy mt-2 text-sm">The countdown is to departure. Until then, enjoy North Pole preparations, holiday postcards and festive facts. The map, route and dashboard figures are playful estimates, not real GPS tracking.</p>
    </>} />
    <section className="tracker-questions" aria-labelledby="tracker-questions-heading">
      <h2 id="tracker-questions-heading">Your Santa Tracker questions</h2>
      {trackerQuestions.map(([question, answer]) => <div key={question}><h3>{question}</h3><p>{answer}</p></div>)}
      <p><a href="/christmas-music">Browse Christmas songs and lyrics</a>{' · '}<a href="/mugshots/all">Explore Santa Radio mug photographs</a></p>
    </section>
  </main>;
}
