import { FREE_MARKETING_COPY } from '../lib/freeMessageMarketing.js';
import { useId } from 'react';
import { Link } from 'react-router-dom';
import './SantaMessageAccessCard.css';

export default function SantaMessageAccessCard({
  verification, code, onCodeChange, onRestart,
  fields,
  errors,
  error,
  pending,
  onChange,
  onSubmit,
  formRef,
  variant = 'inline',
  onPrivacyNavigate,
  selectedChildName = '',
  pulseSubmit = false,
}) {
  const id = useId();
  const offer = variant === 'offer';
  const submitClassName = `btn-red santa-message-access__submit${pulseSubmit && !pending && !offer ? ' santa-message-access__submit--pulse' : ''}`;
  const fieldIds = {
    FIRSTNAME: `${id}-first-name`,
    LASTNAME: `${id}-surname`,
    EMAIL: `${id}-email`,
  };
  const definitions = [
    { name: 'FIRSTNAME', label: 'First name', autocomplete: 'given-name', maxLength: 200 },
    { name: 'LASTNAME', label: 'Surname', autocomplete: 'family-name', maxLength: 200 },
    { name: 'EMAIL', label: 'Email address', autocomplete: 'email', maxLength: 254, type: 'email' },
  ];

  return (
    <section className={`santa-message-access${offer ? ' santa-message-access--offer' : ''}`} aria-labelledby={offer ? undefined : `${id}-title`}>
      <p className="santa-message-access__step">A note for the grown-up</p>
      {!offer && <h3 id={`${id}-title`} tabIndex={-1}>ENTER SANTA'S RECORDING STUDIO</h3>}
      <p className="santa-message-access__intro">
        {offer ? 'These are your details. You’ll choose your child’s recorded name next.'
          : 'Add details for a free personalised Santa message'}
      </p>

      <form className="santa-message-access__form" ref={formRef} onSubmit={onSubmit} noValidate>
        {definitions.map(({ name, label, autocomplete, maxLength, type = 'text' }) => {
          const fieldId = fieldIds[name];
          const fieldError = errors?.[name];
          const errorId = `${fieldId}-error`;
          return (
            <div className="santa-message-access__field" key={name}>
              <label htmlFor={fieldId}>{label}<span aria-hidden="true"> *</span></label>
              <input
                id={fieldId}
                name={name}
                type={type}
                defaultValue={fields?.[name] ?? ''}
                onChange={event => onChange(name, event.target.value)}
                autoComplete={autocomplete}
                maxLength={maxLength}
                required
                readOnly={pending || !!verification}
                aria-required="true"
                aria-invalid={Boolean(fieldError)}
                aria-describedby={fieldError ? errorId : undefined}
              />
              {fieldError && <p className="santa-message-access__field-error" id={errorId}>{fieldError}</p>}
            </div>
          );
        })}

        <div className="santa-message-access__honeypot" aria-hidden="true">
          <label htmlFor={`${id}-extra`}>Leave this field empty</label>
          <input
            id={`${id}-extra`}
            name="studio_check"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore="true"
            data-bwignore="true"
            defaultValue={fields?.studio_check ?? ''}
            onChange={event => onChange('studio_check', event.target.value)}
          />
        </div>
        <input type="hidden" name="locale" value="en" />

        <label className="santa-message-access__marketing">
          <input type="checkbox" name="marketingOptIn" defaultChecked={false} disabled={pending || !!verification} />
          <span>{FREE_MARKETING_COPY} <Link to="/privacy-policy" onClick={onPrivacyNavigate}>Privacy policy</Link>. <small>Optional — your free message is available either way.</small></span>
        </label>
        {verification && <div className="santa-message-access__field">
          <p className="santa-message-access__status" role="status">We’ve emailed a code to {fields.EMAIL}. Check your inbox and junk folder. It expires in 15 minutes.</p>
          <label htmlFor={`${id}-code`}>Six-digit email code</label>
          <input id={`${id}-code`} name="code" type="text" inputMode="numeric" autoComplete="one-time-code"
            maxLength={6} value={code} onChange={event => onCodeChange(event.target.value.replace(/\D/g, ''))}
            readOnly={pending} aria-invalid={Boolean(errors?.code)} aria-describedby={errors?.code ? `${id}-code-error` : undefined} />
          {errors?.code && <p id={`${id}-code-error`} className="santa-message-access__field-error">{errors.code}</p>}
          <button type="button" className="santa-message-access__restart" disabled={pending} onClick={onRestart}>Change email or request another code</button>
        </div>}
        {error && <p className="santa-message-access__error" role="alert">{error}</p>}
        {offer ? <div className="santa-offer-unlock">
          <span className="santa-offer-unlock-sparkle santa-offer-unlock-sparkle--before" aria-hidden="true" />
          <button className={submitClassName} type="submit" disabled={pending}>
            <span className="santa-offer-unlock-sheen" aria-hidden="true" />
            {pending ? 'Please wait…' : verification ? 'Confirm email & unlock my message' : 'Email my verification code'}
          </button>
          <span className="santa-offer-unlock-sparkle santa-offer-unlock-sparkle--after" aria-hidden="true" />
        </div> : <button className={submitClassName} type="submit" disabled={pending}>
          {pending ? 'Please wait…' : verification ? 'Confirm email & unlock my message' : 'Email my verification code'}
          {!pending && <span aria-hidden="true">→</span>}
        </button>}
        {pending && <p className="santa-message-access__status" role="status">{verification ? 'Checking your email code…' : 'Sending your verification code…'}</p>}
      </form>

      {!offer && (pending || verification) && <p className="santa-message-access__privacy">
        Confirm your email to unlock your free message. If you tick the box above, confirmation also signs you up for Santa Radio emails. Read our <Link to="/privacy-policy" onClick={onPrivacyNavigate}>privacy policy</Link>.
      </p>}
    </section>
  );
}
