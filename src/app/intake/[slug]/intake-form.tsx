"use client";

import { useState } from "react";

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

export default function IntakeForm({ client }: Props) {
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

  const blue = client.brand_color || "#1e3a8a";
  const red = "#dc2626";

  async function verifyPin(digits: string[]) {
    const pin = digits.join("");
    if (pin.length !== PIN_LENGTH) return;

    setPinLoading(true);
    setPinError("");

    try {
      const res = await fetch("/api/intake/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      if (res.ok) {
        setVerifiedPin(pin);
        setAuthenticated(true);
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

  const delayLabel = DELAY_OPTIONS.find((o) => o.value === delayMinutes)?.label || `${delayMinutes} min`;

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

        {/* Top section */}
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

        {/* PIN Dots */}
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

        {/* Number Pad */}
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
        {/* Header */}
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
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

          {/* Email */}
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

          {/* Phone (disabled for now) */}
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

          {/* Service (disabled for now) */}
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

          {/* Send Delay */}
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
      </div>
    </div>
  );
}
