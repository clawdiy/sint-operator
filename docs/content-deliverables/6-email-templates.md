# Deliverable 6: Email Templates (3)

## Format: Plain text with {{variable}} placeholders
Compatible with the Notifier skill's template system.

---

## Email 1: Welcome / Post-Signup

**Subject:** `Your SINT operator is live`

**Body:**
```
Hey {{name}},

Your Marketing Operator is set up and ready to go.

Here's the fastest way to see it work:

1. Go to your dashboard: {{dashboard_url}}
2. Paste any blog post into the Repurpose Content box
3. Hit Repurpose → Twitter, LinkedIn, Instagram
4. Get platform-ready posts in ~30 seconds

That's it. One input, multiple outputs, your brand voice.

If you haven't set up your brand profile yet, do that first — it's the difference between generic AI output and content that actually sounds like you.

→ Set up your brand: {{dashboard_url}}/#brands

Three pipelines to try this week:

• Content Repurpose — turn one post into 5+ platform versions
• SEO Blog — enter a keyword, get a full article with meta tags
• Content Calendar — generate a week of scheduled posts

Your API usage shows up in real-time on the Usage page. Average cost per pipeline run: $0.15-$0.40.

Questions? Reply to this email or join the Discord: {{discord_url}}

—
SINT Marketing Operator
{{dashboard_url}}
```

---

## Email 2: First Run Complete

**Subject:** `Your first content is ready — {{pipeline_name}}`

**Body:**
```
Hey {{name}},

Your {{pipeline_name}} pipeline just finished.

Results:
{{result_summary}}

Total cost: {{cost_units}} cost units (~${{cost_estimate}})
Time: {{duration_seconds}} seconds
Tokens used: {{tokens_used}}

→ View full results: {{results_url}}

What to do next:

• Review the generated content — edit anything that needs tweaking
• Copy to your scheduling tool (Buffer, Hootsuite, etc.) or post directly
• Try a different pipeline — you've got 7 to explore

Pro tip: The Content Calendar pipeline is great for planning a full week. Set your themes and let the operator build your posting schedule.

→ Run another pipeline: {{dashboard_url}}

—
SINT Marketing Operator
```

---

## Email 3: Weekly Usage Digest

**Subject:** `Your week in content — {{week_start}} to {{week_end}}`

**Body:**
```
Hey {{name}},

Here's what your operator did this week:

Pipeline Runs: {{total_runs}}
Content Pieces Generated: {{total_pieces}}
Platforms Covered: {{platforms_list}}
Total Cost: {{total_cost_units}} units (~${{total_cost_estimate}})
Tokens Used: {{total_tokens}}

Top pipeline: {{top_pipeline_name}} ({{top_pipeline_runs}} runs)

{{#if brands_used}}
Brands used: {{brands_used}}
{{/if}}

{{#if comparison}}
vs. last week: {{runs_delta}} runs ({{runs_delta_pct}})
{{/if}}

→ Full usage breakdown: {{dashboard_url}}/#usage

{{#if tip}}
💡 Tip: {{tip}}
{{/if}}

—
SINT Marketing Operator
{{dashboard_url}}
```

**Tip rotation (pick one per week):**
```
tips:
  - "Try the SEO Blog pipeline with your top-performing keyword. Compare the generated article against your current ranking content."
  - "Set up a second brand profile for a different product line or sub-brand. Same pipelines, different voice."
  - "The Content Calendar pipeline works best with 3-4 specific themes. Generic themes like 'innovation' produce generic content."
  - "Running Content Repurpose on your best-performing post from last month can surface angles you missed the first time."
```

---

## Variable Reference

| Variable | Source | Example |
|----------|--------|---------|
| `{{name}}` | User profile | `Illia` |
| `{{dashboard_url}}` | Config | `https://sint-operator-production.up.railway.app` |
| `{{discord_url}}` | Config | `https://discord.gg/X42kPBNg2Z` |
| `{{pipeline_name}}` | Run result | `Content Repurpose` |
| `{{result_summary}}` | Run output | `Generated 5 deliverables: Twitter thread (280 chars), LinkedIn post (2,100 chars)...` |
| `{{cost_units}}` | Metering | `12` |
| `{{cost_estimate}}` | Metering × rate | `0.18` |
| `{{duration_seconds}}` | Run timing | `34` |
| `{{tokens_used}}` | Metering | `4,200` |
| `{{results_url}}` | Run ID | `{dashboard_url}/#results/{runId}` |
| `{{total_runs}}` | Weekly aggregate | `23` |
| `{{total_pieces}}` | Weekly aggregate | `87` |
| `{{platforms_list}}` | Weekly aggregate | `Twitter, LinkedIn, Instagram` |
| `{{week_start}}` | Date | `Feb 17` |
| `{{week_end}}` | Date | `Feb 23` |
| `{{top_pipeline_name}}` | Weekly aggregate | `Content Repurpose` |
| `{{top_pipeline_runs}}` | Weekly aggregate | `12` |
