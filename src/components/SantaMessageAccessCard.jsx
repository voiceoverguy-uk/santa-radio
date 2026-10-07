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
}) {
  const id = useId();
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
    <section className="santa-message-access" aria-labelledby={`${id}-title`}>
      <p className="santa-message-access__step">A note for the grown-up</p>
      <h3 id={`${id}-title`}>First, open Santa’s message desk</h3>
      <p className="santa-message-access__intro">
        Add your details for immediate access to a free, downloadable Santa greeting. Next, you’ll choose a recorded name for your child.
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
        <button className="btn-red santa-message-access__submit" type="submit" disabled={pending}>
          {pending ? 'Opening the message desk…' : 'Get my free Santa message'}
          {!pending && <span aria-hidden="true">→</span>}
        </button>
        {pending && <p className="santa-message-access__status" role="status">Opening your access to Santa’s recorded greetings.</p>}
      </form>

      <p className="santa-message-access__privacy">
        Your adult contact details are sent to Brevo to open the message desk, not to sign you up for Santa Radio news. Read our <Link to="/privacy-policy">privacy policy</Link>.
      </p>
      <p className="santa-message-access__delivery">
        Once you create your greeting, download the MP3 here — it won’t be sent by email.
      </p>
    </section>
  );
}
