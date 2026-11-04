import './WorkshopExplainerCards.css';

const workshopExplainer = [
  {
    number: '01',
    title: 'Start with their name',
    copy: 'Choose a name for Santa’s special greeting.',
    icon: <path d="M5 19c2.1-3.4 4.3-5.1 7-5.1s4.9 1.7 7 5.1M16.5 5.8a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />,
  },
  {
    number: '02',
    title: 'Add the little details',
    copy: 'Pick their age, an optional talent, something they’re working hard at and an achievement worth celebrating. Add a festive treat and a magical place, too.',
    icon: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" /></>,
  },
  {
    number: '03',
    title: 'Check your Christmas creation',
    copy: 'Review your choices and change anything before Santa’s message comes together.',
    icon: <><path d="M4 12a8 8 0 1 0 2.3-5.6L4 8.7" /><path d="M4 4v4.7h4.7M12 8v4l2.8 1.8" /></>,
  },
];

export default function WorkshopExplainerCards({ className = '' }) {
  return (
    <div className={`smw-explainer-cards${className ? ` ${className}` : ''}`}>
      {workshopExplainer.map(item => (
        <article className="smw-explainer-card" key={item.number}>
          <div className="smw-card-top">
            <span className="smw-card-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">{item.icon}</svg>
            </span>
            <span className="smw-card-number">{item.number}</span>
          </div>
          <h3>{item.title}</h3>
          <p>{item.copy}</p>
        </article>
      ))}
    </div>
  );
}
