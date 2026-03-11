"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";

const DOWNLOAD_URL = "/yt-video-filter.zip";

const features = [
  {
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
        <path d="M8 11h6" />
      </svg>
    ),
    title: "Custom Regex Filters",
    description:
      "Write pattern rules to match titles, channels, or metadata. Block shorts, live streams, ads, mixes, and playables by content type.",
  },
  {
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93" />
        <path d="M8.24 4.77A4 4 0 0 0 8 6c0 1.95 1.4 3.58 3.25 3.93" />
        <path d="M12 10v4" />
        <path d="m4.5 15.5 3-1.5" />
        <path d="m19.5 15.5-3-1.5" />
        <path d="M9 18h6" />
        <path d="m6 22 3-4" />
        <path d="m18 22-3-4" />
      </svg>
    ),
    title: "ML Classification",
    description:
      "Optional AI-powered filtering runs in-browser via transformers.js or routes to your own server. Catches clickbait and toxic patterns automatically.",
  },
  {
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    title: "Fast & Private",
    description:
      "Everything runs in your browser. No data leaves your machine unless you opt-in to server-side classification. Zero tracking, zero telemetry.",
  },
];

const steps = [
  {
    title: "Download the extension",
    description:
      "Grab the latest zip file using the button above. Unzip it anywhere on your computer — you'll get a folder with all the extension files.",
  },
  {
    title: "Open Chrome Extensions",
    description: (
      <>
        Navigate to <code>chrome://extensions</code> in your browser&apos;s
        address bar.
      </>
    ),
  },
  {
    title: "Enable Developer Mode",
    description:
      "Find the Developer mode toggle in the top-right corner of the extensions page and switch it on.",
  },
  {
    title: "Load the extension",
    description:
      'Click "Load unpacked" in the top-left, then select the unzipped folder you downloaded in step 1.',
  },
  {
    title: "You're all set",
    description:
      "Head to YouTube. Click the extension icon in your toolbar to configure filters and start cleaning up your feed.",
  },
];

function DownloadIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  }),
};

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <main>
      {/* ─── Hero ─── */}
      <div className="hero">
        <div
          className={`hero-badge fade-in ${mounted ? "visible" : ""}`}
          style={{ animationDelay: "0s" }}
        >
          <span className="dot" />
          Chrome Extension v2.1
        </div>

        <h1
          className={`fade-in ${mounted ? "visible" : ""}`}
          style={{ animationDelay: "0.1s" }}
        >
          YT Video
          <br />
          <em>Filter</em>
        </h1>

        <p
          className={`hero-sub fade-in ${mounted ? "visible" : ""}`}
          style={{ animationDelay: "0.25s" }}
        >
          Take control of your YouTube feed. Filter out clickbait, shorts, ads,
          and toxic content with regex patterns and ML&#8209;powered
          classification.
        </p>

        <div
          className={`hero-actions fade-in ${mounted ? "visible" : ""}`}
          style={{ animationDelay: "0.4s" }}
        >
          <a className="btn-primary" href={DOWNLOAD_URL} download>
            <DownloadIcon />
            Download Extension
          </a>
          <a className="btn-secondary" href="#install">
            Install Guide
            <ArrowIcon />
          </a>
        </div>
      </div>

      {/* ─── Features ─── */}
      <section>
        <div className="features">
          <motion.div
            className="features-header"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={fadeUp}
            custom={0}
          >
            <span className="section-label">Features</span>
            <h2 className="section-title">
              Everything you need,
              <br />
              nothing you don&rsquo;t
            </h2>
            <p className="section-desc">
              A focused toolkit to cut through YouTube&rsquo;s noise.
            </p>
          </motion.div>

          <div className="features-grid">
            {features.map((feature, i) => (
              <motion.div
                className="feature-card"
                key={feature.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-40px" }}
                variants={fadeUp}
                custom={i + 1}
              >
                <div className="feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Install Steps ─── */}
      <section id="install">
        <div className="steps">
          <motion.div
            className="steps-header"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={fadeUp}
            custom={0}
          >
            <span className="section-label">Installation</span>
            <h2 className="section-title">Up and running in one minute</h2>
            <p className="section-desc">
              No developer knowledge required. Five simple steps and
              you&rsquo;re done.
            </p>
          </motion.div>

          {steps.map((step, i) => (
            <motion.div
              className="step"
              key={step.title}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-20px" }}
              variants={fadeUp}
              custom={i}
            >
              <div className="step-number">{i + 1}</div>
              <div className="step-content">
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── Bottom CTA ─── */}
      <section className="cta">
        <div className="cta-glow" />
        <motion.span
          className="section-label"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={0}
        >
          Ready?
        </motion.span>
        <motion.h2
          className="section-title"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={1}
        >
          Clean up your feed
        </motion.h2>
        <motion.p
          className="section-desc"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={2}
        >
          Download the extension and start filtering today.
        </motion.p>
        <motion.a
          className="btn-primary"
          href={DOWNLOAD_URL}
          download
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={3}
        >
          <DownloadIcon />
          Download Extension
        </motion.a>
      </section>

      {/* ─── Footer ─── */}
      <footer className="footer">
        YT Video Filter &middot; Open source &middot;{" "}
        <a
          href="https://github.com/swiftugandan/yt-filter-extension"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
      </footer>
    </main>
  );
}
