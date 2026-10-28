import Link from 'next/link';
import { BASE_PRACTICE_SCENARIOS, PRACTICE_SCENARIOS } from '@/lib/practice';
import styles from './landing.module.css';

const learningSteps = [
  { number: '01', title: 'Inspect the signals', description: 'Read a short incident brief. Reveal simulated diagnostic output and use hints when you need a nudge.' },
  { number: '02', title: 'Make your case', description: 'Choose a diagnosis, cite supporting checks, and explain how the evidence connects to your answer.' },
  { number: '03', title: 'Revisit the reasoning', description: 'Review the authored debrief, keep a note, and try a transfer case with a different failure mechanism.' },
];

export const LandingPage = () => {
  const coreCount = BASE_PRACTICE_SCENARIOS.length;
  const transferCount = PRACTICE_SCENARIOS.length - coreCount;
  return (
    <div className={styles.landing}>
      <a className={styles.skip} href="#landing-content">Skip to content</a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand} aria-label="OpsTriage home"><span aria-hidden="true">&gt;_</span>OpsTriage</Link>
          <nav aria-label="Main navigation" className={styles.nav}><a href="#how-it-works">How it works</a><Link href="/beta">Beta guide</Link><Link href="/practice#account">Sign in</Link><Link className={styles.navStart} href="/practice">Open practice <span aria-hidden="true">↗</span></Link></nav>
        </div>
      </header>
      <main id="landing-content">
        <section className={styles.hero} aria-labelledby="landing-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}><span aria-hidden="true" />KUBERNETES / GUIDED PRACTICE</p>
            <h1 id="landing-title">Read the signals.<br />Explain <em>the cause.</em></h1>
            <p className={styles.intro}>A practice room for the first few minutes of an incident. Work through authored Kubernetes cases, collect evidence, and put your reasoning into words.</p>
            <div className={styles.heroActions}><Link className={styles.primary} href="/practice">Start free as a guest <span aria-hidden="true">→</span></Link><a className={styles.secondary} href="#how-it-works">See how it works <span aria-hidden="true">↓</span></a></div>
            <p className={styles.guestNote}>Browser-based. No cluster setup or account required.</p>
            <div className={styles.heroFacts}><span><strong>{coreCount}</strong> core cases</span><span><strong>{transferCount}</strong> transfer cases</span><span><strong>Your</strong> practice notebook</span></div>
          </div>
          <figure className={styles.investigationPreview}>
            <div className={styles.previewBar}><span><i /><i /><i /></span><p>practice / report-worker</p><b>SIMULATED</b></div>
            <div className={styles.previewBody}>
              <p className={styles.previewEyebrow}>A FIRST LOOK AT THE INCIDENT</p>
              <h2>The worker keeps restarting.</h2>
              <p className={styles.previewDescription}>The jobs are delayed. The restart count is climbing. Where would you look next?</p>
              <div className={styles.logLabel}><span>Initial evidence</span><span>AUTHORED EXCERPT</span></div>
              <pre className={styles.log}>{'Namespace: practice\nPod: report-worker-7c8d9\n\nREADY  STATUS            RESTARTS\n0/1    CrashLoopBackOff   5'}</pre>
              <div className={styles.nextCheck}><span className={styles.checkIcon} aria-hidden="true">⌕</span><div><strong>Inspect the previous termination</strong><p>A restart is a symptom. Find the evidence behind it.</p></div><span aria-hidden="true">↗</span></div>
            </div>
            <figcaption>An example investigation. Commands are displayed as learning material; nothing is executed.</figcaption>
          </figure>
        </section>
        <div className={styles.boundaryStrip}><p><span aria-hidden="true">◇</span> Authored evidence, with links to Kubernetes documentation.</p><p><span aria-hidden="true">◇</span> Guest practice stays on your device.</p><p><span aria-hidden="true">◇</span> Written reasoning needs human review.</p></div>
        <section id="how-it-works" className={styles.section} aria-labelledby="method-title">
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>THE INVESTIGATION LOOP</p><h2 id="method-title">A little structure<br />for a messy moment.</h2></div><p>For individual DevOps engineers and learners who want to practice the steps of an investigation.</p></div>
          <div className={styles.steps}>{learningSteps.map((step) => <article key={step.number}><span className={styles.stepNumber}>{step.number}</span><h3>{step.title}</h3><p>{step.description}</p></article>)}</div>
          <p className={styles.gradingNote}>Automated checks cover your selected diagnosis, required evidence, citations, and explanation length. They do not assess the quality of your explanation or certify operational readiness.</p>
        </section>
        <section className={styles.section} aria-labelledby="cases-title">
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>INSIDE THE LIBRARY</p><h2 id="cases-title">Familiar symptoms.<br />Different explanations.</h2></div><Link className={styles.inlineLink} href="/practice">Explore all {coreCount + transferCount} cases <span aria-hidden="true">→</span></Link></div>
          <div className={styles.caseGrid}>{BASE_PRACTICE_SCENARIOS.slice(0, 3).map((scenario, index) => <article className={styles.caseCard} key={scenario.id}><div className={styles.caseMeta}><span>CASE {String(index + 1).padStart(2, '0')}</span><span>{scenario.difficulty}</span></div><span className={styles.caseSymbol} aria-hidden="true">{['↻', '⇄', '↓'][index]}</span><h3>{scenario.title}</h3><p>{scenario.summary}</p><div className={styles.caseTime}>About {scenario.estimatedMinutes} minutes <span aria-hidden="true">·</span> Guided simulation</div></article>)}</div>
          <div className={styles.libraryNote}><span aria-hidden="true">↗</span><p>Each core case has a related transfer case. Expect a changed signal or cause, then investigate again.</p></div>
        </section>
        <section className={styles.notebookSection} aria-labelledby="notebook-feature-title">
          <div><p className={styles.eyebrow}>KEEP THE TRAIL</p><h2 id="notebook-feature-title">Your thinking deserves<br />a notebook.</h2><p>Keep separate runs, notes, hints, and submitted-answer history. Return to a case without overwriting the path you took before.</p><Link className={styles.inlineLink} href="/practice">Make your first field note <span aria-hidden="true">→</span></Link></div>
          <ul className={styles.notebookFeatures}><li><span>01</span><div><h3>Start with local practice</h3><p>Your guest notebook lives in this browser. Search it by case title, notes, or written reasoning.</p></div></li><li><span>02</span><div><h3>Take a backup with you</h3><p>Export a readable Markdown report or a restorable JSON backup. Import a file or paste your JSON.</p></div></li><li><span>03</span><div><h3>Choose what to share</h3><p>On configured deployments, email accounts and explicit cloud sync are optional. Signing in alone does not upload your notebook.</p></div></li></ul>
        </section>
        <section className={styles.faqSection} aria-labelledby="faq-title"><div><p className={styles.eyebrow}>BEFORE YOU START</p><h2 id="faq-title">A few clear boundaries.</h2></div><div className={styles.faqList}>
          <details><summary>Will this connect to my cluster?</summary><p>No. Cases use authored terminal excerpts. OpsTriage does not run commands, connect to infrastructure, or perform remediation.</p></details>
          <details><summary>Do I need an account?</summary><p>You can start free as a guest. An email account is optional where configured, and cloud upload or merge requires a separate action.</p></details>
          <details><summary>Does the app grade my explanation?</summary><p>It checks that you supplied a minimum-length explanation. The meaning and quality need review by you, a peer, or a facilitator. These exercises are for self-study, not certification.</p></details>
          <details><summary>What happens to my practice data?</summary><p>Guest practice is stored in this browser. Optional usage counts require consent and do not include answer or notes text. Cloud sync sends your notebook only when you explicitly choose it. Read the <Link href="/beta">beta guide</Link> for the details.</p></details>
        </div></section>
        <section className={styles.finalInvite} aria-labelledby="invite-title"><p className={styles.eyebrow}>YOUR NEXT INVESTIGATION</p><h2 id="invite-title">Start with a signal.<br />Follow the evidence.</h2><Link className={styles.primary} href="/practice">Start free as a guest <span aria-hidden="true">→</span></Link><p>No account required. Your first case is waiting in the library.</p></section>
      </main>
      <footer className={styles.footer}><Link href="/" className={styles.footerBrand}>OpsTriage <span>/ learner beta</span></Link><p>Guided practice. Authored evidence. Your own reasoning.</p><Link href="/beta">Beta guide & data choices <span aria-hidden="true">↗</span></Link></footer>
    </div>
  );
};
