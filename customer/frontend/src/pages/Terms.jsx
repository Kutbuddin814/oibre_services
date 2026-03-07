import "../styles/legal-pages.css";

const termsSections = [
  {
    title: "1. Acceptance of Terms",
    text: "By using Oibre, you agree to these Terms of Service. If you do not agree, please do not use the platform."
  },
  {
    title: "2. Platform Role",
    text: "Oibre connects customers with independent service providers. Unless clearly stated, Oibre is not the direct provider of listed services."
  },
  {
    title: "3. Account Responsibilities",
    text: "You must keep your account details accurate and secure. You are responsible for activity that occurs under your account credentials."
  },
  {
    title: "4. Booking and Payments",
    text: "Service scope, time, and final pricing are confirmed between customer and provider. Oibre may provide estimates for convenience only."
  },
  {
    title: "5. Prohibited Use",
    list: [
      "No fraudulent, abusive, or illegal activity.",
      "No attempts to interfere with platform operation or security.",
      "No impersonation, fake reviews, or misleading profile information."
    ]
  },
  {
    title: "6. Suspension and Termination",
    text: "We may suspend or remove accounts that violate these terms, create safety concerns, or misuse platform features."
  },
  {
    title: "7. Limitation of Liability",
    text: "To the extent allowed by law, Oibre is not liable for indirect or consequential losses arising from third-party service delivery."
  },
  {
    title: "8. Updates to Terms",
    text: "We may revise these terms periodically. Continued use of the platform after updates means you accept the revised terms."
  }
];

export default function Terms() {
  return (
    <main className="legal-page">
      <div className="legal-shell">
        <header className="legal-hero">
          <span className="legal-eyebrow">Legal</span>
          <h1>Terms of Service</h1>
          <p>
            These terms explain your rights and responsibilities when using the
            Oibre platform.
          </p>
          <div className="legal-meta">Effective date: March 7, 2026</div>
        </header>

        <section className="legal-content" aria-label="Terms content">
          {termsSections.map((section) => (
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
            Questions about these terms can be sent through the Contact Us page.
          </div>
        </section>
      </div>
    </main>
  );
}
