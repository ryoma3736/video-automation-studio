/**
 * API Server
 * RESTful API for video automation studio
 */

import express, { Request, Response } from "express";
import { getDefaultScriptService } from "../services/scriptService";
import { loadTemplates, getDefaultSlideService } from "../services/slideService";
import { getDefaultStorage } from "../services/storageService";
import { logger } from "../utils/logger";

const app = express();
app.use(express.json());

// Initialize services
const storage = getDefaultStorage();
const scriptService = getDefaultScriptService();
const slideService = getDefaultSlideService();

// Initialize storage on startup
storage.initialize().catch((err) => {
  logger.error("Failed to initialize storage", { error: err });
});

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

    await storage.initialize();
    const script = scriptService.createScript(title, markdown, { author, tags });
    await scriptService.saveScript(script);

    return res.status(201).json({
      success: true,
      script: {
        id: script.id,
        title: script.title,
        createdAt: script.metadata.createdAt,
      },
    });
  } catch (error: any) {
    logger.error("Failed to ingest script", { error: error.message });
    return res.status(500).json({
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

    await storage.initialize();
    const script = await scriptService.loadScript(scriptId);
    if (!script) {
      return res.status(404).json({
        error: "Script not found",
      });
    }

    const normalizedScript = await scriptService.normalizeScript(script);

    return res.json({
      success: true,
      scriptId,
      normalized_markdown: normalizedScript.normalized_markdown,
    });
  } catch (error: any) {
    logger.error("Failed to normalize script", { error: error.message });
    return res.status(500).json({
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

    await storage.initialize();
    const script = await scriptService.loadScript(scriptId);
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

    const sections = await scriptService.segmentScript(script);

    return res.json({
      success: true,
      scriptId,
      sections,
    });
  } catch (error: any) {
    logger.error("Failed to segment script", { error: error.message });
    return res.status(500).json({
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

    await storage.initialize();
    const sections = await scriptService.loadSections(scriptId);
    if (!sections) {
      return res.status(404).json({
        error: "Sections not found for script",
      });
    }

    const templates = await loadTemplates(templatePath);
    const slideSpecs = await slideService.planSlides(scriptId, sections, templates);

    return res.json({
      success: true,
      scriptId,
      specs: slideSpecs,
    });
  } catch (error: any) {
    logger.error("Failed to plan slides", { error: error.message });
    return res.status(500).json({
      error: "Failed to plan slides",
      message: error.message,
    });
  }
});

/**
 * GET /script/:id
 * Get script by ID
 */
app.get("/script/:id", async (req: Request, res: Response) => {
  try {
    await storage.initialize();
    const script = await scriptService.loadScript(req.params.id);
    if (!script) {
      return res.status(404).json({
        error: "Script not found",
      });
    }

    return res.json({
      success: true,
      script,
    });
  } catch (error: any) {
    logger.error("Failed to get script", { error: error.message });
    return res.status(500).json({
      error: "Failed to get script",
      message: error.message,
    });
  }
});

/**
 * GET /sections/:scriptId
 * Get sections for a script
 */
app.get("/sections/:scriptId", async (req: Request, res: Response) => {
  try {
    await storage.initialize();
    const sections = await scriptService.loadSections(req.params.scriptId);
    if (!sections) {
      return res.status(404).json({
        error: "Sections not found",
      });
    }

    return res.json({
      success: true,
      sections,
    });
  } catch (error: any) {
    logger.error("Failed to get sections", { error: error.message });
    return res.status(500).json({
      error: "Failed to get sections",
      message: error.message,
    });
  }
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
