/**
 * Document Classifier
 *
 * Uses Ollama to classify a document into a type for skill routing.
 */
import { chat } from "./ollama-client";

export interface Classification {
  type: string;
  subtype: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
}

const CLASSIFIER_PROMPT = `You are a legal document classifier. Given a document's text and filename, classify it into exactly one type.

Types:
- contract: Agreements, MSAs, SaaS agreements, vendor agreements, employment agreements, leases, partnership agreements, LOIs, amendments, SOWs
- nda: Non-disclosure agreements, confidentiality agreements, mutual NDAs
- pleading: Complaints, motions, briefs, petitions, answers, orders, judgments
- correspondence: Letters, emails, memos, notices
- discovery: Interrogatories, depositions, requests for production, subpoenas
- corporate: Bylaws, resolutions, articles of incorporation, operating agreements, minutes
- regulatory: Compliance filings, regulatory submissions, audit reports, policies
- unknown: Cannot determine

Respond with ONLY a JSON object (no markdown, no explanation):
{"type": "contract", "subtype": "master_services_agreement", "confidence": "high", "reasoning": "Document contains defined terms, mutual obligations, payment terms, and termination provisions typical of an MSA"}`;

export async function classifyDocument(
  docText: string,
  filename: string
): Promise<Classification> {
  // Use first ~2000 chars for classification (enough to identify doc type)
  const sample = docText.slice(0, 3000);

  const response = await chat(
    [
      { role: "system", content: CLASSIFIER_PROMPT },
      {
        role: "user",
        content: `Classify this document.\n\nFilename: ${filename}\n\n---\n\n${sample}`,
      },
    ],
    { temperature: 0.1, num_ctx: 4096 }
  );

  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = response.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    }
    return JSON.parse(jsonStr);
  } catch {
    return {
      type: "unknown",
      subtype: "unclassified",
      confidence: "low",
      reasoning: "Failed to parse classifier response",
    };
  }
}
