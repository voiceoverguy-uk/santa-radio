import { Link } from 'react-router-dom';
import './PrivacyPolicy.css';

export default function PhotoLicensing() {
  return <main className="privacy-page">
    <article className="privacy-content">
      <p className="eyebrow">Santa Radio · Mugshot photographs</p>
      <h1>Photo usage and licensing</h1>
      <p>The photographs in Santa Radio’s <Link to="/mugshots/all">Mugshots collection</Link> are copyright-protected. Santa Radio is the copyright owner and rights holder for these photographs.</p>

      <h2>Permission to reuse a photograph</h2>
      <p>Except where applicable law permits otherwise, you must obtain permission from Santa Radio before copying, republishing, distributing, adapting or otherwise reusing a Mugshot photograph, whether for commercial or non-commercial purposes.</p>
      <p>Displaying a photograph on this website does not grant a licence for reuse. These photographs are not offered under a Creative Commons licence or for unrestricted reuse. Giving a credit alone is not permission. Nothing on this page limits exceptions or other uses permitted by applicable law.</p>

      <h2>Copyright ownership and photographer credits</h2>
      <p>Bruce Davis takes photographs for Santa Radio and supplies them for Santa Radio to use and own. He may be credited as the photographer; that credit does not identify him as the copyright holder.</p>
      <p>Individual photographs retain their existing photographer credits, including credits naming other photographers. A photographer credit identifies the credited photographer, separately from Santa Radio’s copyright ownership.</p>

      <h2>How to request permission</h2>
      <p>Use our <Link to="/submit-a-song?mode=general">general enquiry contact form to request photo permission</Link>. Include the Mugshot page link and describe your proposed use, where it will appear and whether it is commercial. We can then discuss whether permission is available and any applicable conditions.</p>
      <p>Sending a request does not grant permission. Unless your use is permitted by applicable law, wait for express permission from Santa Radio before reusing the photograph.</p>

      <h2>Scope of these terms</h2>
      <p>These terms apply only to the Mugshot photographs. They do not cover unrelated music artwork, logos or third-party assets on this website, and do not grant rights in those materials.</p>
    </article>
  </main>;
}
