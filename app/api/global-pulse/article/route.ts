import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { NextResponse } from "next/server";

import { decodeEntities } from "@/app/api/_lib/global-pulse/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_HTML_BYTES = 2_500_000;
const MAX_ARTICLE_CHARS = 60_000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 15 * 60 * 1000;

type ArticleReaderPayload = {
  ok: boolean;
  content: string;
  contentKind: "reader" | "source-extract" | "summary";
  wordCount: number;
  cached: boolean;
  error?: string;
};

type CacheEntry = {
  expiresAt: number;
  payload: ArticleReaderPayload;
};

type GlobalArticleReaderCache = typeof globalThis & {
  __stratifyGlobalPulseArticleCache?: Map<string, CacheEntry>;
};

const globalForArticleReader = globalThis as GlobalArticleReaderCache;
const articleCache =
  globalForArticleReader.__stratifyGlobalPulseArticleCache ??
  new Map<string, CacheEntry>();

if (!globalForArticleReader.__stratifyGlobalPulseArticleCache) {
  globalForArticleReader.__stratifyGlobalPulseArticleCache = articleCache;
}

function readableInput(value: unknown, maxLength = MAX_ARTICLE_CHARS) {
  if (typeof value !== "string") return "";

  const text = value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!text || /\[object\s+Object\]/i.test(text)) return "";
  return text.slice(0, maxLength);
}

function isPrivateIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return true;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIpv6(address: string) {
  const normalized = address.toLowerCase().split("%")[0];

  if (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return true;
  }

  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isPrivateIpv4(mapped[1]) : false;
}

function isPrivateAddress(address: string) {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
}

async function assertPublicUrl(value: string) {
  const parsed = new URL(value);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Unsupported article URL protocol.");
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("Private article URL is not allowed.");
  }

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new Error("Private article URL is not allowed.");
    }
    return parsed;
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error("Article host could not be verified as public.");
  }

  return parsed;
}

async function fetchPublicArticle(value: string) {
  let current = await assertPublicUrl(value);

  for (let redirectCount = 0; redirectCount <= 4; redirectCount += 1) {
    const response = await fetch(current, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/json,text/plain;q=0.9,*/*;q=0.5",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36 StratifyGlobalPulse/2.0",
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Publisher returned an invalid redirect.");
      current = await assertPublicUrl(new URL(location, current).toString());
      continue;
    }

    return response;
  }

  throw new Error("Publisher redirected too many times.");
}

async function readLimitedText(response: Response, maxBytes = MAX_HTML_BYTES) {
  if (!response.body) {
    return (await response.text()).slice(0, maxBytes);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let output = "";

  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value?.byteLength) continue;

    const remaining = maxBytes - total;
    const chunk = value.byteLength > remaining ? value.slice(0, remaining) : value;
    total += chunk.byteLength;
    output += decoder.decode(chunk, { stream: true });

    if (value.byteLength > remaining) {
      await reader.cancel();
      break;
    }
  }

  output += decoder.decode();
  return output;
}

function attributeValue(tag: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const quoted = tag.match(
    new RegExp(`\\b${escaped}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"),
  );
  if (quoted?.[2]) return decodeEntities(quoted[2]).trim();

  const unquoted = tag.match(
    new RegExp(`\\b${escaped}\\s*=\\s*([^\\s>]+)`, "i"),
  );
  return unquoted?.[1] ? decodeEntities(unquoted[1]).trim() : "";
}

const BOILERPLATE_LINE = /^(?:skip to|menu|search|share|follow us|subscribe|sign up|log in|login|register|cookie(?:s)?|accept all|manage preferences|privacy(?: policy)?|terms(?: of use)?|contact us|download|print|email|facebook|twitter|linkedin|instagram|youtube|home|read more|read less|back to top)$/i;

const SOCIAL_ONLY_LINE = /^(?:digg|renren|stumbleupon|delicious|sina|weibo|reddit|whatsapp|telegram|pinterest|tumblr|vk|xing|line)$/i;
const NAVIGATION_ONLY_LINE = /^(?:on selection,? highlighted content|charts?\s*&\s*data|news\s*&\s*events|country profiles?|previous editions?|related links?|related content|more on this topic|explore more|quick links?|site map|main navigation|secondary navigation)$/i;
const DECORATION_ONLY_LINE = /^(?:[|¦•·—–-]|\W{1,4})$/;
const KICKER_DATE_LINE = /^(?:brief|press release|news release|feature story|publication|report|statement|speech)\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}$/i;

function comparableText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isDuplicateTitle(line: string, title: string) {
  const normalizedLine = comparableText(line);
  const normalizedTitle = comparableText(title);

  if (!normalizedLine || !normalizedTitle) return false;
  if (normalizedLine === normalizedTitle) return true;

  return (
    normalizedTitle.length >= 28 &&
    (normalizedLine.startsWith(normalizedTitle) ||
      normalizedTitle.startsWith(normalizedLine))
  );
}

function isSubstantialParagraph(line: string) {
  const words = line.split(/\s+/).filter(Boolean).length;
  const sentences = (line.match(/[.!?](?:\s|$)/g) ?? []).length;
  return line.length >= 150 && words >= 24 && sentences >= 1;
}

function looksLikeSectionHeading(line: string) {
  const words = line.split(/\s+/).filter(Boolean);
  if (!line || line.length > 120 || words.length > 16) return false;
  if (/^[•*-]/.test(line) || /[.!?]$/.test(line)) return false;
  if (BOILERPLATE_LINE.test(line) || NAVIGATION_ONLY_LINE.test(line)) return false;

  const letterWords = words.filter((word) => /[A-Za-z]/.test(word));
  const titleCaseWords = letterWords.filter((word) =>
    /^[A-Z][A-Za-z0-9'’&/-]*$/.test(word),
  );

  return (
    letterWords.length > 0 &&
    (titleCaseWords.length / letterWords.length >= 0.55 || line.endsWith(":"))
  );
}

function cleanArticleStructure(value: string, title: string) {
  const rawParagraphs = value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const cleaned: string[] = [];
  let removedLeadingChrome = false;

  for (let index = 0; index < rawParagraphs.length; index += 1) {
    const paragraph = rawParagraphs[index].replace(/^\|\s*/, "").trim();
    const isEarly = index < 18;

    if (
      DECORATION_ONLY_LINE.test(paragraph) ||
      SOCIAL_ONLY_LINE.test(paragraph) ||
      BOILERPLATE_LINE.test(paragraph) ||
      NAVIGATION_ONLY_LINE.test(paragraph) ||
      (isEarly && KICKER_DATE_LINE.test(paragraph)) ||
      (isEarly && isDuplicateTitle(paragraph, title))
    ) {
      if (isEarly) removedLeadingChrome = true;
      continue;
    }

    if (/^(?:share this|share on|social media|bookmark this)/i.test(paragraph)) {
      if (isEarly) removedLeadingChrome = true;
      continue;
    }

    cleaned.push(paragraph);
  }

  if (!cleaned.length) return "";

  if (removedLeadingChrome) {
    const firstBodyIndex = cleaned.findIndex(isSubstantialParagraph);

    if (firstBodyIndex > 0 && firstBodyIndex <= 12) {
      let startIndex = firstBodyIndex;
      const previous = cleaned[firstBodyIndex - 1];

      if (previous && looksLikeSectionHeading(previous)) {
        startIndex = firstBodyIndex - 1;
      }

      cleaned.splice(0, startIndex);
    }
  }

  return cleaned.join("\n\n").slice(0, MAX_ARTICLE_CHARS).trim();
}

function htmlToReadableText(fragment: string) {
  const withoutNoise = fragment
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template|svg|canvas|iframe|form|button|select|textarea)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n• ")
    .replace(/<\/(?:p|div|section|article|main|h[1-6]|blockquote|li|ul|ol|table|tr|figure|figcaption)>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ");

  const decoded = decodeEntities(withoutNoise)
    .replace(/\u200b/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const output: string[] = [];
  const seen = new Set<string>();

  for (const rawLine of decoded.split(/\n+/)) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line || BOILERPLATE_LINE.test(line)) continue;
    if (/^(?:all rights reserved|copyright\s+©?\s*\d{4})/i.test(line)) continue;
    if (/^(?:https?:\/\/|www\.)\S+$/i.test(line)) continue;

    const key = line.toLowerCase();
    if (seen.has(key) && line.length < 180) continue;
    seen.add(key);
    output.push(line);
  }

  return output.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

function collectJsonLdText(value: unknown, output: string[], depth = 0) {
  if (value === null || value === undefined || depth > 8) return;

  if (Array.isArray(value)) {
    value.forEach((entry) => collectJsonLdText(entry, output, depth + 1));
    return;
  }

  if (typeof value !== "object") return;

  const record = value as Record<string, unknown>;
  for (const key of ["articleBody", "text", "description"]) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim().length >= 180) {
      output.push(candidate);
    }
  }

  Object.values(record).forEach((entry) =>
    collectJsonLdText(entry, output, depth + 1),
  );
}

function extractJsonLdCandidates(html: string) {
  const candidates: string[] = [];
  const scripts = html.match(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi,
  ) ?? [];

  for (const script of scripts) {
    const raw = script
      .replace(/^<script\b[^>]*>/i, "")
      .replace(/<\/script>$/i, "")
      .replace(/^\s*<!\[CDATA\[/, "")
      .replace(/\]\]>\s*$/, "")
      .trim();

    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      collectJsonLdText(parsed, candidates);
    } catch {
      const articleBody = raw.match(
        /["']articleBody["']\s*:\s*["']([\s\S]*?)["']\s*(?:,|})/i,
      );
      if (articleBody?.[1]) candidates.push(articleBody[1]);
    }
  }

  return candidates;
}

function extractMetaDescriptions(html: string) {
  const candidates: string[] = [];
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];

  for (const tag of tags) {
    const key = (attributeValue(tag, "property") || attributeValue(tag, "name")).toLowerCase();
    if (!["description", "og:description", "twitter:description"].includes(key)) continue;

    const content = attributeValue(tag, "content");
    if (content.length >= 120) candidates.push(content);
  }

  return candidates;
}

function candidateScore(text: string, bonus = 0) {
  if (!text) return Number.NEGATIVE_INFINITY;

  const paragraphs = text.split(/\n{2,}/).filter(Boolean);
  const sentenceCount = (text.match(/[.!?](?:\s|$)/g) ?? []).length;
  const shortParagraphs = paragraphs.filter((paragraph) => paragraph.length < 45).length;
  const boilerplateHits = (
    text.match(/(?:cookie|subscribe|sign up|follow us|all rights reserved|privacy policy)/gi) ?? []
  ).length;

  return (
    Math.min(text.length, MAX_ARTICLE_CHARS) +
    Math.min(paragraphs.length, 40) * 120 +
    Math.min(sentenceCount, 100) * 18 -
    shortParagraphs * 12 -
    boilerplateHits * 250 +
    bonus
  );
}

function extractHtmlArticle(html: string, title: string) {
  const candidates: Array<{ text: string; bonus: number }> = [];

  for (const value of extractJsonLdCandidates(html)) {
    candidates.push({ text: htmlToReadableText(value), bonus: 8_000 });
  }

  const articleBlocks = html.match(/<article\b[^>]*>[\s\S]*?<\/article>/gi) ?? [];
  articleBlocks.forEach((value) =>
    candidates.push({ text: htmlToReadableText(value), bonus: 6_000 }),
  );

  const mainBlocks = html.match(/<main\b[^>]*>[\s\S]*?<\/main>/gi) ?? [];
  mainBlocks.forEach((value) =>
    candidates.push({ text: htmlToReadableText(value), bonus: 4_000 }),
  );

  const contentMarker = /(?:article|story|news|post|report|press|publication|content)[-_\s]*(?:body|content|text|detail|description)|(?:body|content)[-_\s]*(?:article|story|news|report)/i;
  const containerPattern = /<(div|section)\b([^>]*)>[\s\S]*?<\/\1>/gi;
  let containerMatch: RegExpExecArray | null;
  let inspected = 0;

  while ((containerMatch = containerPattern.exec(html)) && inspected < 240) {
    inspected += 1;
    const attributes = containerMatch[2] ?? "";
    if (!contentMarker.test(attributes)) continue;
    candidates.push({
      text: htmlToReadableText(containerMatch[0]),
      bonus: 3_000,
    });
  }

  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  candidates.push({ text: htmlToReadableText(body), bonus: 0 });

  for (const value of extractMetaDescriptions(html)) {
    candidates.push({ text: htmlToReadableText(value), bonus: -2_000 });
  }

  return candidates
    .map((candidate) => ({
      ...candidate,
      text: cleanArticleStructure(candidate.text, title),
    }))
    .filter((candidate) => candidate.text.length >= 180)
    .sort(
      (a, b) =>
        candidateScore(b.text, b.bonus) - candidateScore(a.text, a.bonus),
    )[0]?.text ?? "";
}

function extractJsonArticle(value: unknown, title: string) {
  const candidates: string[] = [];

  function visit(input: unknown, depth = 0) {
    if (input === null || input === undefined || depth > 8) return;

    if (Array.isArray(input)) {
      input.forEach((entry) => visit(entry, depth + 1));
      return;
    }

    if (typeof input !== "object") return;
    const record = input as Record<string, unknown>;

    for (const key of [
      "articleBody",
      "body",
      "content",
      "fullText",
      "full_text",
      "description",
      "abstract",
      "summary",
    ]) {
      const candidate = record[key];
      if (typeof candidate === "string" && candidate.trim().length >= 180) {
        candidates.push(
          cleanArticleStructure(htmlToReadableText(candidate), title),
        );
      }
    }

    Object.values(record).forEach((entry) => visit(entry, depth + 1));
  }

  visit(value);
  return candidates
    .filter(Boolean)
    .sort((a, b) => candidateScore(b) - candidateScore(a))[0]
    ?.slice(0, MAX_ARTICLE_CHARS) ?? "";
}

function wordCount(value: string) {
  return value ? value.split(/\s+/).filter(Boolean).length : 0;
}

function pruneCache() {
  const now = Date.now();
  articleCache.forEach((entry, key) => {
    if (entry.expiresAt <= now) articleCache.delete(key);
  });
}

export async function POST(request: Request) {
  let fallbackText = "";
  let cacheKey = "";

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const url = readableInput(body.url, 4_000);
    const title = readableInput(body.title, 300);
    fallbackText = readableInput(body.fallbackText, MAX_ARTICLE_CHARS);

    if (!url) {
      return NextResponse.json(
        {
          ok: false,
          content: fallbackText,
          contentKind: fallbackText ? "summary" : "source-extract",
          wordCount: wordCount(fallbackText),
          cached: false,
          error: "Missing article URL.",
        } satisfies ArticleReaderPayload,
        { status: 400 },
      );
    }

    cacheKey = `reader-v3:${url}`;
    pruneCache();
    const cached = articleCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(
        { ...cached.payload, cached: true },
        { headers: { "Cache-Control": "private, max-age=300" } },
      );
    }

    const response = await fetchPublicArticle(url);
    if (!response.ok) {
      throw new Error(`Publisher returned ${response.status}.`);
    }

    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    const sourceText = await readLimitedText(response);

    let extracted = "";
    if (contentType.includes("json") || /^[\s\n]*[\[{]/.test(sourceText)) {
      try {
        extracted = extractJsonArticle(JSON.parse(sourceText), title);
      } catch {
        extracted = "";
      }
    } else if (
      contentType.includes("html") ||
      /<(?:html|article|main|body)\b/i.test(sourceText)
    ) {
      extracted = extractHtmlArticle(sourceText, title);
    } else if (contentType.includes("text/plain")) {
      extracted = readableInput(sourceText, MAX_ARTICLE_CHARS);
    }

    const content =
      extracted.length >= Math.max(360, fallbackText.length + 80)
        ? extracted
        : extracted.length >= 700
          ? extracted
          : fallbackText || extracted;

    const ok = content.length >= 280;
    const payload: ArticleReaderPayload = {
      ok,
      content,
      contentKind: extracted && content === extracted ? "reader" : fallbackText ? "summary" : "source-extract",
      wordCount: wordCount(content),
      cached: false,
      ...(ok
        ? {}
        : {
            error:
              "The publisher did not expose a readable article body to the internal reader.",
          }),
    };

    articleCache.set(cacheKey, {
      expiresAt:
        Date.now() + (ok ? CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS),
      payload,
    });

    return NextResponse.json(payload, {
      status: ok ? 200 : 422,
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch (error) {
    const content = fallbackText;
    const payload: ArticleReaderPayload = {
      ok: content.length >= 280,
      content,
      contentKind: content ? "summary" : "source-extract",
      wordCount: wordCount(content),
      cached: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to load the article inside Stratify.",
    };

    if (cacheKey) {
      articleCache.set(cacheKey, {
        expiresAt: Date.now() + NEGATIVE_CACHE_TTL_MS,
        payload,
      });
    }

    return NextResponse.json(payload, {
      status: payload.ok ? 200 : 502,
      headers: { "Cache-Control": "private, max-age=60" },
    });
  }
}
