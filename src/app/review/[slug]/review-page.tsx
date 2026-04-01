"use client";

import { useState } from "react";

interface Client {
  id: string;
  name: string;
  slug: string;
  google_review_url: string | null;
  logo_url: string | null;
  brand_color: string;
}

interface Props {
  client: Client;
  contactId: string | null;
  clientId: string | null;
  hasVerifiedToken: boolean;
  token: string | null;
  tokenWasProvided: boolean;
}

export default function ReviewPage({
  client,
  contactId,
  clientId,
  hasVerifiedToken,
  token,
  tokenWasProvided,
}: Props) {
  const [rating, setRating] = useState<number>(0);
  const [hoveredStar, setHoveredStar] = useState<number>(0);
  const [step, setStep] = useState<
    "rate" | "feedback" | "thankyou" | "redirecting" | "contact"
  >("rate");
  const [feedbackText, setFeedbackText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");

  const brandColor = client.brand_color || "#4F46E5";
  const canCollectPrivateFeedback = Boolean(
    contactId && clientId && hasVerifiedToken && token
  );

  async function handleRating(stars: number) {
    setRating(stars);
    setFeedbackError("");

    if (stars >= 4) {
      if (!client.google_review_url) {
        setStep("thankyou");
        return;
      }

      setStep("redirecting");

      if (canCollectPrivateFeedback && token) {
        fetch("/api/review-click", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }).catch(() => {});
      }

      setTimeout(() => {
        window.location.href = client.google_review_url!;
      }, 1500);
      return;
    }

    setStep(canCollectPrivateFeedback ? "feedback" : "contact");
  }

  async function handleFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (!canCollectPrivateFeedback || !token || submitting) return;

    setSubmitting(true);
    setFeedbackError("");

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, rating, message: feedbackText }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error || "Failed to send feedback");
      }

      setStep("thankyou");
    } catch {
      setFeedbackError(
        tokenWasProvided
          ? "We couldn't save your feedback. Please try again."
          : "This feedback link could not be verified."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg overflow-hidden">
        <div
          className="px-6 py-8 text-center"
          style={{ backgroundColor: brandColor }}
        >
          {client.logo_url && (
            <img
              src={client.logo_url}
              alt={client.name}
              className="h-16 mx-auto mb-4 object-contain"
            />
          )}
          <h1 className="text-white text-xl font-bold">{client.name}</h1>
        </div>

        <div className="px-6 py-8 text-center">
          {step === "rate" && (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                How was your experience?
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Your feedback helps us improve
              </p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleRating(star)}
                    onMouseEnter={() => setHoveredStar(star)}
                    onMouseLeave={() => setHoveredStar(0)}
                    className="text-4xl transition-transform hover:scale-110 focus:outline-none"
                    aria-label={`${star} star${star > 1 ? "s" : ""}`}
                  >
                    <span
                      style={{
                        color:
                          star <= (hoveredStar || rating)
                            ? "#FBBF24"
                            : "#D1D5DB",
                      }}
                    >
                      {"\u2605"}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "feedback" && (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                We&apos;re sorry to hear that
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Please let us know how we can improve
              </p>
              <div className="flex justify-center gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className="text-2xl"
                    style={{ color: star <= rating ? "#FBBF24" : "#D1D5DB" }}
                  >
                    {"\u2605"}
                  </span>
                ))}
              </div>
              <form onSubmit={handleFeedback}>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Tell us what happened..."
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 mb-4 resize-none"
                  style={{ focusRingColor: brandColor } as React.CSSProperties}
                  rows={4}
                />
                {feedbackError && (
                  <p className="mb-3 text-sm text-red-600">{feedbackError}</p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full text-white font-semibold py-3 rounded-lg transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: brandColor }}
                >
                  {submitting ? "Sending..." : "Send Feedback"}
                </button>
              </form>
            </>
          )}

          {step === "contact" && (
            <>
              <div className="text-5xl mb-4">{"\u260E"}</div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Please contact {client.name} directly
              </h2>
              <p className="text-sm text-gray-500">
                {tokenWasProvided
                  ? "We couldn't verify this feedback link, so we can't submit a private review here."
                  : "This page can send you to Google, but private feedback only works from a verified review link."}
              </p>
            </>
          )}

          {step === "thankyou" && (
            <>
              <div className="text-5xl mb-4">{"\u{1F64F}"}</div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Thank you for your feedback
              </h2>
              <p className="text-sm text-gray-500">
                We appreciate you taking the time to help us improve.
              </p>
            </>
          )}

          {step === "redirecting" && (
            <>
              <div className="text-5xl mb-4">{"\u2B50"}</div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Thank you!
              </h2>
              <p className="text-sm text-gray-500">
                Taking you to leave a review...
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
