import { useState } from "react";
import "../styles/legal-pages.css";

const faqGroups = [
  {
    title: "Using Oibre",
    items: [
      {
        question: "How do I book a service?",
        answer:
          "Search for a service from the home page, choose a provider, and place your request. You can track status updates in My Orders."
      },
      {
        question: "Do I need an account to book?",
        answer:
          "Yes. You need a customer account so we can save your location, booking history, and service preferences securely."
      },
      {
        question: "Can I cancel a request?",
        answer:
          "You can cancel a pending request from My Orders. If work has already started, cancellation may depend on provider policy and timeline."
      }
    ]
  },
  {
    title: "Payments and Support",
    items: [
      {
        question: "How do payments work?",
        answer:
          "Final payment terms are agreed between customer and provider. Oibre may show estimates, but final pricing depends on scope and materials."
      },
      {
        question: "What if I face an issue with a provider?",
        answer:
          "Use Contact Us and include your order details. Our team reviews cases, verifies timelines, and helps both parties with next steps."
      },
      {
        question: "How quickly can I get support?",
        answer:
          "Most support queries are reviewed within one business day. Urgent safety concerns are prioritized faster."
      }
    ]
  }
];

export default function FAQ() {
  const [openKey, setOpenKey] = useState("0-0");

  return (
    <main className="legal-page">
      <div className="legal-shell">
        <header className="legal-hero">
          <span className="legal-eyebrow">Support</span>
          <h1>Frequently Asked Questions</h1>
          <p>
            Quick answers to common customer questions about booking, support, and
            account usage.
          </p>
          <div className="legal-meta">Last updated: March 7, 2026</div>
        </header>

        <section className="legal-content" aria-label="FAQ content">
          {faqGroups.map((group, groupIndex) => (
            <section className="legal-section" key={group.title}>
              <h2>{group.title}</h2>
              <div className="faq-list">
                {group.items.map((item, itemIndex) => {
                  const key = `${groupIndex}-${itemIndex}`;
                  const isOpen = openKey === key;

                  return (
                    <article className="faq-item" key={item.question}>
                      <button
                        type="button"
                        className="faq-question"
                        onClick={() => setOpenKey(isOpen ? "" : key)}
                        aria-expanded={isOpen}
                      >
                        <span>{item.question}</span>
                        <span>{isOpen ? "-" : "+"}</span>
                      </button>
                      {isOpen && <p className="faq-answer">{item.answer}</p>}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}

          <div className="legal-note">
            Still need help? Reach us from the Contact Us page and mention your order
            ID for faster assistance.
          </div>
        </section>
      </div>
    </main>
  );
}
