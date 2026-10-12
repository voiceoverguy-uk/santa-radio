import { ClerkProvider, SignIn, SignUp, useAuth, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { Link, useNavigate } from 'react-router-dom';
import './SantaStaffBrowser.css';
import SantaRequestLedger from '../components/SantaRequestLedger.jsx';

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const clerkAppearance = {
  options: {
    logoPlacement: 'inside',
    logoLinkUrl: '/',
    logoImageUrl: `${window.location.origin}/images/santa-radio-logo.png`,
  },
  variables: {
    colorPrimary: '#8d2026',
    colorForeground: '#173629',
    colorMutedForeground: '#526457',
    colorDanger: '#a12b2b',
    colorBackground: '#f5efdf',
    colorInput: '#fffaf0',
    colorInputForeground: '#173629',
    colorNeutral: '#c5b78e',
    fontFamily: 'Inter, sans-serif',
    borderRadius: '10px',
  },
  elements: {
    rootBox: { width: '100%', display: 'flex', justifyContent: 'center' },
    cardBox: { width: '100%', maxWidth: '430px', background: '#f5efdf', borderRadius: '16px', overflow: 'hidden', boxShadow: 'none' },
    logoImage: { width: '220px', maxWidth: '100%', height: 'auto', objectFit: 'contain', background: '#0c2a20', borderRadius: '8px', padding: '5px 18px', boxSizing: 'border-box' },
    card: { background: 'transparent', boxShadow: 'none', border: '0' },
    footer: { background: 'transparent', boxShadow: 'none', border: '0' },
    headerTitle: { color: '#173629', fontFamily: 'Cinzel, serif', fontWeight: 400 },
    headerSubtitle: { color: '#526457' },
    formFieldLabel: { color: '#173629', fontWeight: 500 },
    formFieldInput: { background: '#fffaf0', color: '#173629', borderColor: '#c5b78e' },
    formButtonPrimary: { background: '#8d2026', color: '#fff8e7', boxShadow: 'none' },
    footerActionText: { color: '#526457' },
    footerActionLink: { color: '#8d2026' },
    dividerText: { color: '#526457' },
    socialButtonsBlockButtonText: { color: '#173629' },
    alertText: { color: '#8d2026' },
    formFieldSuccessText: { color: '#28633f' },
  },
};

function StaffBrand() {
  return <img className="staff-brand" src="/images/santa-radio-logo.png" alt="Santa Radio" width="827" height="190" />;
}

function AuthPage({ mode }) {
  const signup = mode === 'sign-up';
  return <main className="staff-page">
    <div className="staff-wrap staff-auth">
      <section className="staff-panel" aria-labelledby="staff-auth-title">
        <p className="staff-kicker">Santa Radio · staff access</p>
        <h1 id="staff-auth-title">{signup ? 'Create your staff account' : 'Welcome back'}</h1>
        <p className="staff-lede">{signup
          ? 'Create an account using an email address you can verify. Approved access to the request ledger is granted by the server.'
          : 'Sign in to continue to the private North Pole name-request ledger.'}</p>
        {signup
          ? <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" forceRedirectUrl="/request-names" />
          : <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" forceRedirectUrl="/request-names" />}
        <p className="staff-lede" style={{ margin: '18px 0 0', fontSize: '.8rem' }}>
          {signup ? <>Already have a staff account? <Link to="/sign-in">Sign in</Link>.</> : <>Need an account? <Link to="/sign-up">Create one</Link>.</>}
          {' '}<Link to="/">Return to Santa Radio</Link>
        </p>
      </section>
    </div>
  </main>;
}

function AdminLanding() {
  return <main className="staff-page">
    <div className="staff-wrap staff-auth">
      <StaffBrand />
      <section className="staff-panel" aria-labelledby="ledger-welcome-title">
        <p className="staff-kicker">Santa Radio · staff access</p>
        <h1 id="ledger-welcome-title">The North Pole request ledger</h1>
        <p className="staff-lede">A private list of first names visitors have asked Santa to record. Sign in to view requests. The server verifies staff approval before sharing the ledger.</p>
        <p><Link className="staff-button primary" to="/sign-in">Sign in to view requests</Link></p>
        <p className="staff-lede" style={{ margin: '18px 0 0', fontSize: '.8rem' }}>Approved owner? <Link to="/sign-up">Create an account</Link> with your verified email address.</p>
      </section>
    </div>
  </main>;
}

function RequestLedger() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  if (!isLoaded) return <main className="staff-page"><div className="staff-wrap">
    <section className="staff-panel staff-skeleton" aria-label="Loading staff access">
      <div className="staff-loading-row" /><div className="staff-loading-row" /><div className="staff-loading-row" />
      <p className="sr-only" role="status">Checking staff sign-in…</p>
    </section>
  </div></main>;
  if (!isSignedIn) return <AdminLanding />;

  return <SantaRequestLedger
    key={`${user?.id}:${user?.primaryEmailAddress?.emailAddress}:${user?.primaryEmailAddress?.verification?.status}`}
    email={user?.primaryEmailAddress?.emailAddress}
    onSignOut={() => signOut({ redirectUrl: '/' })} />;
}

function BrowserStaffPage({ mode }) {
  const navigate = useNavigate();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl="/sign-in"
    signUpUrl="/sign-up"
    localization={{
      signIn: { start: { title: 'Welcome back', subtitle: 'Sign in for Santa Radio staff access' } },
      signUp: { start: { title: 'Create your account', subtitle: 'Use your verified staff email address' } },
    }}
    routerPush={to => navigate(to)}
    routerReplace={to => navigate(to, { replace: true })}
  >
    {mode === 'sign-in' || mode === 'sign-up'
      ? <AuthPage mode={mode} />
      : <RequestLedger />}
  </ClerkProvider>;
}

export default function SantaStaffBrowser({ mode }) {
  return <BrowserStaffPage mode={mode} />;
}
