import Link from 'next/link';
import type { Metadata } from 'next';
import styles from './beta.module.css';

export const metadata: Metadata = {
  title: 'Beta guide | OpsTriage',
  description: 'How to use OpsTriage practice, protect your notebook, and take part in a learner pilot.',
};

export default function BetaGuide() {
  return (
    <main className={styles.guide}>
      <Link className={styles.back} href="/practice">← Back to practice</Link>
      <p className={styles.eyebrow}>OPSTRIAGE / LEARNER BETA</p>
      <h1>Learn from the evidence.</h1>
      <p className={styles.intro}>Ten core Kubernetes cases and ten related transfer cases for individual DevOps engineers and learners. Start free as a guest, with no cluster setup or account required.</p>
      <section>
        <h2>Your first investigation</h2>
        <ol>
          <li>Open a core case and read its brief. The terminal output is authored simulation data.</li>
          <li>Reveal diagnostic results, then cite the checks that support your diagnosis.</li>
          <li>Choose a hypothesis and explain the connection in your own words. Submit to see feedback.</li>
          <li>Review the debrief, save a useful note, and try the related transfer case without hints.</li>
        </ol>
        <p>Completion checks your selected answer, required evidence, citations, and explanation length. The app does not judge the meaning or quality of your written reasoning. A peer or facilitator can review that separately. These cases are for self-study, not a certification score.</p>
      </section>
      <section>
        <h2>Keep your notebook safe</h2>
        <p>Guest notes, evidence selections, hints, and submission history are stored in this browser on this site. OpsTriage does not encrypt this local storage. A different browser, profile, or site address has a different notebook. An optional cloud copy is separate from this local copy.</p>
        <p>Export a JSON backup before clearing browser data or moving devices. Import a file or paste the complete JSON; supported runs are merged and skipped records are reported. Markdown is a readable report; JSON is the restore format. If downloads or clipboard access are blocked, use the export preview and Select all to copy manually.</p>
        <p>If another tab changes the device notebook, saving pauses to avoid overwriting that tab. You can export the work still held in the current tab before reloading. Damaged or incompatible saved data is preserved for recovery instead of being silently replaced.</p>
        <p>Use synthetic information only. Do not paste credentials, employer logs, customer details, or private infrastructure information into notes or explanations.</p>
      </section>
      <section>
        <h2>Optional accounts and cloud copies</h2>
        <p>Some deployments enable Supabase email-and-password accounts. Email confirmation may be required. You can keep using guest practice without signing in, and signing in alone does not upload or merge your notebook.</p>
        <ol>
          <li><strong>Check cloud notebook</strong> fetches the account&apos;s cloud snapshot so you can inspect its availability.</li>
          <li><strong>Merge cloud into this device</strong> explicitly merges supported cloud runs into this browser&apos;s notebook.</li>
          <li><strong>Upload device notebook</strong> sends your saved local runs, including notes, written reasoning, hints, and answer history, to the account&apos;s cloud copy. An existing cloud copy must first be checked and merged.</li>
        </ol>
        <p>If the cloud copy changes, check and merge it again before uploading. Review the device notebook before sending it to an account, especially on a shared browser. Signing out leaves the local notebook in place.</p>
        <p>Removing a local run does not delete a cloud copy or an exported file. This beta has no in-app cloud-deletion control; contact the project operator about removing account or cloud data. Cloud features are unavailable on deployments where they have not been configured.</p>
      </section>
      <section>
        <h2>Optional usage counts</h2>
        <p>Usage counts are off by default. Where collection is configured, you can explicitly allow events for a case start, a case completion, or an approximate return visit on a later day. Case events include a case identifier, and events have a random event identifier.</p>
        <p>These event payloads do not contain account identifiers, email addresses, notes, written reasoning, or notebook contents. They are sent without your signed-in session. A local date helps avoid counting the same day repeatedly; the app does not create a visitor profile for these counts.</p>
        <p>Turning collection off stops future events and clears the local visit date. Past counts cannot be identified as yours for deletion. The collection control is disabled where the service is not configured. Usage counts are approximate and do not establish learning outcomes.</p>
      </section>
      <section>
        <h2>Other data choices</h2>
        <p>The practice workflow does not send evidence to an AI provider. Your notebook leaves this browser when you explicitly upload a cloud copy or share an export. Hosting and service providers may record ordinary network requests, including IP addresses; their retention depends on their configuration. External documentation links open those providers&apos; sites.</p>
        <p>Sharing an exported notebook is your choice. Review its notes and explanations before sending it to anyone. Removing a local run does not remove files you already exported.</p>
      </section>
      <section>
        <h2>Help evaluate the beta</h2>
        <p>If the project owner invites you to a pilot, agree on a session time and any recording separately. Participation is optional. You can stop or skip a question. Use a participant alias and share only the practice work you choose.</p>
        <p>Useful feedback includes the case title, your browser, what you expected, what happened, and the step that was confusing. Contact the person who invited you. Please keep private data out of screenshots and exports.</p>
        <p>The pilot will evaluate whether evidence-based explanations improve on an unfamiliar case. Learner outcomes and willingness to pay have not yet been established.</p>
      </section>
      <section>
        <h2>Current limits</h2>
        <p>This is a guided simulator. Commands shown in cases are not executed. There are no live clusters, AWS cases, payments, or automatic remediation. Content is referenced to Kubernetes documentation; a practitioner review and learner pilot are still needed to evaluate the material and the learning experience.</p>
        <p>The earlier free-text runbook generator is retired. Its API returns a retirement message and does not process submitted evidence.</p>
      </section>
      <Link className={styles.start} href="/practice">Open the practice library →</Link>
    </main>
  );
}
