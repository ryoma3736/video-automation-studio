/**
 * API Server
 * RESTful API for video automation studio
 */

import express, { Request, Response } from "express";
import {
  createScript,
  normalizeScript,
  segmentScript,
} from "../services/scriptService";
import { loadTemplates, planSlides } from "../services/slideService";
import { Script, Section } from "../types";

const app = express();
app.use(express.json());

// In-memory storage (replace with actual database in production)
const scriptsStore = new Map<string, Script>();
const sectionsStore = new Map<string, Section[]>();

/**
 * LLM Client adapter
 * Replace with actual LLM client (OpenAI, Anthropic, etc.)
 */
async function llmClient(prompt: string): Promise<string> {
  // TODO: Implement actual LLM client
  throw new Error("LLM client not configured");
}

/**
 * POST /script/ingest
 * Ingest a new script
 */
app.post("/script/ingest", async (req: Request, res: Response) => {
  try {
    const { title, markdown, author, tags } = req.body;

    if (!title || !markdown) {
      return res.status(400).json({
        error: "Missing required fields: title, markdown",
      });
    }

    const script = createScript(title, markdown, { author, tags });
    scriptsStore.set(script.id, script);

    res.status(201).json({
      success: true,
      script: {
        id: script.id,
        title: script.title,
        createdAt: script.metadata.createdAt,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to ingest script",
      message: error.message,
    });
  }
});

/**
 * POST /script/normalize
 * Normalize a script using LLM
 */
app.post("/script/normalize", async (req: Request, res: Response) => {
  try {
    const { scriptId } = req.body;

    if (!scriptId) {
      return res.status(400).json({
        error: "Missing required field: scriptId",
      });
    }

    const script = scriptsStore.get(scriptId);
    if (!script) {
      return res.status(404).json({
        error: "Script not found",
      });
    }

    const normalizedScript = await normalizeScript(script, llmClient);
    scriptsStore.set(scriptId, normalizedScript);

    res.json({
      success: true,
      scriptId,
      normalized_markdown: normalizedScript.normalized_markdown,
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to normalize script",
      message: error.message,
    });
  }
});

/**
 * POST /script/segment
 * Segment a normalized script into sections
 */
app.post("/script/segment", async (req: Request, res: Response) => {
  try {
    const { scriptId } = req.body;

    if (!scriptId) {
      return res.status(400).json({
        error: "Missing required field: scriptId",
      });
    }

    const script = scriptsStore.get(scriptId);
    if (!script) {
      return res.status(404).json({
        error: "Script not found",
      });
    }

    if (!script.normalized_markdown) {
      return res.status(400).json({
        error: "Script must be normalized before segmentation",
      });
    }

    const sections = await segmentScript(script, llmClient);
    sectionsStore.set(scriptId, sections);

    res.json({
      success: true,
      scriptId,
      sections,
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to segment script",
      message: error.message,
    });
  }
});

/**
 * POST /slides/plan
 * Plan slides from sections
 */
app.post("/slides/plan", async (req: Request, res: Response) => {
  try {
    const { scriptId, templatePath } = req.body;

    if (!scriptId) {
      return res.status(400).json({
        error: "Missing required field: scriptId",
      });
    }

    const sections = sectionsStore.get(scriptId);
    if (!sections) {
      return res.status(404).json({
        error: "Sections not found for script",
      });
    }

    const templates = await loadTemplates(templatePath);
    const slideSpecs = await planSlides(sections, templates, llmClient);

    res.json({
      success: true,
      scriptId,
      specs: slideSpecs,
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to plan slides",
      message: error.message,
    });
  }
});

/**
 * GET /script/:id
 * Get script by ID
 */
app.get("/script/:id", (req: Request, res: Response) => {
  const script = scriptsStore.get(req.params.id);
  if (!script) {
    return res.status(404).json({
      error: "Script not found",
    });
  }

  res.json({
    success: true,
    script,
  });
});

/**
 * GET /sections/:scriptId
 * Get sections for a script
 */
app.get("/sections/:scriptId", (req: Request, res: Response) => {
  const sections = sectionsStore.get(req.params.scriptId);
  if (!sections) {
    return res.status(404).json({
      error: "Sections not found",
    });
  }

  res.json({
    success: true,
    sections,
  });
});

/**
 * GET /health
 * Health check endpoint
 */
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Start server
 */
export function startServer(port: number = 3000): void {
  app.listen(port, () => {
    console.log(`🚀 Video Automation Studio API server running on port ${port}`);
    console.log(`   Health check: http://localhost:${port}/health`);
  });
}

export default app;
