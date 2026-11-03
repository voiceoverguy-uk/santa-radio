"""Fetch only the site's Inter/Cinzel fonts and their OFL notices, never secrets."""
from pathlib import Path
import re
import subprocess

dest = Path("generated-artifacts/iphone-tracker/fonts")
dest.mkdir(parents=True, exist_ok=True)
def fetch(url):
    return subprocess.check_output(["curl", "--fail", "--silent", "--show-error", "--location", url])
css_url = "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500&family=Inter:wght@400;500;600;700&display=swap"
css = fetch(css_url).decode()
for block in css.split("@font-face"):
    family = re.search(r"font-family: '(\w+)'", block)
    weight = re.search(r"font-weight: (\d+)", block)
    url = re.search(r"src: url\((https://fonts.gstatic.com/[^)]+)\)", block)
    if family and weight and url:
        (dest / f"{family[1]}-{weight[1]}.ttf").write_bytes(fetch(url[1]))
        if (dest / f"{family[1]}-{weight[1]}.ttf").stat().st_size < 1000:
            raise SystemExit("Font download unexpectedly small")
for family in ["inter", "cinzel"]:
    (dest / f"{family.title()}-OFL.txt").write_bytes(fetch(f"https://raw.githubusercontent.com/google/fonts/main/ofl/{family}/OFL.txt"))
(dest / "FONT-PROVENANCE.txt").write_text(
    "Export-only local copies of the current site's Inter (400/500/600/700) and Cinzel (400/500).\n"
    "Retrieved from Google Fonts CSS and fonts.gstatic.com; OFL notices from google/fonts.\n"
    "The website loads these families externally; this handover loads bundled copies instead.\n"
    f"CSS source: {css_url}\n\n{css}"
)
print("Prepared six font files with licences and provenance.")
