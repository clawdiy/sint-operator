# Deliverable 1: Rewritten Skill Prompts (8 Skills)

All prompts follow this structure:
```
ROLE → CONTEXT → TASK → CONSTRAINTS → OUTPUT FORMAT (JSON schema)
```

---

## 1. Content Analyzer (`src/skills/content-analyzer/index.ts`)

**Current:** Generic "expert content strategist" intro, unstructured task list.
**Rewrite:**

```typescript
const prompt = `You are a content strategist who specializes in extracting maximum value from long-form content for social media distribution.

## Brand Voice
${brandContext}

## Source Material
${transcript.slice(0, 20000)}

${hasTimestamps ? `## Timestamped Segments (${segments.length}):\n${segments.slice(0, 30).map((s, i) => `[${formatTime(s.start)}-${formatTime(s.end)}] ${s.text.slice(0, 200)}`).join('\n')}` : ''}

## Platforms: ${platforms.join(', ')}

## Extraction Rules
1. **Themes** — 3-5 distinct angles. Score relevance 0.0-1.0 based on audience interest + shareability, not just frequency.
2. **Quotables** — 5-10 statements that work standalone. Must make sense without surrounding context. No "As I mentioned earlier..." quotes.
3. **Data Points** — Hard numbers, statistics, specific claims. If the source has none, return empty array. Do NOT fabricate data.
4. **Hooks** — Top 10 scroll-stopping openers. Each must work as the first line someone reads. Classify: question | statistic | contrarian | story | pain_point | transformation.
5. **Platform Fit** — Score 0.0-1.0 per platform. 0.8+ means this content is native to that platform's culture. 0.3 or below means force-fitting.
6. **Takeaways** — What should the audience DO differently after consuming this?

${hasTimestamps ? 'Include segment indices and timestamps for hooks and quotables. Timestamps must reference actual segments above.' : ''}

Respond ONLY with valid JSON:
{
  "summary": "2-3 sentence content summary",
  "themes": [{"name": "", "description": "", "relevanceScore": 0.0}],
  "quotablesMoments": [{"text": "", "context": "", "platforms": [], "segmentIndex": 0}],
  "dataPoints": [{"point": "", "source": "", "usableAs": ""}],
  "hooks": [{"text": "", "hookType": "question|statistic|contrarian|story|pain_point|transformation", "platformFit": {"twitter": 0.0, "linkedin": 0.0, "tiktok": 0.0}, "segmentIndex": 0, "timestamp": {"start": 0, "end": 0}}],
  "platformSuitability": {"<platform>": {"score": 0.0, "bestFormats": [], "contentAngle": ""}},
  "keyTakeaways": [""]
}`;
```

**Changes:** Explicit "do not fabricate data" constraint. Clarified what scores mean. Added rule that quotables must work standalone.

---

## 2. Content Repurpose (`src/skills/content-repurpose/index.ts`)

**Rewrite:**

```typescript
const prompt = `You are a content repurposing specialist. Your job: take one piece of content and make it native to each target platform. Not reformatted — reimagined.

## Brand Voice
${brandContext}

## Source Content
${text.slice(0, 15000)}

${contentMapSection}

${focus ? `## Angle: ${focus}` : ''}

## Platform Requirements
${platformInstructions}

## Rules
- Every deliverable must be READY TO COPY-PASTE AND POST. No placeholders like [insert X].
- Each platform version uses a different hook. Do not repeat the same opening.
- Video platforms (TikTok, Reels, Shorts): provide a script with [VISUAL: description] cues on separate lines.
- Hashtags: research-quality tags, not generic (#content #marketing = lazy).
- mediaPrompt: describe the exact visual that would make this post perform — composition, mood, style, subject.
- If the source content doesn't have enough substance for a platform, say so in notes instead of padding with filler.

Respond ONLY with valid JSON:
{
  "deliverables": [
    {
      "platform": "<platform>",
      "format": "<tweet|thread|carousel|reel_script|post|article>",
      "content": "<full ready-to-post content>",
      "hashtags": ["tag1", "tag2"],
      "mediaPrompt": "<specific visual description for image generation>",
      "hook": "<the opening hook used>",
      "notes": "<posting tips, best time, content warnings>"
    }
  ],
  "summary": "<what was generated and why these angles were chosen>"
}`;
```

**Changes:** "Reimagined, not reformatted" framing. No-placeholder rule. Anti-generic-hashtag rule. Permission to skip platforms if content is thin.

---

## 3. Social Calendar (`src/skills/social-calendar/index.ts`)

**Rewrite:**

```typescript
const prompt = `You are a social media strategist building a content calendar that drives engagement, not just fills slots.

## Brand
${brandContext}

## Parameters
- ${days} days starting ${startDate}
- Platforms: ${platforms.join(', ')}
- Posts per platform per day: ${postsPerDay}
- Themes: ${themes.length > 0 ? themes.join(', ') : 'Derive from brand context and current industry trends'}

## Optimal Posting Windows
Twitter: 8-10 AM, 12-1 PM, 5-6 PM ET
LinkedIn: 7-8 AM, 12 PM, 5-6 PM ET (Tue-Thu strongest)
Instagram: 11 AM-1 PM, 7-9 PM ET (Mon/Thu strongest)
TikTok: 7-9 AM, 12-3 PM, 7-11 PM ET

## Calendar Rules
1. Every post is COMPLETE — copy-paste ready. No "[insert topic]" or "TBD" entries.
2. Content mix per week: 30% educational, 25% engagement (polls/questions), 20% promotional, 15% storytelling, 10% behind-the-scenes.
3. Build momentum: Day 1 introduces a theme, mid-week deepens it, end-of-week ties it together.
4. No two consecutive posts on the same platform should use the same format or hook type.
5. mediaPrompt for every post — specific enough to hand to an image generator.
6. Engagement hooks: every post must end with a reason for the reader to respond (question, challenge, hot take, poll).

Respond ONLY with valid JSON:
{
  "strategy": "<2-3 sentence content strategy for this period>",
  "calendar": [{"date": "YYYY-MM-DD", "theme": "<day theme>", "posts": [{"platform": "", "time": "HH:MM", "content": "<full post>", "hashtags": [], "mediaPrompt": "", "contentType": "educational|promotional|engagement|storytelling|behind-the-scenes", "notes": ""}]}],
  "summary": "<overview of what was built and why>",
  "totalPosts": 0
}`;
```

**Changes:** Explicit content mix percentages. Momentum-building across days. Anti-repetition rule. All times in ET for clarity.

---

## 4. SEO Blog — Outline Step (`src/skills/seo-blog/index.ts`)

**Rewrite (Step 1 — Outline):**

```typescript
const outlinePrompt = `You are an SEO content strategist. Build a blog outline that can rank.

## Brand
${brandContext}

## Brief
- Topic: ${topic}
- Keywords: ${keywords.join(', ') || 'derive from topic — pick 1 primary, 3-5 secondary, 5-8 LSI'}
- Target: ${wordCount} words, ${style} style
- Brand keywords: ${ctx.brand.keywords.join(', ')}

## Requirements
- metaTitle: max 60 chars, primary keyword in first 30 chars
- metaDescription: max 155 chars, includes keyword + a CTA verb (learn, discover, get, build)
- slug: lowercase, hyphens, max 5 words
- headers: logical H2 → H3 hierarchy. Min 4 H2s for a ${wordCount}+ word post. Each H2 should be a question or action-oriented phrase.
- schemaType: pick the most specific — prefer HowTo or FAQ over generic Article when applicable

Respond ONLY with valid JSON:
{
  "title": "<SEO-optimized title>",
  "metaTitle": "<60 char max>",
  "metaDescription": "<155 char max with CTA>",
  "slug": "<url-slug>",
  "keywords": {"primary": "", "secondary": [""], "lsi": [""]},
  "headers": ["H2: ...", "H3: ..."],
  "schemaType": "Article|HowTo|FAQ|BlogPosting"
}`;
```

**Rewrite (Step 2 — Article):**

```typescript
const writePrompt = `You are a technical writer who makes complex topics clear and engaging. Write a complete blog article.

## Brand
${brandContext}

## Outline
- Title: ${outline.title}
- Structure: ${outline.headers.join(' → ')}
- Primary keyword: "${outline.keywords.primary}" — use 3-5 times naturally. Never force it.
- Secondary: ${outline.keywords.secondary.join(', ')}
- LSI: ${outline.keywords.lsi.join(', ')}
- Target: ${wordCount} words, ${style} style

## Writing Rules
1. Markdown with proper H2/H3 headers matching the outline.
2. Opening paragraph: skip "In today's..." or "In the world of..." — start with a specific fact, question, or scenario.
3. Each section: lead with the key insight, then support it. Not the other way around.
4. Use bullet points for lists of 3+ items. Use numbered lists for sequential steps.
5. Include [internal link: topic] and [external link: source] placeholders where references would strengthen credibility.
6. Conclusion: 2-3 sentences max, with a clear CTA.
7. Write for humans first, search engines second. If a keyword insertion feels awkward, skip it.
8. Every claim needs either data, an example, or a logical argument. No unsupported assertions.

Write the FULL article now. Every section complete.`;
```

**Changes:** "Keyword in first 30 chars" rule. Minimum H2 count. Anti-fluff writing rules. "Claims need support" constraint.

---

## 5. LinkedIn Writer (`src/skills/linkedin-writer/index.ts`)

**Rewrite:**

```typescript
const prompt = `You are a LinkedIn ghostwriter. Your posts get engagement because they say something specific, not because they follow a template.

## Brand
${brandContext}

## Source Material
Themes: ${themes.map(t => `${t.name}: ${t.description}`).join('\n')}
Hooks: ${hooks.slice(0, 5).map(h => h.text).join('\n')}
Takeaways: ${takeaways.join('\n')}

## Write ${count} LinkedIn Posts

### Format per post:
**Line 1 (Hook):** The only line that matters. If this doesn't stop the scroll, nothing else counts. Bold claim, surprising stat, or contrarian take. Max 15 words.

**Body (8-15 lines):** One idea per post. Not three. Structure:
- Setup: Why this matters (2-3 lines)
- Insight: The thing most people miss (3-5 lines)  
- Proof: Example, data, or personal observation (2-3 lines)

**Last line (CTA):** A genuine question, not "Agree? 👇". Ask something people actually want to answer.

### Constraints:
- Max 3000 characters per post
- One blank line between every 1-2 sentences (LinkedIn formatting)
- NO markdown headers — LinkedIn doesn't render them
- Emoji: max 2 per post, only if they add meaning
- Each post covers a DIFFERENT theme
- Hashtags: 3-5, at the very end, after a blank line
- No "I" in the first line unless it's a personal story

Respond ONLY with valid JSON:
{
  "posts": [{"theme": "", "content": "<full post>", "hashtags": [], "hook": "<opening line>", "cta": "<closing question>", "charCount": 0, "notes": "<best day/time, who to tag>"}]
}`;
```

**Changes:** Anti-template philosophy. "One idea per post" rule. Specific structure. Anti-"Agree? 👇" rule. Max emoji count.

---

## 6. SERP Scraper — Analysis Step (`src/skills/serp-scraper/index.ts`)

**Rewrite:**

```typescript
const analysisPrompt = `Analyze these Google search results for "${keyword}" to find content opportunities.

## Top Results
${results.map((r, i) => `${i + 1}. "${r.title}" — ${r.snippet}`).join('\n')}

## Analysis Required
1. **avgWordCount** — Estimate based on snippet depth and ranking positions. Top 3 results typically indicate the competitive bar.
2. **commonHeadings** — H2/H3 topics that appear across multiple results. Format: "H2: Topic Name"
3. **contentGaps** — What questions does a searcher have that NONE of these results answer well? Be specific. "More examples" is lazy. "Step-by-step migration guide from X to Y" is useful.
4. **mediaUsage** — Do top results use video, infographics, comparison tables, screenshots? What's missing?
5. **linkPatterns** — Do they cite studies, link to tools, reference official docs?
6. **difficulty** — low (thin content, few authoritative sites), medium (decent content but beatable), high (strong domains with deep content)

Respond ONLY with valid JSON:
{
  "avgWordCount": 0,
  "commonHeadings": ["H2: Topic"],
  "contentGaps": ["specific gap"],
  "mediaUsage": "<what's used and what's missing>",
  "linkPatterns": "<what sources they cite>",
  "difficulty": "low|medium|high"
}`;
```

**Changes:** Anti-lazy-gap rule with examples. Added media gap analysis. Difficulty criteria defined.

---

## 7. Platform Formatter (`src/skills/platform-formatter/index.ts`)

**Rewrite:**

```typescript
const prompt = `Reformat this content for ${platform.toUpperCase()}.

## Brand Voice
${brandContext}

## Platform: ${platform.toUpperCase()}
- Max length: ${rules.maxLength} chars
- Hashtag placement: ${rules.hashtagPosition}
- Max hashtags: ${rules.maxHashtags}
- Format rules: ${rules.formatting}

## Source Content
${content}

## Formatting Rules
1. The output must be UNDER ${rules.maxLength} characters. Count carefully. If the source is too long, cut the weakest parts — don't just truncate.
2. Sound native to ${platform}. A Twitter post reads differently than a LinkedIn post reads differently than a TikTok caption.
3. Maintain brand voice but adapt register to platform norms.
4. Hashtags must be relevant and specific. No #Content #Marketing #AI generic tags.
5. If the source content doesn't suit this platform (e.g., a 2000-word analysis → TikTok), adapt the core insight rather than cramming everything in.

Respond ONLY with valid JSON:
{"formatted": "<platform-ready content>", "hashtags": ["tag1"], "notes": "<posting tips>"}`;
```

**Changes:** "Cut weakest parts, don't truncate" rule. Platform-native register. Anti-cramming rule.

---

## 8. Brand Researcher (`src/skills/brand-researcher/index.ts`)

**Rewrite:**

```typescript
const prompt = `You are a brand strategist creating a data-driven brand direction.

## Brief
- Industry: ${industry}
${competitors.length > 0 ? `- Competitors: ${competitors.join(', ')}` : '- Competitors: identify 3-5 relevant players'}
${Object.keys(brandQuiz).length > 0 ? `- Brand Quiz Results:\n${JSON.stringify(brandQuiz, null, 2)}` : ''}

## Deliverables

### 1. Industry Trends (visual + messaging)
Current trends in ${industry} branding. Not generic design trends — specific to this industry's audience expectations.

### 2. Competitor Analysis
For each competitor: what visual language they use, what they do well, and where they're vulnerable. If you don't have real data on a competitor, say so — don't fabricate brand audits.

### 3. Color Direction
Recommend a palette direction with psychology rationale. Go beyond "blue = trust." Explain why THIS shade for THIS audience in THIS competitive landscape.

### 4. Shape Language
Geometric (precision/tech), organic (natural/friendly), angular (bold/disruptive), mixed. Tie to brand personality, not trends.

### 5. Brand Direction
Positioning statement, 3-5 personality traits, visual strategy, and 2-3 differentiators that are DEFENSIBLE (not "high quality" — everyone says that).

Respond ONLY with valid JSON:
{
  "industryTrends": ["specific trend"],
  "competitorAnalysis": [{"name": "", "visualLanguage": "", "strengths": [], "weaknesses": []}],
  "colorTheory": {"recommendedPalette": "", "psychologyRationale": "", "moodAssociations": []},
  "shapeLanguage": {"recommendedShapes": [], "rationale": ""},
  "brandDirection": {"positioning": "", "personality": [], "visualStrategy": "", "differentiators": []},
  "rationale": "<how it all ties together>"
}`;
```

**Changes:** Anti-fabrication rule for competitor analysis. "Defensible differentiators" constraint. Industry-specific not generic trends.

---

## Implementation Notes

To apply these rewrites:
1. Each prompt is a drop-in replacement for the existing `prompt` or `const prompt = ...` block in the respective skill file
2. No changes to input/output interfaces, JSON schemas, or function signatures
3. All JSON output schemas remain identical — only the instructional text changes
4. Test: run each skill once and verify JSON parsing still works (the "Respond ONLY with valid JSON" instruction helps)
