/**
 * Storage Service
 * File system-based storage for scripts, sections, slides, and render jobs
 */

import * as fs from "fs/promises";
import * as path from "path";
import { Script, Section, SlideSpec, RenderJob } from "../types";
import { logger } from "../utils/logger";

/**
 * Storage paths configuration
 */
export interface StorageConfig {
  baseDir: string;
  scriptsDir: string;
  sectionsDir: string;
  slidesDir: string;
  renderJobsDir: string;
  outputDir: string;
}

/**
 * Default storage configuration
 */
export function getDefaultStorageConfig(): StorageConfig {
  const baseDir = process.env.STORAGE_BASE_DIR || path.join(process.cwd(), "data");
  return {
    baseDir,
    scriptsDir: path.join(baseDir, "scripts"),
    sectionsDir: path.join(baseDir, "sections"),
    slidesDir: path.join(baseDir, "slides"),
    renderJobsDir: path.join(baseDir, "render-jobs"),
    outputDir: path.join(baseDir, "output"),
  };
}

/**
 * Storage Service Class
 */
export class StorageService {
  private config: StorageConfig;

  constructor(config?: StorageConfig) {
    this.config = config || getDefaultStorageConfig();
  }

  /**
   * Initialize storage directories
   */
  async initialize(): Promise<void> {
    const dirs = [
      this.config.baseDir,
      this.config.scriptsDir,
      this.config.sectionsDir,
      this.config.slidesDir,
      this.config.renderJobsDir,
      this.config.outputDir,
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }

    logger.info("Storage initialized", { config: this.config });
  }

  /**
   * Script storage methods
   */
  async saveScript(script: Script): Promise<void> {
    const filePath = path.join(this.config.scriptsDir, `${script.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(script, null, 2), "utf-8");
    logger.debug("Script saved", { scriptId: script.id, path: filePath });
  }

  async loadScript(scriptId: string): Promise<Script | null> {
    const filePath = path.join(this.config.scriptsDir, `${scriptId}.json`);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content) as Script;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async listScripts(): Promise<Script[]> {
    const files = await fs.readdir(this.config.scriptsDir);
    const scripts: Script[] = [];

    for (const file of files) {
      if (file.endsWith(".json")) {
        const scriptId = path.basename(file, ".json");
        const script = await this.loadScript(scriptId);
        if (script) {
          scripts.push(script);
        }
      }
    }

    return scripts.sort((a, b) => 
      new Date(b.metadata.createdAt).getTime() - new Date(a.metadata.createdAt).getTime()
    );
  }

  async deleteScript(scriptId: string): Promise<void> {
    const filePath = path.join(this.config.scriptsDir, `${scriptId}.json`);
    try {
      await fs.unlink(filePath);
      logger.debug("Script deleted", { scriptId });
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  /**
   * Section storage methods
   */
  async saveSections(scriptId: string, sections: Section[]): Promise<void> {
    const filePath = path.join(this.config.sectionsDir, `${scriptId}.json`);
    await fs.writeFile(filePath, JSON.stringify({ sections }, null, 2), "utf-8");
    logger.debug("Sections saved", { scriptId, count: sections.length });
  }

  async loadSections(scriptId: string): Promise<Section[] | null> {
    const filePath = path.join(this.config.sectionsDir, `${scriptId}.json`);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(content);
      return data.sections as Section[];
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  /**
   * Slide spec storage methods
   */
  async saveSlideSpecs(scriptId: string, specs: SlideSpec[]): Promise<string> {
    const filePath = path.join(this.config.slidesDir, `${scriptId}.json`);
    await fs.writeFile(filePath, JSON.stringify({ specs }, null, 2), "utf-8");
    logger.debug("Slide specs saved", { scriptId, count: specs.length });
    return filePath;
  }

  async loadSlideSpecs(scriptId: string): Promise<SlideSpec[] | null> {
    const filePath = path.join(this.config.slidesDir, `${scriptId}.json`);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(content);
      return data.specs as SlideSpec[];
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  /**
   * Render job storage methods
   */
  async saveRenderJob(job: RenderJob): Promise<void> {
    const filePath = path.join(this.config.renderJobsDir, `${job.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(job, null, 2), "utf-8");
    logger.debug("Render job saved", { jobId: job.id, status: job.status });
  }

  async loadRenderJob(jobId: string): Promise<RenderJob | null> {
    const filePath = path.join(this.config.renderJobsDir, `${jobId}.json`);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content) as RenderJob;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async listRenderJobs(scriptId?: string): Promise<RenderJob[]> {
    const files = await fs.readdir(this.config.renderJobsDir);
    const jobs: RenderJob[] = [];

    for (const file of files) {
      if (file.endsWith(".json")) {
        const jobId = path.basename(file, ".json");
        const job = await this.loadRenderJob(jobId);
        if (job && (!scriptId || job.scriptId === scriptId)) {
          jobs.push(job);
        }
      }
    }

    return jobs.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async updateRenderJob(jobId: string, updates: Partial<RenderJob>): Promise<void> {
    const job = await this.loadRenderJob(jobId);
    if (!job) {
      throw new Error(`Render job not found: ${jobId}`);
    }

    const updatedJob: RenderJob = {
      ...job,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.saveRenderJob(updatedJob);
  }

  /**
   * Output file methods
   */
  async saveOutputFile(filename: string, content: Buffer | string): Promise<string> {
    const filePath = path.join(this.config.outputDir, filename);
    if (Buffer.isBuffer(content)) {
      await fs.writeFile(filePath, content);
    } else {
      await fs.writeFile(filePath, content, "utf-8");
    }
    logger.debug("Output file saved", { filename, path: filePath });
    return filePath;
  }

  async getOutputPath(filename: string): Promise<string> {
    return path.join(this.config.outputDir, filename);
  }
}

/**
 * Default storage service instance
 */
let defaultStorage: StorageService | null = null;

export function getDefaultStorage(): StorageService {
  if (!defaultStorage) {
    defaultStorage = new StorageService();
  }
  return defaultStorage;
}

/**
 * Reset default storage (useful for testing)
 */
export function resetDefaultStorage(): void {
  defaultStorage = null;
}
