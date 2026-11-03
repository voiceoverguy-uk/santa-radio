import useGiftNameFit from './useGiftNameFit.js';
import { fitCertificatePreviewName } from '../lib/santaPictureLayout.js';
import { recipientDisplayName } from '../lib/giftFonts.js';

export default function CertificateName({ name, children }) {
  const fit = useGiftNameFit(name, 'certificate', fitCertificatePreviewName);
  return <span aria-hidden="true" className="studio-certificate__name"
    data-fitted={Boolean(fit)} style={{ visibility: fit ? undefined : 'hidden' }}>
    {children(<svg viewBox="0 77 297 24" aria-hidden="true">
      <text x={fit?.x || 0} y={fit?.y || 0} fontSize={fit?.size || 22.6}>{recipientDisplayName(name)}</text>
    </svg>)}
  </span>;
}
