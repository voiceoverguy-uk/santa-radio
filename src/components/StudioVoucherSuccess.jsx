import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './StudioPaymentSuccess.css';

export default function StudioVoucherSuccess({ onContinue }) {
  const title = useRef(null);
  const [remaining, setRemaining] = useState(null);
  useEffect(() => {
    title.current?.focus(); window.scrollTo(0, 0);
    const controller = new AbortController();
    fetch('/api/santa-studio-message', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (!controller.signal.aborted && Number.isInteger(data?.remaining)) setRemaining(data.remaining); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return <main className="studio-success">
    <section className="studio-success__card" aria-labelledby="voucher-success-title">
      <img className="studio-success__portrait" src="/images/north-pole-hero.webp" alt="The snowy North Pole village beneath the Northern Lights" />
      <div className="studio-success__content">
        <p className="studio-success__eyebrow">A LITTLE NORTH POLE MAGIC</p>
        <span className="studio-success__tick" aria-hidden="true">✓</span>
        <h1 ref={title} tabIndex={-1} id="voucher-success-title">Voucher code accepted</h1>
        <p className="studio-success__lead">You’re invited to create some Christmas magic!</p>
        <p>Your voucher unlocks <strong>two personalised messages from Santa</strong>, each with a Nice List certificate, a letter and a Santa picture.</p>
        <p className="studio-success__allowance" role="status">{remaining === null
          ? 'Your remaining messages will be checked when you open Studio.'
          : remaining === 0 ? 'You’ve created both messages included with this voucher.'
          : `You have ${remaining} ${remaining === 1 ? 'message' : 'messages'} remaining.`}</p>
        <button type="button" className="btn-red studio-success__start" onClick={onContinue}>{remaining === 0 ? 'Open your Studio' : 'Create your bespoke message'}</button>
        <div className="studio-success__return">
          <h2>Your Christmas creations await</h2>
          <p>Opening Studio doesn’t use a message. Your allowance is used only when a recording is successfully created.</p>
          <p>Return using this same browser to keep access to your remaining messages.</p>
          <p className="studio-success__download">Download each recording and its keepsakes before leaving Studio so you can keep them forever.</p>
        </div>
        <Link className="studio-success__later" to="/">Back to Santa Radio — I’ll create them later</Link>
      </div>
    </section>
  </main>;
}
