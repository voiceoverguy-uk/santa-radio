import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SantaMessageAccessCard from './SantaMessageAccessCard.jsx';
import { useSantaMessageAccess } from './SantaMessageAccessProvider.jsx';
import { ACCESS_REQUEST_TIMEOUT_MS, MessageAccessError, submitMessageAccess, validateAccessFields } from '../lib/santaMessageAccess.js';

const emptyFields = { FIRSTNAME: '', LASTNAME: '', EMAIL: '', email_address_check: '' };

export default function SantaMessageAccessForm() {
  const [fields, setFields] = useState(emptyFields);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const formRef = useRef(null);
  const requestRef = useRef(null);
  const { grantAccess } = useSantaMessageAccess();
  const navigate = useNavigate();

  useEffect(() => () => {
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);

  const focusInvalid = fieldErrors => {
    const field = Object.keys(fieldErrors)[0];
    if (field) requestAnimationFrame(() => formRef.current?.elements.namedItem(field)?.focus());
  };
  const onChange = (field, value) => {
    if (requestRef.current) return;
    setFields(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [field]: undefined }));
    setError('');
  };
  const onSubmit = async event => {
    event.preventDefault();
    if (requestRef.current) return;
    const validation = validateAccessFields(fields);
    setErrors(validation);
    setError('');
    if (Object.keys(validation).length) {
      setError('Please check the highlighted details.');
      focusInvalid(validation);
      return;
    }
    if (fields.email_address_check) {
      setError('Your details could not be submitted. Please try again.');
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, ACCESS_REQUEST_TIMEOUT_MS);
    setPending(true);
    try {
      await submitMessageAccess(fields, controller.signal);
      if (requestRef.current !== controller) return;
      controller.signal.throwIfAborted();
      grantAccess();
      setFields(emptyFields);
      // Never follow Brevo's optional legacy external redirect.
      navigate('/free-santa-message');
    } catch (failure) {
      if (requestRef.current !== controller) return;
      if (failure instanceof MessageAccessError) {
        setErrors(failure.fieldErrors);
        setError(failure.message);
        focusInvalid(failure.fieldErrors);
      } else {
        setError(timedOut
          ? 'The message desk took too long to respond. Your details are still here; please try again.'
          : 'We couldn’t reach the message desk. Check your connection and try again.');
      }
    } finally {
      clearTimeout(timeout);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setPending(false);
      }
    }
  };
  return <SantaMessageAccessCard {...{ fields, errors, error, pending, onChange, onSubmit, formRef }} />;
}
