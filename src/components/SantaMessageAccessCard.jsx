import { useId } from 'react';
import { Link } from 'react-router-dom';
import './SantaMessageAccessCard.css';

export default function SantaMessageAccessCard({
  fields,
  errors,
  error,
  pending,
  onChange,
  onSubmit,
  formRef,
  variant = 'inline',
  onPrivacyNavigate,
}) {
  const id = useId();
  const offer = variant === 'offer';
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
      {!offer && <h3 id={`${id}-title`}>ENTER SANTA'S RECORDING STUDIO</h3>}
      <p className="santa-message-access__intro">
        {offer ? 'These are your details. You’ll choose your child’s recorded name next.'
          : 'Add your details and access a free personalised downloadable message from Santa.'}
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
                value={fields?.[name] ?? ''}
                onChange={event => onChange(name, event.target.value)}
                autoComplete={autocomplete}
                maxLength={maxLength}
                required
                readOnly={pending}
                aria-required="true"
                aria-invalid={Boolean(fieldError)}
                aria-describedby={fieldError ? errorId : undefined}
              />
              {fieldError && <p className="santa-message-access__field-error" id={errorId}>{fieldError}</p>}
            </div>
          );
        })}

        <div className="santa-message-access__honeypot" aria-hidden="true">
          <label htmlFor={`${id}-website`}>Leave this field empty</label>
          <input
            id={`${id}-website`}
            name="email_address_check"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={fields?.email_address_check ?? ''}
            onChange={event => onChange('email_address_check', event.target.value)}
          />
        </div>
        <input type="hidden" name="locale" value="en" />

        {error && <p className="santa-message-access__error" role="alert">{error}</p>}
        {offer ? <div className="santa-offer-unlock">
          <span className="santa-offer-unlock-sparkle santa-offer-unlock-sparkle--before" aria-hidden="true" />
          <button className="btn-red santa-message-access__submit" type="submit" disabled={pending}>
            <span className="santa-offer-unlock-sheen" aria-hidden="true" />
            {pending ? 'Opening the recording studio…' : 'Unlock my free Santa message'}
          </button>
          <span className="santa-offer-unlock-sparkle santa-offer-unlock-sparkle--after" aria-hidden="true" />
        </div> : <button className="btn-red santa-message-access__submit" type="submit" disabled={pending}>
          {pending ? 'Opening the recording studio…' : 'Get my free Santa message'}
          {!pending && <span aria-hidden="true">→</span>}
        </button>}
        {pending && <p className="santa-message-access__status" role="status">Opening your access to Santa’s recorded greetings.</p>}
      </form>

      <p className="santa-message-access__privacy">
        Your details are stored for news or updates. Read our <Link to="/privacy-policy" onClick={onPrivacyNavigate}>privacy policy</Link>.
      </p>
      <p className="santa-message-access__delivery">
        {offer ? 'Create your greeting, download instantly and share - not sent by email.'
          : 'Create your greeting, download and share - it won’t be sent by email.'}
      </p>
    </section>
  );
}
