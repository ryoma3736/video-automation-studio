/**
 * Script Service
 * Handles script processing, normalization, and segmentation
 */

import { Script, Section } from "../types";
import { buildLLMRequest, parseLLMResponse } from "../prompts";
import { v4 as uuidv4 } from "uuid";

/**
 * Create a new script from raw markdown
 */
export function createScript(
  title: string,
  rawMarkdown: string,
  metadata?: { author?: string; tags?: string[] }
): Script {
  return {
    id: uuidv4(),
    title,
    language: "ja",
    raw_markdown: rawMarkdown,
    normalized_markdown: "",
    metadata: {
      author: metadata?.author,
      createdAt: new Date().toISOString(),
      tags: metadata?.tags || [],
    },
  };
}

/**
 * Normalize script using LLM
 * This should be called with an actual LLM client
 */
export async function normalizeScript(
  script: Script,
  llmClient: (prompt: string) => Promise<string>
): Promise<Script> {
  const prompt = buildLLMRequest({
    task: "normalize",
    script_markdown: script.raw_markdown,
  });

  const response = await llmClient(prompt);
  const normalizedMarkdown = parseLLMResponse("normalize", response);

  return {
    ...script,
    normalized_markdown: normalizedMarkdown,
  };
}

/**
 * Segment normalized script into sections using LLM
 */
export async function segmentScript(
  script: Script,
  llmClient: (prompt: string) => Promise<string>
): Promise<Section[]> {
  if (!script.normalized_markdown) {
    throw new Error("Script must be normalized before segmentation");
  }

  const prompt = buildLLMRequest({
    task: "segment",
    script_markdown: script.normalized_markdown,
  });

  const response = await llmClient(prompt);
  const result = parseLLMResponse("segment", response);

  // Ensure sections have proper IDs and references
  return result.sections.map((section: any, index: number) => ({
    ...section,
    id: section.id || `sec-${String(index + 1).padStart(3, "0")}`,
    scriptId: script.id,
    order: index,
  }));
}

/**
 * Load script from storage (stub - implement with actual storage)
 */
export async function loadScript(scriptId: string): Promise<Script | null> {
  // TODO: Implement actual storage retrieval
  throw new Error("Not implemented: loadScript");
}

/**
 * Save script to storage (stub - implement with actual storage)
 */
export async function saveScript(script: Script): Promise<void> {
  // TODO: Implement actual storage persistence
  throw new Error("Not implemented: saveScript");
}

/**
 * List all scripts (stub - implement with actual storage)
 */
export async function listScripts(): Promise<Script[]> {
  // TODO: Implement actual storage listing
  throw new Error("Not implemented: listScripts");
}

/**
 * Delete script (stub - implement with actual storage)
 */
export async function deleteScript(scriptId: string): Promise<void> {
  // TODO: Implement actual storage deletion
  throw new Error("Not implemented: deleteScript");
}
