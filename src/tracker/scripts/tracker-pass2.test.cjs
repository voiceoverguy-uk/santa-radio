const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const root = path.resolve(__dirname, "..");
const canonical = "https://www.santaguy.co.uk/santa-tracker";
const intro = "Follow Santa's estimated Christmas Eve journey around the world. Count down to his departure, follow his progress on the world map, and explore the estimated schedule for the big night.";
const description = "Follow Santa's estimated Christmas Eve journey around the world, with a countdown, updating world map, festive facts and family fun from SantaGuy.";

test("holiday season includes October and ends at midnight UTC on 1 November", () => {
  const { isHolidaySeason } = harness().load("lib/santaRoute.ts");
  for (const iso of ["2026-03-01T00:00:00Z", "2026-10-01T00:00:00Z", "2026-10-31T23:59:59.999Z"]) {
    assert.equal(isHolidaySeason(new Date(iso)), true, iso);
  }
  for (const iso of ["2026-02-28T23:59:59.999Z", "2026-11-01T00:00:00Z", "2026-12-24T12:00:00Z"]) {
    assert.equal(isHolidaySeason(new Date(iso)), false, iso);
  }
});

function harness(iso = "2026-11-15T12:00:00Z") {
  const clock = new global.Date(iso).getTime();
  class FixedDate extends global.Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  const state = [];
  const effects = [];
  let cursor = 0;
  let id = 0;
  const window = { matchMedia: () => ({ matches: false }) };
  const react = {
    ...React,
    useState(initial) {
      const slot = cursor++;
      if (!(slot in state)) state[slot] = typeof initial === "function" ? initial() : initial;
      return [state[slot], (value) => {
        state[slot] = typeof value === "function" ? value(state[slot]) : value;
      }];
    },
    useEffect(effect) { effects.push(effect); },
    useCallback(fn) { return fn; },
    useRef(initial) { return { current: initial }; },
    useId() { return `tracker-test-${++id}`; },
  };
  const cache = new Map();
  const children = {
    SantaMap: "map", SantaStats: "stats", SantaStory: "story",
    SantaTimeline: "timeline", SantaPreviewPanel: "preview-panel", NotifySignup: "signup",
  };
  function load(file, stubChildren = false) {
    const full = path.resolve(root, file);
    const key = `${full}:${stubChildren}`;
    if (cache.has(key)) return cache.get(key);
    const source = ts.transpileModule(fs.readFileSync(full, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
      },
    }).outputText;
    const exports = {};
    cache.set(key, exports);
    vm.runInNewContext(source, {
      exports, Date: FixedDate, window,
      localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
      setInterval: () => 1, clearInterval() {},
      require(spec) {
        if (spec === "react") return react;
        if (spec === "react/jsx-runtime") return require(spec);
        if (spec === "lucide-react") return new Proxy({}, { get: () => () => null });
        const name = path.basename(spec);
        if (stubChildren && children[name]) {
          return { __esModule: true, default: () => React.createElement("div", { "data-part": children[name] }) };
        }
        let target;
        if (spec.startsWith("@/")) target = path.join(root, spec.slice(2));
        else if (spec.startsWith(".")) target = path.resolve(path.dirname(full), spec);
        else throw new Error(`Unexpected dependency ${spec} in ${file}`);
        if (!path.extname(target)) target += ".tsx";
        if (!fs.existsSync(target) && target.endsWith(".tsx")) target = target.slice(0, -1);
        return load(path.relative(root, target), stubChildren);
      },
    }, { filename: full });
    return exports;
  }
  function render(element) {
    cursor = 0;
    effects.length = 0;
    return renderToStaticMarkup(element);
  }
  function flush() {
    const pending = effects.splice(0);
    for (const effect of pending) effect();
  }
  return { load, render, flush, state, react, FixedDate, effects, window, resetHooks: () => { cursor = 0; } };
}

function pageView(date) {
  const h = harness(date);
  const page = h.load("app/santa-tracker/page.tsx", true);
  const html = h.render(React.createElement(page.default));
  return { h, page, html };
}

function schema(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)]
    .map((match) => JSON.parse(match[1].replaceAll("&quot;", '"').replaceAll("&amp;", "&")));
}

test("main route initial server render has exactly one useful H1 and intro in hero; mounted hero keeps same slot", () => {
  const { h, page, html } = pageView();
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /<h1[^>]*>Track Santa&#x27;s Journey<br\/><span[^>]*>Around the World<\/span><\/h1>/);
  assert.ok(html.includes(intro.replaceAll("'", "&#x27;")));
  assert.match(html, /star-field/);
  assert.match(html, /Loading Santa Tracker/);
  assert.doesNotMatch(html, /Live Dashboard|data-part="map"|Countdown to Santa/);
  h.flush();
  const mounted = h.render(React.createElement(page.default));
  assert.equal((mounted.match(/<h1\b/g) || []).length, 1);
  assert.ok(mounted.includes(intro.replaceAll("'", "&#x27;")));
  assert.match(mounted, /Live Dashboard/);
  assert.match(mounted, /data-part="map"/);
  assert.match(mounted, /data-part="timeline"/);
  assert.match(mounted, /Countdown to Santa&#x27;s Departure/);
  assert.match(mounted, /data-part="signup"/);
  assert.match(mounted, /Check Availability/);
  assert.doesNotMatch(mounted, /Follow Santa as Christmas Eve midnight sweeps/);
});

test("main/preview metadata, July variant, and actual rendered WebPage/breadcrumb identity", () => {
  const { h, page, html } = pageView();
  const main = page.generateMetadata();
  assert.equal(main.title.absolute, "Santa Tracker | Track Santa's Journey Around the World");
  assert.equal(main.description, description);
  assert.equal(main.openGraph.description, description);
  assert.equal(main.twitter.description, description);
  assert.equal(main.alternates.canonical, canonical);
  assert.equal(main.openGraph.url, canonical);
  assert.notEqual(main.robots?.index, false);
  const nodes = schema(html);
  assert.equal(nodes.length, 2);
  const web = nodes.find((node) => node["@type"] === "WebPage");
  const crumb = nodes.find((node) => node["@type"] === "BreadcrumbList");
  assert.equal(web["@id"], `${canonical}#webpage`);
  assert.equal(web.inLanguage, "en-GB");
  assert.equal(web.description, description);
  assert.equal(web.url, canonical);
  assert.deepEqual(Object.keys(web.isPartOf), ["@id"]);
  assert.equal(web.isPartOf["@id"], "https://www.santaguy.co.uk/#website");
  assert.deepEqual(crumb.itemListElement.map(({ position, item }) => [position, item]), [
    [1, "https://www.santaguy.co.uk"], [2, canonical],
  ]);
  assert.doesNotMatch(JSON.stringify(nodes), /Event|BroadcastEvent|LiveBlogPosting|SoftwareApplication|AggregateRating/);
  const july = harness("2026-07-10T12:00:00Z").load("app/santa-tracker/page.tsx", true).generateMetadata();
  assert.equal(july.title.absolute, "Christmas in July | Santa Tracker — SantaGuy.co.uk");
  assert.equal(july.description, "It's Christmas in July! See what Santa's up to mid-year — festive fun, holiday postcards, and countdown to the big night. Track Santa at SantaGuy.co.uk.");
  assert.equal(july.openGraph.description, july.description);
  assert.equal(july.twitter.description, july.description);
  assert.equal(july.alternates.canonical, canonical);
  const preview = h.load("app/santa-tracker/preview/page.tsx", true);
  assert.equal(preview.metadata.robots.index, false);
  assert.equal(preview.metadata.robots.follow, true);
  const previewHtml = h.render(React.createElement(preview.default));
  assert.equal((previewHtml.match(/<h1\b/g) || []).length, 0); // loading fallback has no invented heading
  h.flush();
  const mountedPreview = h.render(React.createElement(preview.default));
  assert.equal((mountedPreview.match(/<h1\b/g) || []).length, 1);
  assert.match(mountedPreview, /data-part="preview-panel"/);
});

test("mounted seasonal and preview status/countdown/CTA retain behavior alongside stable intro", () => {
  for (const [date, status, count] of [
    ["2026-12-24T05:00:00Z", /Preparing for Takeoff/, true],
    ["2026-12-24T14:00:00Z", /Delivering Now/, false],
    ["2026-12-25T12:00:00Z", /Journey Complete/, false],
    ["2026-07-10T12:00:00Z", /Christmas in July/, true],
  ]) {
    const { h, page } = pageView(date);
    h.flush();
    const html = h.render(React.createElement(page.default));
    assert.match(html, status, date);
    assert.ok(html.includes(intro.replaceAll("'", "&#x27;")), date);
    assert.equal(html.includes("Countdown to Santa&#x27;s Departure"), count, date);
    assert.equal(html.includes('data-part="signup"'), count, date);
    assert.match(html, /Check Availability/, date);
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
  }
});

// Inspect the actual JSX host nodes so button handlers and ARIA props are exercised,
// rather than treating markup text as a substitute for interaction coverage.
function hosts(element) {
  if (Array.isArray(element)) return element.flatMap(hosts);
  if (element == null || typeof element !== "object") return [];
  if (typeof element.type === "function") return hosts(element.type(element.props));
  return [element, ...hosts(element.props?.children)];
}
function text(element) {
  if (Array.isArray(element)) return element.map(text).join("");
  if (element == null || typeof element === "boolean") return "";
  if (typeof element !== "object") return String(element);
  return text(element.props?.children);
}
function button(nodes, label) {
  const found = nodes.find((node) => node.type === "button" && text(node) === label);
  assert.ok(found, `Missing button ${label}`);
  return found;
}

test("map SVG has a connected name/summary for route and holiday, preserving visual marker and caption", () => {
  const h = harness("2026-12-24T14:00:00Z");
  const map = h.load("components/SantaMap.tsx").default;
  const route = h.load("lib/santaRoute.ts").getDashboardData(new h.FixedDate());
  const props = { effectiveTime: new h.FixedDate(), mapPosition: route.mapPosition };
  const nodes = hosts(map(props));
  const svg = nodes.find((node) => node.type === "svg");
  const title = nodes.find((node) => node.type === "title");
  const desc = nodes.find((node) => node.type === "desc");
  assert.equal(svg.props.role, "img");
  assert.equal(svg.props["aria-labelledby"], title.props.id);
  assert.equal(svg.props["aria-describedby"], desc.props.id);
  assert.match(text(title), /estimated journey map/);
  assert.match(text(desc), /estimated position.*Red dots.*visited.*upcoming/);
  assert.ok(nodes.some((node) => node.type === "text" && text(node) === "🎅"));
  assert.match(h.render(React.createElement(map, props)), /Estimated route based on local midnight across time zones/);
  const holiday = hosts(map({ ...props, onHoliday: true }));
  assert.match(text(holiday.find((node) => node.type === "title")), /holiday location/);
  assert.match(text(holiday.find((node) => node.type === "desc")), /holiday location.*Faint dots/);
});

test("preview native controls expose expansion, switch and selected speed without altering jump/run/reset actions", () => {
  const h = harness();
  const preview = h.load("lib/santaPreview.ts");
  const panel = h.load("components/SantaPreviewPanel.tsx").default;
  let state = preview.getDefaultPreviewState();
  const changes = [];
  const onPreviewChange = (next) => { state = next; changes.push(next); };
  const current = new h.FixedDate();
  // Keep panel's own expansion state while replacing only the external preview prop.
  const panelNodes = () => {
    h.resetHooks();
    return hosts(panel({ previewState: state, onPreviewChange, effectiveTime: current }));
  };
  let nodes = panelNodes();
  const control = button(nodes, "Preview Controls▼");
  const region = nodes.find((node) => node.props?.role === "region");
  assert.equal(control.props["aria-expanded"], true);
  assert.equal(control.props["aria-controls"], region.props.id);
  assert.equal(region.props.hidden, false);
  let toggle = nodes.find((node) => node.props?.role === "switch");
  assert.equal(toggle.type, "button");
  assert.equal(toggle.props["aria-label"], "Preview mode");
  assert.equal(toggle.props["aria-checked"], false);
  control.props.onClick(); // native button, keyboard activation uses the same click handler
  nodes = panelNodes();
  assert.equal(button(nodes, "Preview Controls▲").props["aria-expanded"], false);
  assert.equal(nodes.find((node) => node.props?.role === "region").props.hidden, true);
  button(nodes, "Preview Controls▲").props.onClick();
  nodes = panelNodes();
  toggle = nodes.find((node) => node.props?.role === "switch");
  toggle.props.onClick();
  assert.equal(state.enabled, true);
  assert.equal(state.jumpTarget, "route-start");
  nodes = panelNodes();
  assert.equal(nodes.find((node) => node.props?.role === "switch").props["aria-checked"], true);
  assert.equal(nodes.find((node) => node.props?.role === "group").props["aria-label"], "Preview speed");
  assert.equal(button(nodes, "1×").props["aria-pressed"], true);
  button(nodes, "10×").props.onClick();
  assert.equal(state.speedMultiplier, 10);
  assert.equal(state.simulatedStartMs, current.getTime());
  nodes = panelNodes();
  assert.equal(button(nodes, "10×").props["aria-pressed"], true);
  assert.equal(button(nodes, "1×").props["aria-pressed"], false);
  button(nodes, "Australia").props.onClick();
  assert.equal(state.jumpTarget, "australia");
  assert.equal(state.speedMultiplier, 10);
  nodes = panelNodes();
  button(nodes, "2min").props.onClick();
  assert.equal(state.jumpTarget, "route-start");
  assert.equal(state.speedMultiplier, preview.getRunFullJourneySpeed(2));
  nodes = panelNodes();
  for (const label of ["Australia", "2min", "Reset to Real Time"]) {
    assert.equal(button(nodes, label).props["aria-pressed"], undefined, label);
  }
  button(nodes, "Reset to Real Time").props.onClick();
  assert.equal(state.enabled, false);
  nodes = panelNodes();
  nodes.find((node) => node.props?.role === "switch").props.onClick();
  assert.equal(state.enabled, true);
  nodes = panelNodes();
  nodes.find((node) => node.props?.role === "switch").props.onClick();
  assert.equal(state.enabled, false);
  assert.equal(changes.length, 7);
});

test("timeline has textual Visited/Now/Upcoming in both layouts and focusable horizontal scrolling", () => {
  const h = harness("2026-12-24T14:00:00Z");
  const timeline = h.load("components/SantaTimeline.tsx").default;
  const nodes = hosts(timeline({ effectiveTime: new h.FixedDate() }));
  const scroller = nodes.find((node) => node.props?.["aria-label"]?.includes("scroll horizontally"));
  assert.equal(scroller.props.tabIndex, 0);
  assert.equal(scroller.type, "div");
  const markup = h.render(React.createElement(timeline, { effectiveTime: new h.FixedDate() }));
  for (const status of ["Visited", "Now", "Upcoming"]) {
    assert.equal((markup.match(new RegExp(`>${status}<`, "g")) || []).length > 1, true, status);
  }
});

test("timeline centers with immediate scrolling for reduced motion and smooth otherwise", () => {
  for (const [reduced, behavior] of [[true, "instant"], [false, "smooth"]]) {
    const h = harness("2026-12-24T14:00:00Z");
    h.window.matchMedia = (query) => {
      assert.equal(query, "(prefers-reduced-motion: reduce)");
      return { matches: reduced };
    };
    const timeline = h.load("components/SantaTimeline.tsx").default;
    const nodes = hosts(timeline({ effectiveTime: new h.FixedDate() }));
    const scroller = nodes.find((node) => node.props?.tabIndex === 0);
    const current = nodes.find((node) => node.props?.ref && node !== scroller);
    assert.ok(current, "a current stop is available for auto-centering");
    let called;
    scroller.props.ref.current = {
      getBoundingClientRect: () => ({ left: 10, width: 400 }),
      scrollLeft: 20,
      scrollTo: (options) => { called = options; },
    };
    current.props.ref.current = { getBoundingClientRect: () => ({ left: 100, width: 120 }) };
    h.flush();
    assert.equal(called.left, -30);
    assert.equal(called.behavior, behavior);
  }
});