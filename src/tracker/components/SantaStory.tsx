"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getDeliveryPostcards } from "../lib/deliveryPostcards";
import seasonalPostcards from "../data/seasonalPostcards.json";
import { getPostcardSeason } from "../lib/postcardSeason";
import { Share2 } from "lucide-react";
import { TRACKER_URL } from "@/lib/trackerBrand";
import { getDashboardData, getRouteResearchCopy, isChristmasInJuly, type HolidayDestination } from "@/lib/santaRoute";

interface SantaStoryProps {
  effectiveTime: Date;
  holiday?: HolidayDestination | null;
  routeResearch?: boolean;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDateContext(now: Date) {
  const month = MONTHS[now.getUTCMonth()];
  const year = now.getUTCFullYear();
  const christmas = new Date(Date.UTC(year, 11, 25));
  if (now > christmas) {
    christmas.setUTCFullYear(year + 1);
  }
  const daysUntilChristmas = Math.ceil((christmas.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const dayOfWeek = now.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
  return { month, year, daysUntilChristmas, dayOfWeek };
}

type PostcardEntry = string | ((ctx: ReturnType<typeof getDateContext>) => string);

const holidayPostcardEntries: PostcardEntry[] = [
  "I packed a travel iron. Mrs Claus says the beard is supposed to look like that.",
  "My suitcase has four wheels. The elves have fitted it with sleigh bells anyway.",
  "I bought a luggage tag saying 'Not presents'. Everyone keeps checking.",
  "I asked for a quiet room. They put me next to a man learning the recorder.",
  "My sun hat has a pompom. Apparently I have a very narrow personal style.",
  "The hotel towel became a cape. I was only testing the sea breeze.",
  "I brought a travel board game. Rudolph ate the instructions and declared himself winner.",
  "I tried to travel incognito. The suitcase labelled SANTA was a mistake.",
  "I'm officially on holiday. The elves have been told not to call me unless it's an emergency.",
  "My out-of-office is on. Auto-reply: Ho Ho Ho, I'm on holiday!",
  "The elves have started a group chat without me. It's mostly memes about my driving.",
  "I told Mrs Claus I was doing 'gift research.' She's not buying it. Literally.",
  "I've sent the reindeer to a spa. Rudolph's getting his nose polished.",
  "I promised no work talk on holiday. I've already mentioned chimneys four times today.",
  "Mrs Claus finally got me out of the workshop. I lasted 12 minutes before checking my list.",
  "I tried to pack light. I still brought three spare hats and a backup beard.",
  "The toy-testing department is running unsupervised. I'm trying not to think about it.",
  "I've been spotted trying to use a self-checkout. It did not go well.",
  "I said I'd only check my naughty list once a week. It's been three weeks.",
  "Workshop's closed for summer. I've told the elves to learn a new hobby. They chose parkour.",
  "I tried sunbathing today. The hat stays on. Non-negotiable.",
  "Just had an ice cream. Nobody recognised me without the suit. Very peaceful.",
  "I've been asked to keep the Ho Ho Ho-ing down at the hotel pool. Apparently it echoes.",
  "Tried to order a mince pie at a café. Got a very confused look.",
  "Mrs Claus says I need to stop rating every chimney I walk past. She's probably right.",
  "The elves sent me a selfie from the workshop. They've rearranged everything. I'm furious.",
  "I attempted a holiday lie-in. Woke up at 4am out of habit. Old habits die hard.",
  "I've started a holiday journal. Day one: 'Thought about lists. Must stop.'",
  "Bought a Hawaiian shirt. Mrs Claus says I look ridiculous. She took a photo anyway.",
  (ctx) => `I accidentally said 'Merry Christmas' to a waiter. It's ${ctx.month}. He looked concerned.`,
  "Found a chimney on the hotel and had to resist the urge. Very proud of myself.",
  "The beard gets a lot of attention in warm weather. I've started a trend, apparently.",
  "I've been reading reviews of chimneys online. Mrs Claus has confiscated my phone.",
  "Rudolph keeps sending me postcards. He can't write, so they're just hoof prints.",
  "I suggested we visit a toy shop. Mrs Claus said absolutely not. We went to the beach instead.",
  "I tried paddleboarding. The belly makes balance tricky. Very entertaining for onlookers.",
  "The elves FaceTimed me. The workshop looks fine. Suspiciously fine.",
  "I've been leaving out milk and biscuits before bed. Old habits.",
  "Had a go at karaoke last night. Apparently 'Jingle Bells' isn't a summer hit. Their loss.",
  "I asked the hotel concierge about local chimney architecture. He thought I was joking.",
  "Mrs Claus has hidden my list. She says it's for my own good. I found it in twenty minutes.",
  "I tried to explain my job to someone at the bar. They thought I was a method actor.",
  "The reindeer sent a postcard. They've formed a book club. I wasn't invited.",
  "I wore flip-flops today. I can confirm that boots are superior in every way.",
  "I've been practising my 'surprised face' for Christmas morning. Mrs Claus gives it a 6 out of 10.",
  "Someone at the resort asked what I do for a living. I said 'logistics.' Not technically wrong.",
  "I tried a local delicacy today. I miss mince pies. I really miss mince pies.",
  "The elves have started a podcast. It's called 'Sleigh What?' I haven't listened yet.",
  "I've been doing laps of the pool. Mostly floating, if I'm honest.",
  "Mrs Claus caught me looking at sleigh upgrades online. I told her it was for next year. It is.",
  "Had a dream about wrapping paper last night. Time to switch to decaf.",
  "I tried snorkelling. The beard was a problem. A big, soggy problem.",
  "Just discovered they make Christmas films set on beaches. I feel seen.",
  "The hotel gave me a loyalty card. I've been here three days and I'm already gold status.",
  "I keep humming Christmas songs under my breath. The couple next to me have moved tables.",
  "Saw a red coat in a shop window. Bought it immediately. Mrs Claus sighed.",
  "I built a sandcastle today. It looked suspiciously like the North Pole. I can't help it.",
  "The elves texted to say everything's under control. That sentence has never been true.",
  (ctx) => `${ctx.daysUntilChristmas} days until Christmas. I counted. Then I counted again. Mrs Claus told me to stop counting.`,
  (ctx) => `Woke up this ${ctx.dayOfWeek} and forgot I was on holiday. Got halfway into the suit before Mrs Claus stopped me.`,
  (ctx) => `Someone asked me what month it is. I said '${ctx.month}.' They said 'yes, so why are you wearing a Santa hat?' Fair point.`,
  (ctx) => `Only ${ctx.daysUntilChristmas} days to go. I'm not panicking. I am slightly panicking.`,
  (ctx) => `Dear diary: it's ${ctx.month} ${ctx.year}. I have not mentioned Christmas once today. Update: I just did.`,
  (ctx) => `An elf rang to say there's ${ctx.daysUntilChristmas} days left and they haven't started the bikes yet. I need a moment.`,
  (ctx) => `It's ${ctx.dayOfWeek}. Perfect day for not thinking about work. I lasted until breakfast.`,
  "I accidentally wore my work boots to the beach. Left big Santa prints in the sand. A child followed them for twenty minutes.",
  "A seagull stole my sandwich. I put it on the naughty list. Non-negotiable.",
  "I tried mini golf. Hit the ball into a water feature. Blamed the wind. There was no wind.",
  "Mrs Claus has started reading a mystery novel. She says it's more suspenseful than my route planning. Harsh but fair.",
  "I found a cat at the hotel. It sat on my lap for an hour. Best meeting I've had all year.",
  "Tried to do a jigsaw puzzle. All the pieces are sky. I've been at it since Tuesday.",
  "I overheard someone say they don't like mince pies. I had to sit down for a moment.",
  "The hotel has a quiz night. I entered under a false name. Won the Christmas round. Nobody was surprised.",
  "I attempted to make a cocktail. It tasted like tinsel smells. Mrs Claus poured it into a plant pot.",
  "A man at the pool is wearing the exact same swimming trunks as me. We've been avoiding eye contact all day.",
  "Tried to send a postcard to the elves. Realised the North Pole doesn't have a postcode. That's actually a problem I should sort out.",
  "I fell asleep in a hammock. Woke up an hour later completely tangled. The hotel staff had to assist.",
  (ctx) => `I wrote '${ctx.month}' on a postcard and then stared at it for a while. Doesn't feel like a real month when you live at the North Pole.`,
];

const christmasInJulyPostcards = [
  "July rehearsal: I wrapped my sunglasses. Now I need Mrs Claus to help find them.",
  "I hung a bauble on the parasol. The parasol has requested a dressing-room mirror.",
  "My July snow globe contains sand. It settles very quickly. Excellent visibility.",
  "I put a paper crown on my sun hat. Mrs Claus says one hat was already plenty.",
  "Christmas in July tea break: iced cocoa and a biscuit wearing factor 50.",
  "I wrapped the picnic basket for July Christmas. Lunch now requires scissors.",
  "Our mid-year cracker contained a tiny compass. It points directly at the buffet.",
  "I asked for festive ice cubes. The waiter said ordinary ones also melt in July.",
  "It's Christmas in July and I've put the full suit on. Mrs Claus says I'm mad. She's right.",
  "Happy Christmas in July! I've convinced the hotel to play carols by the pool. Mixed reviews.",
  "Christmas in July means I can eat mince pies guilt-free. I brought a suitcase full.",
  "The elves demanded a mid-year Christmas party. The workshop is covered in tinsel again.",
  "I've hung stockings on the sun loungers. The other guests are intrigued.",
  "Christmas in July is the one time of year I feel truly understood on holiday.",
  "I decorated a palm tree with baubles. The hotel manager came to have a word.",
  "Mrs Claus got me a 'Christmas in July' jumper. It's 30 degrees. I'm wearing it.",
  "Rudolph sent a video of the reindeer doing a mid-year carol. It was mostly snorting.",
  "I set up a pop-up grotto by the pool bar. Queue of one so far. It was Mrs Claus.",
  "Mid-year stocktake at the workshop today. The elves say they're 'on track.' I have doubts.",
  "I've been handing out candy canes at the beach. Some people are delighted. Others less so.",
  "Christmas in July! I baked a turkey in the hotel kitchenette. The smoke alarm disagreed.",
  "I made a Christmas playlist for the beach. 'Last Christmas' hits different by the sea.",
  "The elves sent a banner that says 'Merry Half-Christmas.' It's hanging in reception.",
  "Crackers on the patio tonight. I brought my own. The jokes are still terrible. Perfect.",
  "Mrs Claus and I exchanged silly mid-year gifts. She got me new chimney gloves. Romantic.",
  "I wrapped a coconut and gave it to Mrs Claus. She said it was the most pointless gift ever. I was thrilled.",
  "I carved a snowman out of sand. He lasted about eight minutes. Rest in peace, Sandy.",
  "I wore a Santa hat to breakfast. A child recognised me immediately. Cover blown. Worth it.",
  "Had a Christmas in July dinner — roast with all the trimmings, 35 degrees outside. No regrets.",
  "I tried to build an igloo out of ice cubes. Ambitious. The waiter brought me a bucket.",
  "Halfway through the year, halfway through my list. Right on schedule. Mostly.",
  "Christmas in July is basically a rehearsal. I'm treating it very seriously. Mrs Claus is not.",
  "The elves are celebrating too. They've made a Yule log out of a pool noodle. Creative lot.",
  "I insisted on pulling crackers at lunch. The family at the next table asked to join in.",
  "Put fairy lights on the balcony. Mrs Claus admitted it looked quite nice. Victory.",
  "Christmas in July fact: in Australia, July IS winter, so it's actually proper festive weather there.",
  "I've started a petition for a second Christmas Day. One signature so far. It's mine.",
  "A child asked me today if Santa takes holiday. I said even magic needs a recharge.",
  "I spotted someone else wearing a Santa hat at the resort. We nodded. An unspoken bond.",
  "I've been leaving mince pies out for myself. The tradition doesn't stop just because it's July.",
  "Christmas in July countdown: only 153 days until the real thing. Not that I'm counting.",
  "I tried to go down a waterslide. The belly made it faster than expected. New record.",
  "Mrs Claus made mulled wine with ice. She calls it a 'summer warmer.' It's actually quite good.",
  "The reindeer are jealous of Christmas in July. They want a 'Reindeer Games in July' too.",
  "I wrote Christmas cards on the beach. Sand got in the envelopes. Adds character.",
  "Spent the morning watching Christmas films in my swim shorts. Peak holiday behaviour.",
  "A couple asked to take a selfie with me by the pool. I gave them my best Ho Ho Ho.",
  "I brought a mini Christmas tree for the hotel room. It's 15cm tall and absolutely perfect.",
  "The hotel is now playing 'Jingle Bells' on request. I may have tipped the DJ generously.",
  "Christmas in July means the workshop gets a deep clean. The elves found things behind the shelves. I don't want to know what.",
  "I made a 'Nice List — July Edition.' Currently only Mrs Claus and the hotel cat qualify.",
  "I attempted to roast chestnuts on a barbecue. Technically it worked. Technically.",
  "Just found a Christmas shop open in July. Spent an embarrassing amount of time in there.",
  "I suggested a Christmas in July toast at dinner. Everyone raised a glass. Festive spirit is alive.",
  "Mrs Claus caught me rehearsing 'the laugh' in the bathroom mirror. She said it needs work.",
  "The mid-year magic check came back positive. All systems go for December.",
  "I've been rating hotel chimneys again. This one gets a solid 7. Good flue. Nice brickwork.",
  "Christmas in July is nearly over. Back to regular holiday mode tomorrow. It's been magical.",
];

function SantaPostcard({ message, holiday, caption }: { message: string; holiday: Pick<HolidayDestination, "name" | "emoji">; caption: string }) {
  const postcardRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState("");

  const handleShare = useCallback(async () => {
    if (!postcardRef.current || sharing) return;
    setSharing(true);
    setShareError("");
    try {
      const { toPng } = await import("html-to-image");
      const el = postcardRef.current;
      // Export the same locally hosted handwriting the visitor sees.
      await document.fonts.load('400 22px "Caveat"');
      await document.fonts.ready;

      const images = el.querySelectorAll("img");
      const origSrcs: { img: HTMLImageElement; src: string }[] = [];
      await Promise.all(
        Array.from(images).map(async (img) => {
          if (img.src.startsWith("data:")) return;
          origSrcs.push({ img, src: img.src });
          try {
            const resp = await fetch(img.src);
            const blob = await resp.blob();
            const reader = new FileReader();
            const dataUrl = await new Promise<string>((resolve) => {
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
            img.src = dataUrl;
          } catch {}
        })
      );

      const prevOverflow = el.style.overflow;
      const prevMaxWidth = el.style.maxWidth;
      el.style.overflow = "visible";
      el.style.maxWidth = "none";
      const w = el.scrollWidth;
      const h = el.scrollHeight;
      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        cacheBust: true,
        width: w,
        height: h,
        canvasWidth: w * 2,
        canvasHeight: h * 2,
        filter: (node: HTMLElement) => {
          return !node?.dataset?.texture;
        },
      });
      el.style.overflow = prevOverflow;
      el.style.maxWidth = prevMaxWidth;
      origSrcs.forEach(({ img, src }) => { img.src = src; });
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      let shared = false;
      if (navigator.share && navigator.canShare?.({ files: [new File([blob], "santa-postcard.png", { type: "image/png" })] })) {
        const file = new File([blob], "santa-postcard.png", { type: "image/png" });
        try {
          await navigator.share({ files: [file], title: "Santa's Postcard — Santa Radio", text: `A postcard from Santa! 🎅 Follow Santa on Santa Radio: ${TRACKER_URL}`, url: TRACKER_URL });
          shared = true;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
          // Native sharing can be blocked in an embedded preview. Keep download available.
        }
      }
      if (!shared) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "santa-postcard.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.warn("Postcard share/download failed:", err);
      setShareError("Santa’s postcard could not be created. Please try again.");
      if (postcardRef.current) {
        postcardRef.current.style.overflow = "";
        postcardRef.current.style.maxWidth = "";
        postcardRef.current.querySelectorAll("img").forEach((img) => {
          if (!img.src.startsWith("data:")) return;
          const cached = img.getAttribute("data-orig-src");
          if (cached) img.src = cached;
        });
      }
    } finally {
      setSharing(false);
    }
  }, [sharing]);

  return (
    <div className="max-w-3xl mx-auto">
       <div ref={postcardRef} className="tracker-postcard relative rounded-lg overflow-hidden shadow-xl border border-amber-200/30 max-w-xl mx-auto">
        <div
          className="relative"
          style={{
            background: "linear-gradient(135deg, #fdf6e3 0%, #f5e6c8 30%, #faf0d7 60%, #f0dbb8 100%)",
          }}
        >
          <div className="absolute inset-0 opacity-[0.03]"
            data-texture="true"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.65' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`,
            }}
          />

          <div className="relative flex flex-col sm:flex-row h-full pb-6">
            <div className="flex-1 p-5 sm:p-6 flex flex-col justify-center">
              <p
                className="postcard-ink mb-1"
                style={{ fontFamily: "'Caveat', cursive", fontSize: "clamp(1.1rem, 2.6vw, 1.4rem)" }}
              >
                Hello, Santa here...
              </p>
              <p
                className="postcard-ink leading-relaxed transition-opacity duration-700"
                style={{ fontFamily: "'Caveat', cursive", fontSize: "clamp(1.1rem, 2.6vw, 1.4rem)" }}
              >
                {message}
              </p>
              <p
                className="postcard-ink mt-2"
                style={{ fontFamily: "'Caveat', cursive", fontSize: "clamp(1.1rem, 2.6vw, 1.4rem)" }}
              >
                Stay good... Santa x
              </p>
            </div>

            <div className="postcard-divider hidden sm:block w-px my-5 mx-0 self-stretch" />
            <div className="postcard-divider block sm:hidden h-px mx-5" />

            <div className="sm:w-[220px] p-4 sm:p-5 flex flex-col">
              <div className="flex justify-end w-full">
                <img
                  src="/images/santa-post-stamp.png"
                  alt="North Pole Official Mail stamp"
                  className="w-28 sm:w-32 opacity-85"
                  style={{ transform: "rotate(6deg)" }}
                  draggable={false}
                />
              </div>

              <div className="flex-1 flex items-center">
                <div className="w-full space-y-1.5">
                  <p className="postcard-secondary-ink text-[10px] font-bold uppercase tracking-wider mb-1">To:</p>
                  <p className="postcard-ink leading-snug" style={{ fontFamily: "'Caveat', cursive", fontSize: "clamp(1.1rem, 2.6vw, 1.4rem)" }}>
                    The Workshop
                  </p>
                  <div className="postcard-rule border-b" />
                  <p className="postcard-ink leading-snug" style={{ fontFamily: "'Caveat', cursive", fontSize: "clamp(1.1rem, 2.6vw, 1.4rem)" }}>
                    1 Candy Cane Lane
                  </p>
                  <div className="postcard-rule border-b" />
                  <p className="postcard-ink leading-snug font-medium" style={{ fontFamily: "'Caveat', cursive", fontSize: "clamp(1.1rem, 2.6vw, 1.4rem)" }}>
                    North Pole 🎄
                  </p>
                  <div className="postcard-rule border-b" />
                </div>
              </div>

            </div>
          </div>

          <div className="absolute bottom-2 left-5 flex items-center gap-1.5 opacity-70">
            <span className="postcard-secondary-ink text-[9px] italic">
              Sent from {holiday.name} {holiday.emoji}
            </span>
          </div>
        </div>
      </div>
      {shareError && <p role="alert" className="mt-2 text-center text-sm text-santa-gold">{shareError}</p>}
      <div className="flex items-center justify-center gap-3 mt-3">
        <p className="text-xs font-medium text-santa-gold uppercase tracking-wider">
          {caption}
        </p>
        <button
          onClick={handleShare}
          disabled={sharing}
          className="inline-flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-santa-gold transition-colors uppercase tracking-wider disabled:opacity-50"
          aria-label="Share this postcard"
        >
          <Share2 size={12} />
          <span className="hidden sm:inline">{sharing ? "Saving..." : "Share"}</span>
        </button>
      </div>
    </div>
  );
}

export default function SantaStory({ effectiveTime, holiday, routeResearch = false }: SantaStoryProps) {
  const data = getDashboardData(effectiveTime);
  const season = getPostcardSeason(effectiveTime);
  const inJuly = season === "holiday" && isChristmasInJuly(effectiveTime);
  const ctx = getDateContext(effectiveTime);
  const holidayPostcards = [...holidayPostcardEntries, ...seasonalPostcards.holidayExtra].map((entry) =>
    typeof entry === "function" ? entry(ctx) : entry
  );
  const delivery = season === "delivery" ? getDeliveryPostcards(effectiveTime) : null;
  const rotationKey = `${season}:${delivery?.key || ""}`;
  const activePostcards = season === "holiday"
    ? (inJuly ? [...christmasInJulyPostcards, ...holidayPostcards] : holidayPostcards)
    : delivery?.messages || seasonalPostcards[season];
  const [postcardIndex, setPostcardIndex] = useState(0);

  useEffect(() => {
    setPostcardIndex(season === "delivery" ? 0 : Math.floor(Math.random() * activePostcards.length));
    if (routeResearch || activePostcards.length < 2) return;
    const interval = setInterval(() => {
      setPostcardIndex((prev) => (prev + 1) % activePostcards.length);
    }, 15000);
    return () => clearInterval(interval);
  }, [season, rotationKey, routeResearch, activePostcards.length]);

  if (!routeResearch) {
    const captions = {
      planning: "Route Planning Postcards", workshop: "Workshop Postcard",
      delivery: "Christmas Delivery Postcards", rest: "North Pole Christmas Break",
      party: "New Year's Eve Postcards", recovery: "New Year's Day Postcards",
      holiday: inJuly ? "Christmas in July Postcards" : `${ctx.year} Holiday Postcards`,
    };
    const origin = season === "holiday" || season === "planning"
      ? holiday || { name: "the North Pole", emoji: "🎄" }
      : season === "party" || season === "delivery"
        ? { name: data.currentStopName, emoji: data.currentStopFlag }
        : { name: "the North Pole", emoji: "🎄" };
    return <SantaPostcard message={activePostcards[postcardIndex % activePostcards.length]} holiday={origin} caption={captions[season]} />;
  }

  let story = "";
  let label = "";

  if (routeResearch && holiday) {
    story = `${getRouteResearchCopy(holiday)} These make-believe research trips are separate from the estimated Christmas Eve delivery route.`;
    label = "Route Research Report";
  } else switch (data.state) {
    case "ROUTE_RESEARCH":
      story = `${holiday ? getRouteResearchCopy(holiday) : data.statusSubtext} These make-believe research trips are separate from the estimated Christmas Eve delivery route.`;
      label = "Route Research Report";
      break;
    case "OFF_SEASON":
      story =
        "Deep in the heart of the North Pole, Santa is resting by the fire after another extraordinary year. The elves are already busy in the workshop, crafting toys and checking the lists twice. The reindeer are grazing peacefully in the snow-covered meadows, building up their strength for the biggest night of the year. Though Christmas Eve may feel far away, the preparations never truly stop. Santa is always getting ready for that magical journey around the world.";
      label = "North Pole Report";
      break;

    case "PREPARING":
      story = data.statusSubtext;
      label = "Getting ready at the North Pole";
      break;

    case "LIVE_AT_STOP":
    case "IN_TRANSIT":
      story = `${data.statusSubtext}. With ${data.remainingCount} stops still to visit and an estimated ${(data.estimatedGifts / 1_000_000).toFixed(0)} million gifts delivered, Santa's estimated journey continues. ${data.approachingUK ? "Excitement is building in the UK — Santa is getting closer!" : data.nextStopName !== "—" ? `Next stop: ${data.nextStopName}.` : "Finishing the final delivery window in Honolulu, Hawaii."}`;
      label = "Live Update";
      break;

    case "UK_SPECIAL_WINDOW":
      story = data.approachingUK
        ? `${data.statusSubtext}. Santa is getting closer to the UK — its estimated delivery window starts at midnight UTC.`
        : "This is it, Santa is here! Flying across the United Kingdom right now, from the highlands of Scotland to the rolling hills of Wales, from the streets of London to the countryside of Northern Ireland. Stockings are being filled and presents placed under trees. Don't forget to leave out the mince pies and a carrot for the reindeer!";
      label = "Live Update";
      break;

    case "COMPLETE":
      story = data.statusSubtext;
      label = data.statusHeadline;
      break;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="tracker-story-card relative p-6 sm:p-8">
        <div className="tracker-story-label absolute -top-3 left-6 px-3 py-1 rounded-full">
          <span className="text-xs font-medium text-santa-gold uppercase tracking-wider">
            {label}
          </span>
        </div>
        <p className="tracker-copy leading-relaxed text-sm sm:text-base mt-2">{story}</p>
        {data.mode === "LIVE" && <>
          <p className="tracker-copy leading-relaxed text-sm sm:text-base mt-4" data-live-activity>
            <strong>Santa&apos;s make-believe antics · {data.activityPlace}:</strong> {data.currentActivity}
          </p>
          <p className="tracker-copy leading-relaxed text-sm mt-3" data-live-fact>
            <strong>Destination fact · {data.activityPlace}:</strong> {data.currentFunFact}
          </p>
        </>}
      </div>
    </div>
  );
}
