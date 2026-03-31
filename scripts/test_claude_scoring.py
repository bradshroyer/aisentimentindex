#!/usr/bin/env python3
"""Test Claude API sentiment scoring against VADER on a sample of headlines.

Usage:
    ANTHROPIC_API_KEY=sk-... python scripts/test_claude_scoring.py

Scores 50 headlines with Claude Haiku and compares against VADER+domain-adjust.
"""

import json
import os
import random
import sys
import time

from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

API_KEY = os.getenv("ANTHROPIC_API_KEY")
if not API_KEY:
    sys.exit("Set ANTHROPIC_API_KEY env var first.")

client = Anthropic(api_key=API_KEY)

SAMPLE_SIZE = 50
MODEL = "claude-haiku-4-5-20251001"

SYSTEM_PROMPT = """You are a sentiment classifier for AI/tech news headlines.

Given a headline (and optional summary), return a JSON object with:
- "sentiment": float from -1.0 (strongly anti-AI / negative about AI) to +1.0 (strongly pro-AI / positive about AI). 0.0 = neutral.
- "reasoning": one sentence explaining your score.

Scoring guidelines:
- Score the headline's STANCE toward AI, not the emotional valence of the words.
- "Anthropic Wins Court Order Pausing Ban" = POSITIVE for AI (company won), despite negative words like "ban".
- "AI replaces 500 jobs" = NEGATIVE for AI sentiment, even though it shows AI capability.
- Funding, launches, partnerships, breakthroughs = generally positive.
- Bans, lawsuits, safety failures, job losses, regulation = generally negative.
- Neutral reporting or mixed signals = near 0.0.

Return ONLY valid JSON, no markdown fences."""

# ---------------------------------------------------------------------------
# Load sample
# ---------------------------------------------------------------------------

with open("data.json") as f:
    data = json.load(f)

headlines = data.get("headlines", [])

# Pick a stratified sample: some very positive, some very negative, some borderline
random.seed(42)
by_bucket = {"neg": [], "neu": [], "pos": []}
for h in headlines:
    s = h["score"]
    if s < -0.3:
        by_bucket["neg"].append(h)
    elif s > 0.3:
        by_bucket["pos"].append(h)
    else:
        by_bucket["neu"].append(h)

sample = (
    random.sample(by_bucket["neg"], min(17, len(by_bucket["neg"])))
    + random.sample(by_bucket["neu"], min(16, len(by_bucket["neu"])))
    + random.sample(by_bucket["pos"], min(17, len(by_bucket["pos"])))
)
random.shuffle(sample)

print(f"Scoring {len(sample)} headlines with {MODEL}...\n")

# ---------------------------------------------------------------------------
# Score with Claude
# ---------------------------------------------------------------------------

results = []
for i, h in enumerate(sample):
    text = h["title"]
    if h.get("summary"):
        text += f"\n\nSummary: {h['summary'][:300]}"

    try:
        resp = client.messages.create(
            model=MODEL,
            max_tokens=150,
            system=SYSTEM_PROMPT,
            messages=[
                {"role": "user", "content": text},
                {"role": "assistant", "content": "{"},
            ],
        )
        raw = "{" + resp.content[0].text.strip()
        # Strip markdown fences if present
        if "```" in raw:
            raw = raw.split("```json")[-1].split("```")[0].strip()
        parsed = json.loads(raw)
        claude_score = float(parsed["sentiment"])
        reasoning = parsed.get("reasoning", "")
    except Exception as e:
        print(f"  [{i+1}] ERROR: {e}")
        if "credit balance" in str(e) or "authentication" in str(e).lower():
            sys.exit("API account issue — fix billing/key and retry.")
        claude_score = None
        reasoning = f"error: {e}"

    results.append({
        "title": h["title"][:100],
        "source": h["source"],
        "vader_raw": h.get("score_raw", 0),
        "vader_adj": h["score"],
        "claude": claude_score,
        "reasoning": reasoning,
    })

    status = "OK" if claude_score is not None else "ERR"
    print(f"  [{i+1}/{len(sample)}] {status} vader={h['score']:+.2f} claude={claude_score:+.2f} | {h['title'][:70]}" if claude_score is not None else f"  [{i+1}/{len(sample)}] ERR | {h['title'][:70]}")

# ---------------------------------------------------------------------------
# Analysis
# ---------------------------------------------------------------------------

scored = [r for r in results if r["claude"] is not None]
print(f"\n{'='*80}")
print(f"Successfully scored: {len(scored)}/{len(sample)}")

# Agreement analysis
agree = 0
disagree_examples = []
for r in scored:
    v = r["vader_adj"]
    c = r["claude"]
    # Same sign (or both near zero)?
    v_sign = "pos" if v > 0.05 else ("neg" if v < -0.05 else "neu")
    c_sign = "pos" if c > 0.05 else ("neg" if c < -0.05 else "neu")
    if v_sign == c_sign:
        agree += 1
    else:
        disagree_examples.append(r)

print(f"Direction agreement: {agree}/{len(scored)} ({agree/len(scored)*100:.0f}%)")
print(f"Disagreements: {len(disagree_examples)}")

# Average absolute difference
diffs = [abs(r["vader_adj"] - r["claude"]) for r in scored]
print(f"Mean |VADER - Claude|: {sum(diffs)/len(diffs):.3f}")

# Show disagreements
if disagree_examples:
    print(f"\n{'='*80}")
    print("DISAGREEMENTS (VADER vs Claude direction differs):\n")
    for r in disagree_examples:
        print(f"  vader={r['vader_adj']:+.4f}  claude={r['claude']:+.4f}  | {r['title']}")
        print(f"    Claude says: {r['reasoning']}")
        print()

# Show biggest absolute differences
print(f"{'='*80}")
print("BIGGEST SCORE GAPS:\n")
scored_by_gap = sorted(scored, key=lambda r: abs(r["vader_adj"] - r["claude"]), reverse=True)
for r in scored_by_gap[:10]:
    print(f"  vader={r['vader_adj']:+.4f}  claude={r['claude']:+.4f}  gap={abs(r['vader_adj']-r['claude']):.3f}  | {r['title']}")
    print(f"    Claude says: {r['reasoning']}")
    print()

# Save full results
out_path = "scripts/claude_vs_vader_results.json"
with open(out_path, "w") as f:
    json.dump(results, f, indent=2)
print(f"Full results saved to {out_path}")
