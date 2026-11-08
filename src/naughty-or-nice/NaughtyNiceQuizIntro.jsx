import HomepageSectionHeading from '../components/HomepageSectionHeading.jsx';
import './checker.css';

export default function NaughtyNiceQuizIntro() {
  return <header className="nn-quiz-intro">
    <div className="nn-quiz-intro-inner">
      <HomepageSectionHeading
        eyebrow="Naughty or Nice?"
        title="WHICH LIST ARE YOU ON?"
        subtitle="Let Head Elf find out which list he thinks you really should be on."
        titleId="nn-quiz-intro-heading"
      />
    </div>
  </header>;
}
