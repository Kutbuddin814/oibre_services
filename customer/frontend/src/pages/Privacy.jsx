import "../styles/legal-pages.css";

const privacySections = [
  {
    title: "1. Information We Collect",
    list: [
      "Account details such as name, email, and phone number.",
      "Location details when you choose current or saved address.",
      "Booking and communication history related to service requests."
    ]
  },
  {
    title: "2. How We Use Your Data",
    list: [
      "To match you with nearby service providers.",
      "To show order updates, notifications, and support details.",
      "To improve reliability, fraud prevention, and user experience."
    ]
  },
  {
    title: "3. Data Sharing",
    text: "We share only the necessary booking details with relevant providers so they can fulfill your service request. We do not sell your personal data."
  },
  {
    title: "4. Data Security",
    text: "We use reasonable technical and operational safeguards to protect account and booking information from unauthorized access."
  },
  {
    title: "5. Your Choices",
    list: [
      "You can update profile information from your account.",
      "You can request correction of inaccurate personal data.",
      "You can contact support for account deletion requests."
    ]
  },
  {
    title: "6. Policy Updates",
    text: "This policy may be updated to reflect new legal or product requirements. Major updates will be posted on this page."
  }
];

export default function Privacy() {
  return (
    <main className="legal-page">
      <div className="legal-shell">
        <header className="legal-hero">
          <span className="legal-eyebrow">Legal</span>
          <h1>Privacy Policy</h1>
          <p>
            This policy explains how Oibre collects, uses, and protects your
            personal information.
          </p>
          <div className="legal-meta">Last reviewed: March 7, 2026</div>
        </header>

        <section className="legal-content" aria-label="Privacy content">
          {privacySections.map((section) => (
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
            For privacy requests, contact support and include the email linked to
            your account.
          </div>
        </section>
      </div>
    </main>
  );
}
