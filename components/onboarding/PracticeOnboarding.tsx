'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import styles from './onboarding.module.css';

const ONBOARDING_KEY = 'opstriage.practice.onboarding.v1';

export const PracticeOnboarding = () => {
  const [expanded, setExpanded] = useState(false);
  const [preferenceNote, setPreferenceNote] = useState<string | null>(null);
  const interactedRef = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active || interactedRef.current) return;
      try { setExpanded(window.localStorage.getItem(ONBOARDING_KEY) !== 'dismissed'); }
      catch { setExpanded(true); }
    });
    return () => { active = false; };
  }, []);

  const dismiss = () => {
    interactedRef.current = true;
    setExpanded(false);
    try {
      window.localStorage.setItem(ONBOARDING_KEY, 'dismissed');
      setPreferenceNote(null);
    } catch {
      setPreferenceNote('The guide is hidden for this visit. This browser could not save that preference.');
    }
    triggerRef.current?.focus({ preventScroll: true });
  };

  const showGuide = () => {
    interactedRef.current = true;
    setExpanded(true);
    requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
  };

  return (
    <div className={styles.onboarding}>
      <div className={styles.controls}>
        <span>GUIDED PRACTICE / GETTING STARTED</span>
        <button ref={triggerRef} type="button" aria-expanded={expanded} aria-controls="practice-onboarding-guide" onClick={expanded ? dismiss : showGuide}>{expanded ? 'Hide guide' : 'How to practice'} <span aria-hidden="true">{expanded ? '−' : '+'}</span></button>
      </div>
      {expanded && <section id="practice-onboarding-guide" className={styles.guide} aria-labelledby="practice-onboarding-title">
        <div className={styles.intro}><div><p className={styles.eyebrow}>A QUICK ORIENTATION</p><h2 ref={headingRef} tabIndex={-1} id="practice-onboarding-title">Your first investigation</h2></div><p>Everything here is an authored simulation. You can explore a case without connecting a cluster or running commands.</p></div>
        <ol className={styles.steps}>
          <li><span aria-hidden="true">01</span><h3>Inspect, then cite</h3><p>Read the brief and reveal diagnostic results. Select the citation checkbox on the checks that support your diagnosis.</p></li>
          <li><span aria-hidden="true">02</span><h3>Explain the connection</h3><p>Choose a cause and write at least 40 characters explaining why it fits. Hints are available, and your draft saves as you work.</p></li>
          <li><span aria-hidden="true">03</span><h3>Check and reflect</h3><p>Check diagnosis saves an answer snapshot. Review the feedback, keep a note, then try a new run or a related transfer case.</p></li>
        </ol>
        <div className={styles.reviewNote}><strong>A check is a starting point for review.</strong><p>Automatic checks cover the selected answer, evidence, citations, and explanation length. A person needs to review the meaning and quality of your written reasoning.</p></div>
        <div className={styles.footer}><p>Guest progress stays in this browser. Keep a JSON backup if you want to move it.</p><div><Link href="/beta">Read the beta guide <span aria-hidden="true">↗</span></Link><button type="button" onClick={dismiss}>Ready to practice <span aria-hidden="true">→</span></button></div></div>
      </section>}
      {preferenceNote && <p role="status" className={styles.preferenceNote}>{preferenceNote}</p>}
    </div>
  );
};
