"use server";

import { getSupabase } from "@/lib/supabase";
import { Resend } from "resend";

const NOTIFY_EMAIL = "brad.shroyer@mac.com";

export async function submitSponsorInquiry(formData: FormData) {
  const email = (formData.get("email") as string)?.trim();
  const company = (formData.get("company") as string)?.trim() || null;
  const message = (formData.get("message") as string)?.trim() || null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: "Please enter a valid email address." };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, error: "Service temporarily unavailable." };
  }

  const { error } = await supabase
    .from("sponsor_inquiries")
    .insert({ email, company, message });

  if (error) {
    console.error("Sponsor inquiry insert error:", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }

  // Send notification email (non-blocking — don't fail the submission if email fails)
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    resend.emails.send({
      from: "AI Sentiment Index <onboarding@resend.dev>",
      to: NOTIFY_EMAIL,
      subject: `New sponsor inquiry from ${email}`,
      text: [
        `Email: ${email}`,
        company ? `Company: ${company}` : null,
        message ? `Message: ${message}` : null,
      ].filter(Boolean).join("\n"),
    }).catch((err) => console.error("Resend notification error:", err));
  }

  return { success: true };
}
