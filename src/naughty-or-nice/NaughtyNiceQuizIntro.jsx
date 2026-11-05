import HomepageSectionHeading from '../components/HomepageSectionHeading.jsx';
import './checker.css';

export default function NaughtyNiceQuizIntro() {
  return <header className="nn-quiz-intro">
    <div className="nn-quiz-intro-inner">
      <HomepageSectionHeading
        eyebrow="Naughty or Nice?"
        title="Which List are you?"
        subtitle="Head Elf has ten festive questions about kindness, helping out and trying your best. Answer them to find out which of Santa’s lists you’re on this Christmas."
        titleId="nn-quiz-intro-heading"
      />
    </div>
  </header>;
}
