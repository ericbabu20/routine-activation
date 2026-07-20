// RAG retrieval (PRD §24). Embeds the member's query, then fetches a small
// number of relevant chunks from the vector store. Permission filtering happens
// IN THE DATABASE (match_rag_documents only returns public docs or docs owned by
// the requesting member) so one member can never retrieve another's content.
// Only approved unstructured content is embedded — never raw customer records.
import { admin } from "../supabase.js";
import { embedText, isConfigured } from "./gemini.js";

/**
 * Retrieve relevant approved chunks for a query.
 * @param {string} query
 * @param {string} userId  verified member id (for owner-scoped docs)
 * @param {{ contentTypes?: string[], limit?: number }} opts
 * @returns {Promise<Array<{id,source,title,content_type,content,similarity}>>}
 */
export async function retrieve(query, userId, opts = {}) {
  if (!isConfigured() || !query) return [];
  const embedding = await embedText(query);
  if (!embedding) return [];

  // Over-fetch a little, then apply optional content-type narrowing + a
  // relevance floor so we only pass genuinely useful context to Gemini.
  const { data, error } = await admin.rpc("match_rag_documents", {
    query_embedding: embedding,
    match_count: Math.max(opts.limit || 5, 8),
    p_user: userId,
  });
  if (error) {
    console.error("match_rag_documents failed", error);
    return [];
  }
  let rows = data || [];
  if (opts.contentTypes?.length) rows = rows.filter((r) => opts.contentTypes.includes(r.content_type));
  rows = rows.filter((r) => (r.similarity ?? 0) > 0.35);
  return rows.slice(0, opts.limit || 5);
}

/** Distinct source labels to surface with an answer (PRD §24, §25). */
export function sourceLabels(chunks) {
  const seen = new Map();
  for (const c of chunks) {
    const key = `${c.source}:${c.title}`;
    if (!seen.has(key)) seen.set(key, { source: c.source, title: c.title });
  }
  return [...seen.values()];
}
