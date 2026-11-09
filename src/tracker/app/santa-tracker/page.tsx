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
      <p className="tracker-copy mt-3 max-w-2xl mx-auto text-sm sm:text-base">Follow Santa’s estimated 290-stop Christmas Eve journey, from Kiritimati through cities around the world and Antarctic research stations, finishing in Honolulu, Hawaii. The journey runs from 10:00 UTC on 24 December to 11:20 UTC on 25 December.</p>
      <p className="tracker-copy mt-2 text-xs">A make-believe itinerary using real destination coordinates and Christmas-time local clocks—not verified live tracking. Browse every region now, or follow Santa automatically during the journey.</p>
      <p className="tracker-copy mt-2 text-sm">The countdown is on until departure. Keep up with Santa’s seasonal travels, route preparations and festive facts. Keep checking back!</p>
    </>} />
    <section className="tracker-questions" aria-labelledby="tracker-questions-heading">
      <h2 id="tracker-questions-heading">Your Santa Tracker questions</h2>
      <p>Using The Santa Tracker by Santa Radio on iOS? Read the <a href="/privacy-policy#santa-tracker-ios-privacy">native iOS app privacy policy</a> within our main privacy policy.</p>
      {trackerQuestions.map(([question, answer]) => <details key={question}>
        <summary>{question}</summary>
        <p>{answer}</p>
      </details>)}
      <p><a href="/christmas-music">Browse Christmas songs and lyrics</a>{' · '}<a href="/mugshots/all">Explore Santa Radio mug photographs</a></p>
    </section>
  </main>;
}
