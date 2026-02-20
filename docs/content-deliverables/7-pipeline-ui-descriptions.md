# Deliverable 7: Pipeline UI Descriptions

## Format per pipeline:
```
title: Display name
icon: Emoji
tagline: One-liner (max 80 chars) — shown on pipeline card
description: 2-3 sentences — shown on expanded pipeline view
input_labels: Human-readable labels for each input field
input_placeholders: Example content for each input
input_helpers: Contextual help text below each field
output_preview: What the user sees while waiting + after completion
```

---

## 1. Content Repurpose

```yaml
title: Repurpose Content
icon: 📝
tagline: "One post → content for every platform"
description: "Paste a blog post, article, or transcript. The operator analyzes it for key themes, quotable moments, and hooks — then generates platform-native content for Twitter, LinkedIn, Instagram, and more. Every piece is ready to post."

inputs:
  content:
    label: "Source Content"
    placeholder: "Paste your content here — blog post, article, transcript, or any long-form text..."
    helper: "Minimum ~200 words for good results. Longer content = more angles to work with."
  platforms:
    label: "Target Platforms"
    placeholder: "Twitter, LinkedIn, Instagram"
    helper: "Select which platforms to generate content for. Each gets a custom version."
  focus:
    label: "Focus Angle (optional)"
    placeholder: "e.g. focus on the AI automation angle"
    helper: "Narrow the output to a specific theme. Leave blank to let the operator choose the best angles."

output_preview:
  loading: "Analyzing content → Extracting hooks → Generating {platform_count} platform versions..."
  complete: "Generated {count} deliverables across {platform_count} platforms"
  card_format: "Show each platform as a card with content preview, character count, and copy button"
```

---

## 2. SEO Blog

```yaml
title: SEO Blog Generator
icon: 📊
tagline: "Keyword → researched, written, optimized article"
description: "Enter a topic and optional keywords. The operator researches the SERP landscape, identifies content gaps, creates an optimized outline, then writes the full article with proper meta tags, schema markup, and keyword targeting."

inputs:
  topic:
    label: "Blog Topic"
    placeholder: "e.g. How AI transforms content marketing for small teams"
    helper: "Be specific. 'AI marketing' → generic article. 'How AI transforms content marketing for small teams' → targeted article that can rank."
  keywords:
    label: "Target Keywords"
    placeholder: "AI marketing, content automation, ROI"
    helper: "Comma-separated. Leave blank to auto-detect from topic. Primary keyword should be first."
  word_count:
    label: "Target Word Count"
    placeholder: "1500"
    helper: "1,000-1,500 for quick posts. 2,000-3,000 for pillar content. Top-ranking articles in most niches are 1,500-2,500 words."
  style:
    label: "Article Style"
    placeholder: "informational"
    helper: "Options: informational (how-to, explainer), commercial (product comparison), opinion (thought piece), tutorial (step-by-step)"

output_preview:
  loading: "Researching SERP → Building outline → Writing article → Optimizing SEO..."
  complete: "Generated {word_count}-word article | SEO score: {score}/100 | Reading time: {reading_time} min"
  card_format: "Show article with rendered markdown, collapsible SEO score card, and meta tag preview"
```

---

## 3. Content Calendar

```yaml
title: Content Calendar
icon: 📅
tagline: "Themes → full posting schedule with ready content"
description: "Set your timeframe, platforms, and themes. The operator builds a day-by-day content calendar with complete posts — not placeholders. Each post has optimal timing, hashtags, and media prompts."

inputs:
  days:
    label: "Calendar Duration"
    placeholder: "7"
    helper: "Number of days to plan. 7 for weekly, 14 for biweekly, 30 for monthly. Longer calendars = more tokens."
  platforms:
    label: "Platforms"
    placeholder: "Twitter, LinkedIn, Instagram"
    helper: "Each platform gets posts tailored to its format and audience behavior."
  themes:
    label: "Content Themes"
    placeholder: "product launch, thought leadership, engagement"
    helper: "Comma-separated. 2-4 specific themes work best. The operator mixes them across the calendar."
  posts_per_day:
    label: "Posts Per Platform Per Day"
    placeholder: "1"
    helper: "1-2 recommended for most brands. More than 3 risks audience fatigue."

output_preview:
  loading: "Planning strategy → Generating {days}-day calendar → Writing {total_posts} posts..."
  complete: "Generated {total_posts} posts across {days} days on {platform_count} platforms"
  card_format: "Calendar grid view with day columns. Click a day to expand all posts. Each post shows platform icon, time, content preview, and copy button."
```

---

## 4. Brand Identity

```yaml
title: Brand Identity
icon: 🎨
tagline: "Industry → complete brand direction and visual system"
description: "Enter your industry and competitors. The operator researches current branding trends, analyzes competitor visual language, and produces a full brand direction — color theory, typography, shape language, positioning, and personality."

inputs:
  industry:
    label: "Industry"
    placeholder: "e.g. B2B SaaS for developer tools"
    helper: "Be specific about your niche. 'Technology' is too broad. 'Developer productivity tools for remote teams' gives much better results."
  competitors:
    label: "Competitors"
    placeholder: "Linear, Notion, Figma"
    helper: "Comma-separated. We'll analyze their visual language and find differentiation opportunities."
  brand_quiz:
    label: "Brand Personality (optional)"
    placeholder: '{"personality": "bold and technical", "audience": "CTOs and engineering leads"}'
    helper: "JSON with any brand personality inputs. Guides the direction toward your target identity."

output_preview:
  loading: "Researching industry trends → Analyzing competitors → Building brand direction..."
  complete: "Brand direction complete: {trend_count} trends analyzed, {competitor_count} competitors reviewed"
  card_format: "Sections: Industry Trends, Competitor Matrix, Color Palette (with swatches), Shape Language, Brand Direction Summary"
```

---

## 5. Ad Variations

```yaml
title: Ad Variations
icon: 🎯
tagline: "One product photo → headline and layout variations"
description: "Upload a product image. The operator analyzes it, generates multiple ad headlines, and suggests layout variations optimized for different placements — feed ads, stories, banners."

inputs:
  source_asset:
    label: "Product Image"
    placeholder: "Upload or paste image URL"
    helper: "High-res product photo works best. The operator will suggest crops and layouts for each ad format."
  target_platforms:
    label: "Ad Platforms"
    placeholder: "Facebook, Instagram, Google Display"
    helper: "Each platform has different aspect ratios and headline limits."
  product_description:
    label: "Product Description"
    placeholder: "Wireless noise-canceling headphones with 40-hour battery life"
    helper: "One sentence about the product. Helps generate relevant headlines."

output_preview:
  loading: "Analyzing image → Generating headlines → Creating layout variations..."
  complete: "Generated {count} ad variations across {platform_count} platforms"
  card_format: "Grid of ad mockups with headline overlays. Click to see full specs and download."
```

---

## 6. Infographic

```yaml
title: Infographic Generator
icon: 📈
tagline: "Raw data → visual concepts and infographic layouts"
description: "Provide data points or a data-heavy article. The operator extracts key statistics, suggests visual metaphors, and generates infographic layout concepts with section breakdowns and copy."

inputs:
  source_data:
    label: "Data Source"
    placeholder: "Paste data, statistics, or a data-rich article..."
    helper: "Tables, bullet points, or raw text with numbers. The operator extracts and visualizes the most compelling data points."
  style:
    label: "Visual Style"
    placeholder: "minimal, dark theme"
    helper: "Options: minimal, corporate, playful, data-heavy, editorial. Matches your brand visual settings."

output_preview:
  loading: "Extracting data points → Choosing visual metaphors → Building layout..."
  complete: "Infographic concept ready: {section_count} sections, {data_point_count} data points visualized"
  card_format: "Section-by-section layout preview with copy, data points, and suggested visual for each block."
```

---

## 7. Visual Metadata

```yaml
title: Visual Metadata
icon: 🏷️
tagline: "Batch images → SEO alt-text and accessibility tags"
description: "Upload images in bulk. The operator generates SEO-optimized alt text, captions, tags, and accessibility descriptions for each one. Essential for web content, e-commerce, and ADA compliance."

inputs:
  images:
    label: "Images"
    placeholder: "Upload images or paste URLs (one per line)"
    helper: "Supports JPG, PNG, WebP. Process up to 50 images per batch."
  context:
    label: "Content Context (optional)"
    placeholder: "e.g. These are product photos for our spring collection"
    helper: "Helps the operator write more relevant and specific alt text."

output_preview:
  loading: "Analyzing {count} images → Generating metadata..."
  complete: "Generated metadata for {count} images: alt text, captions, and tags"
  card_format: "Image grid with generated alt-text below each. Click to see full metadata. Bulk export as CSV or JSON."
```

---

## Pipeline Card Component Spec

```tsx
interface PipelineCard {
  id: string;
  title: string;
  icon: string;
  tagline: string;         // Shown on card face
  description: string;     // Shown on expanded view
  costEstimate: string;    // e.g. "~5-20 cost units"
  avgDuration: string;     // e.g. "30-60 seconds"
  inputs: PipelineInput[];
  isPopular?: boolean;     // Show "Popular" badge
}

// Display order on Pipelines page:
// 1. Content Repurpose (Popular)
// 2. SEO Blog (Popular)
// 3. Content Calendar (Popular)
// 4. Brand Identity
// 5. Ad Variations
// 6. Infographic
// 7. Visual Metadata
```
