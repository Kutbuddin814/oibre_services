import "../styles/legal-pages.css";

const cookieSections = [
  {
    title: "1. What Are Cookies",
    text: "Cookies are small text files stored in your browser that help websites remember your preferences and improve performance."
  },
  {
    title: "2. Cookies We Use",
    list: [
      "Essential cookies for login session and account security.",
      "Preference cookies to remember settings like selected location.",
      "Analytics cookies to understand feature usage and improve product quality."
    ]
  },
  {
    title: "3. Why We Use Cookies",
    text: "Cookies help us keep you signed in, reduce repeated steps, and improve the speed and reliability of core features."
  },
  {
    title: "4. Managing Cookies",
    list: [
      "You can clear or block cookies from browser settings.",
      "Blocking essential cookies may affect sign-in and booking functionality.",
      "You can review this policy regularly for cookie updates."
    ]
  },
  {
    title: "5. Policy Changes",
    text: "If we introduce new cookie categories, we will update this page with clear explanations."
  }
];

export default function Cookies() {
  return (
    <main className="legal-page">
      <div className="legal-shell">
        <header className="legal-hero">
          <span className="legal-eyebrow">Legal</span>
          <h1>Cookie Policy</h1>
          <p>
            Learn what cookies are, how Oibre uses them, and how you can manage
            cookie preferences.
          </p>
          <div className="legal-meta">Effective date: March 7, 2026</div>
        </header>

        <section className="legal-content" aria-label="Cookie policy content">
          {cookieSections.map((section) => (
            <section className="legal-section" key={section.title}>
              <h2>{section.title}</h2>
              {section.text && <p>{section.text}</p>}
              {section.list && (
                <ul>
                  {section.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <div className="legal-note">
            You can manage browser cookie settings at any time from your browser
            privacy controls.
          </div>
        </section>
      </div>
    </main>
  );
}
