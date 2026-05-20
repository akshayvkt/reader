'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, Sparkles, Moon, FileText, ChevronDown, Download, Apple } from 'lucide-react';

// Windows icon component since Lucide doesn't have one
const WindowsIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
  </svg>
);

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);

  const features = [
    {
      icon: Sparkles,
      title: 'AI-Powered Understanding',
      description: 'Highlight any passage for instant explanations. Want to go deeper? Expand into a chat to ask follow-up questions with full chapter or book context.',
    },
    {
      icon: FileText,
      title: 'Beautiful EPUB Reading',
      description: 'Your entire library in one place. Import any EPUB and start reading immediately.',
    },
    {
      icon: Moon,
      title: 'Comfortable Reading',
      description: 'Dark mode, adjustable fonts, and a distraction-free interface designed for long reading sessions.',
    },
  ];

  const faqs = [
    {
      question: 'Is Simple Reader really free?',
      answer: 'Yes, completely free. No account, no subscriptions, no hidden costs, no ads.',
    },
    {
      question: 'What file formats are supported?',
      answer: 'Simple Reader supports EPUB files. Just drag and drop your books into the app or use the file picker to import them.',
    },
    {
      question: 'How does the AI explanation work?',
      answer: 'Highlight any text to get an instant explanation. If you want to explore further, expand into a dedicated chat where you can ask follow-up questions. You can even give the AI context from the full chapter or entire book for deeper understanding.',
    },
    {
      question: 'Is my reading data private?',
      answer: 'Your books stay on your device. When you request an explanation, only that specific passage is sent to generate the response. We don\'t store your books or reading history on any server.',
    },
    {
      question: 'Which platforms are supported?',
      answer: 'Simple Reader is available for macOS and Windows. Both versions have the same features and reading experience.',
    },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Subtle grain texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col justify-center px-6 py-20">
        <div className="max-w-4xl mx-auto text-center animate-fade-in">
          {/* Logo/Icon */}
          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-8 animate-fade-in-up"
            style={{
              background: 'var(--accent-subtle)',
              animationDelay: '0.1s',
              animationFillMode: 'backwards',
            }}
          >
            <BookOpen
              className="w-10 h-10"
              style={{ color: 'var(--accent)' }}
              strokeWidth={1.5}
            />
          </div>

          {/* Headline */}
          <h1
            className="text-5xl md:text-7xl font-normal mb-6 leading-tight animate-fade-in-up"
            style={{
              fontFamily: 'var(--font-libre-baskerville)',
              color: 'var(--foreground)',
              animationDelay: '0.2s',
              animationFillMode: 'backwards',
            }}
          >
            Read deeply.<br />
            <span style={{ color: 'var(--accent)' }}>Understand fully.</span>
          </h1>

          {/* Subheadline */}
          <p
            className="text-xl md:text-2xl max-w-2xl mx-auto mb-12 leading-relaxed animate-fade-in-up"
            style={{
              color: 'var(--foreground-muted)',
              animationDelay: '0.3s',
              animationFillMode: 'backwards',
            }}
          >
            A calm, focused reader with AI that explains complex passages instantly.
            No more tab-switching, no more losing your place.
          </p>

          {/* CTA Buttons */}
          <div
            className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in-up"
            style={{
              animationDelay: '0.4s',
              animationFillMode: 'backwards',
            }}
          >
            {/* Primary: Start reading in browser */}
            <Link
              href="/"
              className="group flex items-center gap-3 px-8 py-4 rounded-xl text-lg font-medium transition-all duration-300 hover:scale-105"
              style={{
                background: 'var(--foreground)',
                color: 'var(--background)',
              }}
            >
              Start reading
            </Link>

            {/* Secondary: Download app with dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowDownloadOptions(!showDownloadOptions)}
                className="group flex items-center gap-3 px-8 py-4 rounded-xl text-lg font-medium transition-all duration-300 hover:scale-105"
                style={{
                  background: 'var(--surface)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                }}
              >
                <Download className="w-5 h-5" />
                Download app
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${showDownloadOptions ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Dropdown */}
              {showDownloadOptions && (
                <div
                  className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden shadow-lg animate-fade-in"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <a
                    href="https://github.com/AkshayPall/reader/releases/latest"
                    className="flex items-center gap-3 px-6 py-3 transition-colors"
                    style={{ color: 'var(--foreground)' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--background-muted)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <Apple className="w-5 h-5" />
                    macOS
                  </a>
                  <a
                    href="https://github.com/AkshayPall/reader/releases/latest"
                    className="flex items-center gap-3 px-6 py-3 transition-colors"
                    style={{
                      color: 'var(--foreground)',
                      borderTop: '1px solid var(--border-subtle)',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--background-muted)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <WindowsIcon />
                    Windows
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Free badge */}
          <p
            className="mt-6 text-sm animate-fade-in-up"
            style={{
              color: 'var(--foreground-subtle)',
              animationDelay: '0.5s',
              animationFillMode: 'backwards',
            }}
          >
            Free to use. Sign in with Google to get started.
          </p>
        </div>

        {/* Scroll indicator */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce"
          style={{ color: 'var(--foreground-subtle)' }}
        >
          <ChevronDown className="w-6 h-6" />
        </div>
      </section>

      {/* App Preview Section */}
      <section className="relative px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{
              background: 'var(--surface)',
              boxShadow: '0 25px 50px -12px rgba(45, 42, 38, 0.15)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {/* Mock window chrome */}
            <div
              className="flex items-center gap-2 px-4 py-3"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
            >
              <div className="w-3 h-3 rounded-full" style={{ background: '#FF5F57' }} />
              <div className="w-3 h-3 rounded-full" style={{ background: '#FFBD2E' }} />
              <div className="w-3 h-3 rounded-full" style={{ background: '#28CA41' }} />
            </div>

            {/* App screenshot placeholder */}
            <div
              className="aspect-[16/10] flex items-center justify-center"
              style={{ background: 'var(--background-muted)' }}
            >
              <div className="text-center px-8">
                <BookOpen
                  className="w-16 h-16 mx-auto mb-4"
                  style={{ color: 'var(--foreground-subtle)' }}
                  strokeWidth={1}
                />
                <p
                  className="text-lg"
                  style={{
                    fontFamily: 'var(--font-libre-baskerville)',
                    color: 'var(--foreground-muted)',
                  }}
                >
                  Your reading sanctuary
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative px-6 py-24">
        <div className="max-w-4xl mx-auto">
          <h2
            className="text-3xl md:text-4xl text-center mb-16"
            style={{
              fontFamily: 'var(--font-libre-baskerville)',
              color: 'var(--foreground)',
            }}
          >
            Reading, refined
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group p-8 rounded-2xl transition-all duration-300 hover:scale-105"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div
                  className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-6 transition-colors duration-300"
                  style={{ background: 'var(--accent-subtle)' }}
                >
                  <feature.icon
                    className="w-6 h-6 transition-colors duration-300"
                    style={{ color: 'var(--accent)' }}
                    strokeWidth={1.5}
                  />
                </div>
                <h3
                  className="text-xl mb-3"
                  style={{
                    fontFamily: 'var(--font-libre-baskerville)',
                    color: 'var(--foreground)',
                  }}
                >
                  {feature.title}
                </h3>
                <p
                  className="leading-relaxed"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section
        className="relative px-6 py-24"
        style={{ background: 'var(--surface)' }}
      >
        <div className="max-w-4xl mx-auto">
          <h2
            className="text-3xl md:text-4xl text-center mb-16"
            style={{
              fontFamily: 'var(--font-libre-baskerville)',
              color: 'var(--foreground)',
            }}
          >
            Simple by design
          </h2>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              { step: '1', title: 'Add your book', desc: 'Drag and drop any EPUB file' },
              { step: '2', title: 'Start reading', desc: 'A clean, focused reading experience' },
              { step: '3', title: 'Highlight to understand', desc: 'Select text, get instant explanations' },
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div
                  className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-6 text-2xl"
                  style={{
                    fontFamily: 'var(--font-libre-baskerville)',
                    background: 'var(--accent)',
                    color: 'white',
                  }}
                >
                  {item.step}
                </div>
                <h3
                  className="text-xl mb-2"
                  style={{
                    fontFamily: 'var(--font-libre-baskerville)',
                    color: 'var(--foreground)',
                  }}
                >
                  {item.title}
                </h3>
                <p style={{ color: 'var(--foreground-muted)' }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="relative px-6 py-24">
        <div className="max-w-2xl mx-auto">
          <h2
            className="text-3xl md:text-4xl text-center mb-16"
            style={{
              fontFamily: 'var(--font-libre-baskerville)',
              color: 'var(--foreground)',
            }}
          >
            Questions & answers
          </h2>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="rounded-xl overflow-hidden transition-all duration-300"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-6 text-left transition-colors duration-200"
                  style={{ color: 'var(--foreground)' }}
                >
                  <span
                    className="text-lg pr-4"
                    style={{ fontFamily: 'var(--font-libre-baskerville)' }}
                  >
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 ${openFaq === index ? 'rotate-180' : ''}`}
                    style={{ color: 'var(--foreground-muted)' }}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${openFaq === index ? 'max-h-48' : 'max-h-0'}`}
                >
                  <p
                    className="px-6 pb-6 leading-relaxed"
                    style={{ color: 'var(--foreground-muted)' }}
                  >
                    {faq.answer}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section
        id="download"
        className="relative px-6 py-24"
        style={{ background: 'var(--surface)' }}
      >
        <div className="max-w-2xl mx-auto text-center">
          <h2
            className="text-3xl md:text-4xl mb-6"
            style={{
              fontFamily: 'var(--font-libre-baskerville)',
              color: 'var(--foreground)',
            }}
          >
            Start reading better today
          </h2>
          <p
            className="text-lg mb-10"
            style={{ color: 'var(--foreground-muted)' }}
          >
            Free to use. No sign-in needed.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {/* Primary: Start reading in browser */}
            <Link
              href="/"
              className="group flex items-center gap-3 px-8 py-4 rounded-xl text-lg font-medium transition-all duration-300 hover:scale-105"
              style={{
                background: 'var(--foreground)',
                color: 'var(--background)',
              }}
            >
              Start reading
            </Link>

            {/* Secondary: Download links */}
            <div className="flex gap-3">
              <a
                href="https://github.com/AkshayPall/reader/releases/latest"
                className="flex items-center gap-2 px-6 py-4 rounded-xl font-medium transition-all duration-300 hover:scale-105"
                style={{
                  background: 'var(--background)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                }}
              >
                <Apple className="w-5 h-5" />
                Mac
              </a>
              <a
                href="https://github.com/AkshayPall/reader/releases/latest"
                className="flex items-center gap-2 px-6 py-4 rounded-xl font-medium transition-all duration-300 hover:scale-105"
                style={{
                  background: 'var(--background)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                }}
              >
                <WindowsIcon />
                Windows
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative px-6 py-12">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <BookOpen
              className="w-5 h-5"
              style={{ color: 'var(--foreground-muted)' }}
              strokeWidth={1.5}
            />
            <span
              className="text-sm"
              style={{ color: 'var(--foreground-muted)' }}
            >
              Simple Reader
            </span>
          </div>
          <div
            className="flex items-center gap-6 text-sm"
            style={{ color: 'var(--foreground-subtle)' }}
          >
            <a
              href="https://github.com/yourusername/reader"
              className="hover:underline transition-colors"
              style={{ color: 'var(--foreground-muted)' }}
            >
              GitHub
            </a>
            <span>Made with care</span>
          </div>
        </div>
      </footer>

      {/* Animations */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fadeIn 0.8s ease-out forwards;
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.8s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
