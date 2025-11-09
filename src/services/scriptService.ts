/**
 * Script Service
 * Handles script processing, normalization, and segmentation
 */

import { Script, Section } from "../types";
import { buildLLMRequest, parseLLMResponse } from "../prompts";
import { v4 as uuidv4 } from "uuid";
import { LLMClient, getDefaultLLMClient } from "./llmService";
import { StorageService, getDefaultStorage } from "./storageService";
import { logger } from "../utils/logger";

/**
 * Script Service Class
 */
export class ScriptService {
  private llmClient: LLMClient;
  private storage: StorageService;

  constructor(llmClient?: LLMClient, storage?: StorageService) {
    this.llmClient = llmClient || getDefaultLLMClient();
    this.storage = storage || getDefaultStorage();
  }

  /**
   * Create a new script from raw markdown
   */
  createScript(
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
   */
  async normalizeScript(script: Script): Promise<Script> {
    logger.info("Normalizing script", { scriptId: script.id });
    
    const prompt = buildLLMRequest({
      task: "normalize",
      script_markdown: script.raw_markdown,
    });

    const response = await this.llmClient.complete(prompt);
    const normalizedMarkdown = parseLLMResponse("normalize", response);

    const normalized = {
      ...script,
      normalized_markdown: normalizedMarkdown,
    };

    await this.storage.saveScript(normalized);
    logger.info("Script normalized", { scriptId: script.id });

    return normalized;
  }

  /**
   * Segment normalized script into sections using LLM
   */
  async segmentScript(script: Script): Promise<Section[]> {
    if (!script.normalized_markdown) {
      throw new Error("Script must be normalized before segmentation");
    }

    logger.info("Segmenting script", { scriptId: script.id });

    const prompt = buildLLMRequest({
      task: "segment",
      script_markdown: script.normalized_markdown,
    });

    const response = await this.llmClient.complete(prompt);
    const result = parseLLMResponse("segment", response);

    // Ensure sections have proper IDs and references
    const sections = result.sections.map((section: any, index: number) => ({
      ...section,
      id: section.id || `sec-${String(index + 1).padStart(3, "0")}`,
      scriptId: script.id,
      order: index,
    }));

    await this.storage.saveSections(script.id, sections);
    logger.info("Script segmented", { scriptId: script.id, sectionCount: sections.length });

    return sections;
  }

  /**
   * Load script from storage
   */
  async loadScript(scriptId: string): Promise<Script | null> {
    return await this.storage.loadScript(scriptId);
  }

  /**
   * Save script to storage
   */
  async saveScript(script: Script): Promise<void> {
    await this.storage.saveScript(script);
  }

  /**
   * List all scripts
   */
  async listScripts(): Promise<Script[]> {
    return await this.storage.listScripts();
  }

  /**
   * Delete script
   */
  async deleteScript(scriptId: string): Promise<void> {
    await this.storage.deleteScript(scriptId);
  }

  /**
   * Load sections for a script
   */
  async loadSections(scriptId: string): Promise<Section[] | null> {
    return await this.storage.loadSections(scriptId);
  }
}

/**
 * Default script service instance
 */
let defaultScriptService: ScriptService | null = null;

export function getDefaultScriptService(): ScriptService {
  if (!defaultScriptService) {
    defaultScriptService = new ScriptService();
  }
  return defaultScriptService;
}

/**
 * Reset default script service (useful for testing)
 */
export function resetDefaultScriptService(): void {
  defaultScriptService = null;
}

/**
 * Legacy function exports (for backward compatibility)
 */
export function createScript(
  title: string,
  rawMarkdown: string,
  metadata?: { author?: string; tags?: string[] }
): Script {
  const service = getDefaultScriptService();
  return service.createScript(title, rawMarkdown, metadata);
}

export async function normalizeScript(
  script: Script,
  _llmClient?: (prompt: string) => Promise<string>
): Promise<Script> {
  const service = getDefaultScriptService();
  return await service.normalizeScript(script);
}

export async function segmentScript(
  script: Script,
  _llmClient?: (prompt: string) => Promise<string>
): Promise<Section[]> {
  const service = getDefaultScriptService();
  return await service.segmentScript(script);
}

export async function loadScript(scriptId: string): Promise<Script | null> {
  const service = getDefaultScriptService();
  return await service.loadScript(scriptId);
}

export async function saveScript(script: Script): Promise<void> {
  const service = getDefaultScriptService();
  return await service.saveScript(script);
}

export async function listScripts(): Promise<Script[]> {
  const service = getDefaultScriptService();
  return await service.listScripts();
}

export async function deleteScript(scriptId: string): Promise<void> {
  const service = getDefaultScriptService();
  return await service.deleteScript(scriptId);
}
