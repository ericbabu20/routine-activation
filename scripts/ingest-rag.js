// Ingest approved, non-personal content into the RAG vector store (PRD §24).
// Only public help/workout/policy/safety content is embedded here — never any
// private customer data. Idempotent: clears existing public docs, then re-embeds.
//
//   node scripts/ingest-rag.js
//
// Requires GEMINI_API_KEY (embeddings). Without it, the script exits with a hint.
import "dotenv/config";
import { admin } from "../server/supabase.js";
import { embedText, isConfigured, EMBED_DIM } from "../server/lib/gemini.js";

// ---- Approved knowledge base -----------------------------------------------
const DOCS = [
  { source: "help_centre", content_type: "faq", title: "Freezing your membership",
    content: "You can freeze an active membership when you need a break, for example while travelling or recovering. While frozen you won't be billed and you can't enter a centre. Unfreeze any time from Profile → Membership to resume straight away. Freezing keeps your account and history intact." },
  { source: "help_centre", content_type: "policy", title: "Cancellation policy",
    content: "You can cancel your membership at any time from Profile → Membership → Cancel. Cancellation stops future billing. Your access continues until the end of the current paid period. You can re-join later; your profile and past activity are preserved. There are no cancellation penalties in this app." },
  { source: "help_centre", content_type: "faq", title: "Home centre and all-centre access",
    content: "Every membership has a home centre. Home plans give access to your chosen centre only. Pro and Elite plans include access to all centres. You can change your home centre from Explore → Centres, or from Profile → Membership." },
  { source: "help_centre", content_type: "faq", title: "Booking classes and waitlists",
    content: "Browse classes in Explore → Classes and filter by day, format and intensity. Tap Book to reserve a spot. If a class is full you can join the waitlist; if someone cancels, the next person on the waitlist is booked automatically. You can cancel a booking from My classes, which frees your spot for the waitlist." },
  { source: "help_centre", content_type: "faq", title: "Your secure entry pass",
    content: "Open the Pass tab to show your entry QR code at the centre. The code is generated on our servers, contains no personal information, and refreshes every 45 seconds for security. You need an active membership to generate a pass. Never share a screenshot of your pass." },
  { source: "help_centre", content_type: "faq", title: "Visit history",
    content: "When you check in at a centre a visit is recorded, and it's closed when you leave so we can show its duration. See your visits and simple stats (visits this month, total, average per week and average duration) in the Activity tab." },
  { source: "safety", content_type: "safety", title: "Working out safely",
    content: "Warm up for a few minutes before training and cool down afterwards. Use a weight and pace that let you keep good form. Stay hydrated. If you feel sharp pain, dizziness, chest discomfort or shortness of breath, stop immediately and seek help. This app does not provide medical advice — if you have an injury or a health condition, consult a qualified professional before exercising." },
  { source: "safety", content_type: "safety", title: "Low-energy and tired days",
    content: "It's normal to have low-energy days. Doing something smaller — a lighter session or a 10-minute reset — protects your routine when energy is low, and still counts as showing up. Choose what feels realistic today. Rest is also valid; a missed session never erases the progress you've banked." },
  { source: "workout_library", content_type: "workout", title: "Beginner strength foundations",
    content: "A simple full-body strength session: bodyweight squats, incline push-ups, dumbbell rows, glute bridges and a plank. Do 2–3 sets of 8–12 reps with controlled form and rest 60–90 seconds between sets. Aim for a weight that feels challenging on the last couple of reps but never compromises form." },
  { source: "workout_library", content_type: "workout", title: "10-minute reset",
    content: "A short momentum-protecting session for busy or tired days: 1 minute march on the spot, 10 squats, 10 knee push-ups, 20-second plank, 10 glute bridges, then repeat once and finish with gentle stretching. It keeps your routine alive without draining you." },
  { source: "workout_library", content_type: "workout", title: "Gentle mobility and recovery",
    content: "A low-intensity flow to aid recovery: cat-cow, world's greatest stretch, hip openers, thoracic rotations and calf stretches. Move slowly, breathe deeply, and stop short of any pain. Great for rest days or after a hard session." },
  { source: "equipment_guide", content_type: "equipment", title: "Using a treadmill safely",
    content: "Start at a slow walking speed and clip on the safety key. Increase speed gradually and use incline to add challenge without high impact. Look ahead rather than at your feet, and avoid holding the rails tightly. Step onto the side rails before stopping the belt." },
  { source: "equipment_guide", content_type: "equipment", title: "Using dumbbells",
    content: "Pick a weight you can control for your target reps. Keep movements smooth, brace your core, and avoid swinging. Return dumbbells to the rack after use. If a lift feels unstable, reduce the weight — good form matters more than load." },
  { source: "help_centre", content_type: "faq", title: "Comeback after a missed session",
    content: "Missing a workout is a normal, recoverable event — your banked progress is never reset. After a miss you'll see supportive options: rebook the session, do a short reset workout, or ask a trusted buddy for encouragement. Pick whatever feels realistic; the goal is consistency across weeks, not a perfect streak." },
];

function chunk(text, size = 900) {
  const paras = text.split(/\n\n+/);
  const chunks = [];
  let cur = "";
  for (const p of paras) {
    if ((cur + "\n\n" + p).length > size && cur) {
      chunks.push(cur.trim());
      cur = p;
    } else {
      cur = cur ? `${cur}\n\n${p}` : p;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

async function main() {
  if (!isConfigured()) {
    console.error("\n  GEMINI_API_KEY is not set — embeddings can't be generated.");
    console.error("  Add your key to .env (GEMINI_API_KEY=...) then re-run: npm run ingest\n");
    process.exit(1);
  }

  console.log(`\n  Ingesting approved content (embedding dim ${EMBED_DIM})...`);
  // Idempotent: clear existing public docs (member-owned docs are left alone).
  await admin.from("rag_documents").delete().eq("visibility", "public");

  let count = 0;
  for (const doc of DOCS) {
    const pieces = chunk(doc.content);
    for (const piece of pieces) {
      const embedding = await embedText(piece);
      if (!embedding) {
        console.warn(`   ! skipped (no embedding): ${doc.title}`);
        continue;
      }
      const { error } = await admin.from("rag_documents").insert({
        source: doc.source,
        title: doc.title,
        content_type: doc.content_type,
        visibility: "public",
        version: "v1",
        content: piece,
        embedding,
      });
      if (error) throw error;
      count++;
    }
    console.log(`   • ${doc.title}`);
  }
  console.log(`\n  Ingested ${count} chunks from ${DOCS.length} documents.\n`);
}

main().catch((err) => {
  console.error("\n  Ingest failed:", err.message, "\n");
  process.exit(1);
});
