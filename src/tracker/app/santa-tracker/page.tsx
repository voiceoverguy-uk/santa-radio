import SantaTrackerClient from "@/components/SantaTrackerClient";
import { getTrackerMetadata } from "@/lib/trackerBrand";
import PageSeo from "../../../seo/PageSeo";
import { trackerMetadata, trackerQuestions } from "../../../seo/catalogue";
import "../../tracker.css";

export const generateMetadata = getTrackerMetadata;
export default function SantaTrackerPage() {
  return <main className="santa-tracker">
    <PageSeo metadata={trackerMetadata()} />
    <SantaTrackerClient heading={<>
      <h1 className="tracker-heading text-3xl sm:text-4xl lg:text-5xl tracking-tight">Track Santa’s Journey<br /><span className="tracker-heading-accent">Around the World</span></h1>
    </>} introCopy={<>
      <p className="tracker-copy mt-3 max-w-2xl mx-auto text-sm sm:text-base">Santa Radio’s Santa Tracker follows an estimated Christmas Eve journey around the world. The journey starts at 10:00 UTC on 24 December and ends at 10:00 UTC on 25 December.</p>
      <p className="tracker-copy mt-2 text-sm">The countdown is on until departure. Until then, it looks like Santa is touring the world on holiday. Keep up with the countdown, holiday postcards and festive facts. Keep checking back!</p>
    </>} />
    <section className="tracker-questions" aria-labelledby="tracker-questions-heading">
      <h2 id="tracker-questions-heading">Your Santa Tracker questions</h2>
      {trackerQuestions.map(([question, answer]) => <details key={question}>
        <summary>{question}</summary>
        <p>{answer}</p>
      </details>)}
      <p><a href="/christmas-music">Browse Christmas songs and lyrics</a>{' · '}<a href="/mugshots/all">Explore Santa Radio mug photographs</a></p>
    </section>
  </main>;
}
