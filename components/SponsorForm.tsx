"use client";

import { useState, useTransition } from "react";
import { submitSponsorInquiry } from "@/app/sponsor/actions";

type Status = "idle" | "submitting" | "success" | "error";

export function SponsorForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    setStatus("submitting");
    startTransition(async () => {
      const result = await submitSponsorInquiry(formData);
      if (result.success) {
        setStatus("success");
      } else {
        setErrorMsg(result.error || "Something went wrong.");
        setStatus("error");
      }
    });
  }

  if (status === "success") {
    return (
      <div className="text-center py-8">
        <p className="text-positive font-medium text-sm">
          Thanks for your interest!
        </p>
        <p className="text-xs text-text-secondary mt-2">
          I&rsquo;ll be in touch soon.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="block text-[11px] font-mono uppercase tracking-widest text-text-tertiary mb-1.5"
        >
          Email <span className="text-negative">*</span>
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          placeholder="you@company.com"
          className="w-full bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent/50 transition-shadow"
        />
      </div>

      <div>
        <label
          htmlFor="company"
          className="block text-[11px] font-mono uppercase tracking-widest text-text-tertiary mb-1.5"
        >
          Company
        </label>
        <input
          type="text"
          id="company"
          name="company"
          placeholder="Optional"
          className="w-full bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent/50 transition-shadow"
        />
      </div>

      <div>
        <label
          htmlFor="message"
          className="block text-[11px] font-mono uppercase tracking-widest text-text-tertiary mb-1.5"
        >
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={3}
          placeholder="Tell me about your interest in sponsoring..."
          className="w-full bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent/50 transition-shadow resize-y"
        />
      </div>

      {status === "error" && (
        <p className="text-negative text-xs font-mono">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-mono text-xs uppercase tracking-wider px-5 py-2.5 rounded-lg btn-glow transition-colors cursor-pointer disabled:cursor-not-allowed"
      >
        {isPending ? "Sending..." : "Get in Touch"}
      </button>
    </form>
  );
}
