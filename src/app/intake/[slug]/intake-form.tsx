"use client";

import { useEffect, useState } from "react";

const PIN_LENGTH = 4;

const DELAY_OPTIONS = [
  { label: "Instantly", value: 0 },
  { label: "5 min", value: 5 },
  { label: "10 min", value: 10 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "1 hour", value: 60 },
  { label: "2 hours", value: 120 },
];

interface Client {
  name: string;
  slug: string;
  logo_url: string | null;
  brand_color: string;
}

interface Props {
  client: Client;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;

function parseClipboard(text: string): { name?: string; email?: string; phone?: string } {
  const emailMatch = text.match(EMAIL_RE);
  const email = emailMatch?.[0];
  const phoneMatch = text.match(PHONE_RE);
  const phone = phoneMatch?.[0]?.trim();

  let remaining = text;
  if (email) remaining = remaining.replace(email, " ");
  if (phone) remaining = remaining.replace(phone, " ");

  const cleaned = remaining
    .replace(/name[:\-]?/gi, " ")
    .replace(/email[:\-]?/gi, " ")
    .replace(/phone[:\-]?/gi, " ")
    .replace(/customer[:\-]?/gi, " ")
    .replace(/[\r\n\t,;|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const name = cleaned.length >= 2 && cleaned.length <= 60 ? cleaned : undefined;
  return { name, email, phone };
}

export default function IntakeForm({ client }: Props) {
  const sessionKey = `intake_pin_${client.slug}`;

  const [authenticated, setAuthenticated] = useState(false);
  const [verifiedPin, setVerifiedPin] = useState("");
  const [pinDigits, setPinDigits] = useState<string[]>([]);
  const [pinError, setPinError] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [delayMinutes, setDelayMinutes] = useState(45);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedDelay, setSubmittedDelay] = useState(0);
  const [error, setError] = useState("");
  const [pasteFlash, setPasteFlash] = useState("");

  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  const blue = client.brand_color || "#1e3a8a";
  const red = "#dc2626";

  // Restore PIN from session on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(sessionKey);
      if (saved && saved.length === PIN_LENGTH) {
        setVerifiedPin(saved);
        setAuthenticated(true);
      }
    } catch {}
  }, [sessionKey]);

  // PWA install detection
  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    const iOS = /iphone|ipad|ipod/.test(ua) && !/crios|fxios/.test(ua);
    setIsIOS(iOS);

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function verifyPin(digits: string[]) {
    const pin = digits.join("");
    if (pin.length !== PIN_LENGTH) return;

    setPinLoading(true);
    setPinError("");

    try {
      const res = await fetch("/api/intake/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, slug: client.slug }),
      });

      if (res.ok) {
        setVerifiedPin(pin);
        setAuthenticated(true);
        try {
          sessionStorage.setItem(sessionKey, pin);
        } catch {}
      } else {
        setPinError("Invalid PIN");
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setPinDigits([]);
        }, 500);
      }
    } catch {
      setPinError("Something went wrong");
    }

    setPinLoading(false);
  }

  function handleNumberPad(num: string) {
    if (pinLoading) return;
    setPinError("");
    const newDigits = [...pinDigits, num];
    setPinDigits(newDigits);
    if (newDigits.length === PIN_LENGTH) verifyPin(newDigits);
  }

  function handleBackspace() {
    if (pinLoading) return;
    setPinError("");
    setPinDigits((prev) => prev.slice(0, -1));
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        setPasteFlash("Clipboard empty");
        setTimeout(() => setPasteFlash(""), 1500);
        return;
      }
      const parsed = parseClipboard(text);
      if (parsed.email) setCustomerEmail(parsed.email);
      if (parsed.name) setCustomerName(parsed.name);
      const filled = [parsed.name && "name", parsed.email && "email"].filter(Boolean).join(" + ");
      setPasteFlash(filled ? `Filled ${filled}` : "Couldn't parse clipboard");
      setTimeout(() => setPasteFlash(""), 1800);
    } catch {
      setPasteFlash("Paste blocked — allow clipboard access");
      setTimeout(() => setPasteFlash(""), 2000);
    }
  }

  async function handleInstall() {
    if (installEvent) {
      await installEvent.prompt();
      await installEvent.userChoice;
      setInstallEvent(null);
    } else if (isIOS) {
      setShowIOSHelp(true);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerEmail.trim()) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/intake/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-intake-pin": verifiedPin,
        },
        body: JSON.stringify({
          slug: client.slug,
          name: customerName.trim(),
          email: customerEmail.trim(),
          delay_minutes: delayMinutes,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to submit");
      }

      setSubmittedDelay(delayMinutes);
      setSubmitted(true);
      setCustomerName("");
      setCustomerEmail("");
      setDelayMinutes(45);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    }

    setSubmitting(false);
  }

  function handleAddAnother() {
    setSubmitted(false);
    setError("");
  }

  const showInstallButton = !isStandalone && (installEvent !== null || isIOS);

  // ── PIN Lock Screen ──
  if (!authenticated) {
    const numPadKeys = [
      ["1", "2", "3"],
      ["4", "5", "6"],
      ["7", "8", "9"],
      ["", "0", "del"],
    ];

    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-between py-12 px-4 select-none overflow-hidden">
        <div className="flex-1" />

        <div className="flex flex-col items-center mb-8">
          {client.logo_url && (
            <img
              src={client.logo_url}
              alt={client.name}
              className="w-14 h-14 mb-3 object-contain brightness-0 invert opacity-70"
            />
          )}
          <h1 className="text-white/90 text-base font-light tracking-wide mb-1">
            {client.name}
          </h1>
          <p className="text-white/35 text-xs font-light">
            Enter Passcode
          </p>
        </div>

        <div
          className={`flex gap-5 mb-10 ${shake ? "animate-[shake_0.4s_ease-in-out]" : ""}`}
        >
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-full transition-all duration-150"
              style={{
                backgroundColor:
                  i < pinDigits.length
                    ? "white"
                    : pinError
                      ? "rgba(220,38,38,0.6)"
                      : "rgba(255,255,255,0.2)",
                transform: i < pinDigits.length ? "scale(1.15)" : "scale(1)",
              }}
            />
          ))}
        </div>

        {pinError && (
          <p className="text-xs font-light mb-4" style={{ color: "rgba(220,38,38,0.8)" }}>
            {pinError}
          </p>
        )}

        <div className="grid grid-cols-3 gap-x-6 gap-y-3 mb-4">
          {numPadKeys.flat().map((key, i) => {
            if (key === "") {
              return <div key={i} className="w-[75px] h-[75px]" />;
            }

            if (key === "del") {
              return (
                <button
                  key={i}
                  type="button"
                  onClick={handleBackspace}
                  className="w-[75px] h-[75px] flex items-center justify-center active:opacity-40 transition-opacity"
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    <path d="M7.4 4.8A2 2 0 0 1 8.8 4H20a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8.8a2 2 0 0 1-1.4-.6L2 14l5.4-9.2z" />
                  </svg>
                </button>
              );
            }

            return (
              <button
                key={i}
                type="button"
                onClick={() => handleNumberPad(key)}
                className="w-[75px] h-[75px] rounded-full flex flex-col items-center justify-center active:bg-white/30 transition-colors"
                style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
              >
                <span className="text-white text-[28px] font-light leading-none">
                  {key}
                </span>
                <span className="text-white/30 text-[9px] tracking-[0.2em] font-light mt-0.5">
                  {key === "0"
                    ? ""
                    : key === "1"
                      ? ""
                      : ["A B C", "D E F", "G H I", "J K L", "M N O", "P Q R S", "T U V", "W X Y Z"][
                          parseInt(key) - 2
                        ] || ""}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        {pinLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}

        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-12px); }
            40% { transform: translateX(12px); }
            60% { transform: translateX(-8px); }
            80% { transform: translateX(8px); }
          }
        `}</style>
      </div>
    );
  }

  // ── Success Screen ──
  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div
            className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center"
            style={{ backgroundColor: `${blue}10` }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={blue} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: blue }}>
            Customer Added
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            {submittedDelay === 0
              ? "Review request is being sent now."
              : `Review request will be sent in ${DELAY_OPTIONS.find((o) => o.value === submittedDelay)?.label.toLowerCase() || `${submittedDelay} min`}.`}
          </p>
          <button
            onClick={handleAddAnother}
            className="w-full text-white font-semibold py-3.5 rounded-xl"
            style={{ backgroundColor: blue }}
          >
            Add Another Customer
          </button>
        </div>
      </div>
    );
  }

  // ── Intake Form ──
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          {client.logo_url && (
            <img
              src={client.logo_url}
              alt={client.name}
              className="w-16 h-16 mx-auto mb-3 object-contain"
            />
          )}
          <h1 className="text-lg font-bold" style={{ color: blue }}>
            New Customer
          </h1>
          <p className="text-sm text-gray-400">
            Enter customer details to send a review request
          </p>
        </div>

        {showInstallButton && (
          <button
            type="button"
            onClick={handleInstall}
            className="w-full mb-4 flex items-center justify-center gap-2 border-2 rounded-xl py-2.5 text-sm font-medium transition-colors"
            style={{ borderColor: blue, color: blue }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M20 21H4" />
            </svg>
            Install on Home Screen
          </button>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Customer Info</span>
            <button
              type="button"
              onClick={handlePaste}
              className="text-xs font-medium flex items-center gap-1 px-2 py-1 rounded-md transition-colors"
              style={{ color: blue, backgroundColor: `${blue}10` }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="8" y="2" width="8" height="4" rx="1" />
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              </svg>
              Paste
            </button>
          </div>

          {pasteFlash && (
            <p className="text-xs text-center -mt-2" style={{ color: blue }}>
              {pasteFlash}
            </p>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: blue }}>
              Customer Name
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="John Doe"
              autoFocus
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-300 focus:outline-none transition-colors"
              onFocus={(e) => (e.currentTarget.style.borderColor = blue)}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: blue }}>
              Customer Email <span style={{ color: red }}>*</span>
            </label>
            <input
              type="email"
              required
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="john@example.com"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-300 focus:outline-none transition-colors"
              onFocus={(e) => (e.currentTarget.style.borderColor = blue)}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-300">
              Phone Number <span className="text-xs">(coming soon)</span>
            </label>
            <input
              type="tel"
              disabled
              placeholder="(555) 123-4567"
              className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 text-gray-300 placeholder-gray-200 bg-gray-50 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-300">
              Service <span className="text-xs">(coming soon)</span>
            </label>
            <input
              type="text"
              disabled
              placeholder="e.g., Fence Installation"
              className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 text-gray-300 placeholder-gray-200 bg-gray-50 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: blue }}>
              Send review request
            </label>
            <div className="flex flex-wrap gap-2">
              {DELAY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDelayMinutes(opt.value)}
                  className="px-3.5 py-2 rounded-lg text-sm font-medium border-2 transition-all"
                  style={{
                    borderColor: delayMinutes === opt.value ? blue : "#e5e7eb",
                    backgroundColor: delayMinutes === opt.value ? blue : "white",
                    color: delayMinutes === opt.value ? "white" : "#6b7280",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-center" style={{ color: red }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full text-white font-semibold py-3.5 rounded-xl transition-opacity disabled:opacity-50"
            style={{ backgroundColor: red }}
          >
            {submitting ? "Submitting..." : "Send Review Request"}
          </button>
        </form>

        {showIOSHelp && (
          <div
            className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4"
            onClick={() => setShowIOSHelp(false)}
          >
            <div
              className="bg-white rounded-2xl p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-3" style={{ color: blue }}>
                Install on iPhone
              </h3>
              <ol className="space-y-3 text-sm text-gray-700 mb-5">
                <li className="flex gap-3">
                  <span className="font-bold" style={{ color: blue }}>1.</span>
                  <span>
                    Tap the <strong>Share</strong> icon
                    <svg className="inline-block ml-1 -mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                    at the bottom of Safari
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold" style={{ color: blue }}>2.</span>
                  <span>Scroll down and tap <strong>Add to Home Screen</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold" style={{ color: blue }}>3.</span>
                  <span>Tap <strong>Add</strong> in the top right</span>
                </li>
              </ol>
              <button
                onClick={() => setShowIOSHelp(false)}
                className="w-full text-white font-semibold py-3 rounded-xl"
                style={{ backgroundColor: blue }}
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
