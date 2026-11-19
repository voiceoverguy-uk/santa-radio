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
      <h1 className="tracker-heading text-3xl sm:text-4xl lg:text-5xl tracking-tight">Track Santa<br /><span className="tracker-heading-accent">All Year Round</span></h1>
    </>} introCopy={<>
      <p className="tracker-copy mt-3 max-w-2xl mx-auto text-sm sm:text-base">Follow Santa all year with our FREE interactive Santa Tracker. Discover his holiday adventures, route-research trips and North Pole preparations, then join the magic of Christmas Eve where you can follow Santa’s 290-stop Christmas Eve journey, from Kiritimati through cities around the world, Antarctic research stations and finishing in Honolulu, Hawaii.</p>
    </>} />
    <section className="tracker-questions" aria-labelledby="tracker-questions-heading">
      <h2 id="tracker-questions-heading">How to track Santa all year</h2>
      {trackerQuestions.map(([question, answer]) => <details key={question}>
        <summary>{question}</summary>
        <p>{answer}</p>
      </details>)}
      <p><a href="/free-santa-message">Create a free personalised Santa message</a>{' · '}<a href="/apps">Explore Santa Radio apps</a>{' · '}<a href="/christmas-music">Browse Christmas songs and lyrics</a>{' · '}<a href="/mugshots/all">Explore Santa Radio mug photographs</a></p>
    </section>
  </main>;
}
