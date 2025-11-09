/**
 * Render Job Service
 * Manages video rendering jobs and their lifecycle
 */

import { RenderJob } from "../types";
import { StorageService, getDefaultStorage } from "./storageService";
import { logger } from "../utils/logger";
import { v4 as uuidv4 } from "uuid";
import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";

const execAsync = promisify(exec);

export interface RenderJobOptions {
  scriptId: string;
  slideSpecPath?: string;
  remotionEntry?: string;
  quality?: "low" | "medium" | "high";
  format?: "mp4" | "webm";
}

/**
 * Render Job Service Class
 */
export class RenderJobService {
  private storage: StorageService;

  constructor(storage?: StorageService) {
    this.storage = storage || getDefaultStorage();
  }

  /**
   * Create a new render job
   */
  async createRenderJob(options: RenderJobOptions): Promise<RenderJob> {
    const job: RenderJob = {
      id: uuidv4(),
      scriptId: options.scriptId,
      slideSpecPath: options.slideSpecPath || "",
      remotionEntry: options.remotionEntry || "Video",
      status: "queued",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.storage.saveRenderJob(job);
    logger.info("Render job created", { jobId: job.id, scriptId: options.scriptId });

    return job;
  }

  /**
   * Start rendering a job
   */
  async startRenderJob(jobId: string): Promise<void> {
    const job = await this.storage.loadRenderJob(jobId);
    if (!job) {
      throw new Error(`Render job not found: ${jobId}`);
    }

    if (job.status !== "queued") {
      throw new Error(`Render job is not queued: ${job.status}`);
    }

    await this.storage.updateRenderJob(jobId, {
      status: "running",
    });

    logger.info("Render job started", { jobId });

    // Execute rendering in background
    this.executeRender(job).catch((error) => {
      logger.error("Render execution failed", { jobId, error: error.message });
      this.failRenderJob(jobId, error.message);
    });
  }

  /**
   * Execute the actual rendering process
   */
  private async executeRender(job: RenderJob): Promise<void> {
    try {
      logger.info("Executing render", { jobId: job.id });

      // Define output paths
      const outputDir = path.join(
        process.env.STORAGE_BASE_DIR || "./data",
        "output"
      );
      const videoPath = path.join(outputDir, `${job.scriptId}.mp4`);
      const thumbPath = path.join(outputDir, `${job.scriptId}-thumb.png`);

      // Check if Remotion is available
      const remotionCheck = await this.checkRemotionAvailable();
      if (!remotionCheck) {
        throw new Error(
          "Remotion is not installed. Run: npm install -g @remotion/cli"
        );
      }

      // Construct Remotion render command
      // Assumes a Remotion project exists in ./remotion directory
      const remotionProjectPath = path.join(process.cwd(), "remotion");
      const command = `npx remotion render ${job.remotionEntry} ${videoPath} --props='{"scriptId":"${job.scriptId}"}'`;

      logger.info("Running Remotion command", { command });

      const { stdout, stderr } = await execAsync(command, {
        cwd: remotionProjectPath,
        timeout: 600000, // 10 minutes timeout
      });

      if (stderr) {
        logger.warn("Remotion stderr", { stderr });
      }

      logger.info("Remotion render complete", { stdout });

      // Generate thumbnail from video (using ffmpeg if available)
      await this.generateThumbnail(videoPath, thumbPath);

      // Mark job as complete
      await this.completeRenderJob(job.id, { videoPath, thumbPath });
    } catch (error: any) {
      throw new Error(`Render execution failed: ${error.message}`);
    }
  }

  /**
   * Check if Remotion is available
   */
  private async checkRemotionAvailable(): Promise<boolean> {
    try {
      await execAsync("npx remotion --version");
      return true;
    } catch (error) {
      logger.warn("Remotion not available");
      return false;
    }
  }

  /**
   * Generate thumbnail from video
   */
  private async generateThumbnail(
    videoPath: string,
    thumbPath: string
  ): Promise<void> {
    try {
      // Use ffmpeg to extract frame at 1 second
      const command = `ffmpeg -i "${videoPath}" -ss 00:00:01 -vframes 1 "${thumbPath}" -y`;
      await execAsync(command);
      logger.info("Thumbnail generated", { thumbPath });
    } catch (error: any) {
      logger.warn("Thumbnail generation failed", { error: error.message });
      // Don't fail the job if thumbnail generation fails
    }
  }

  /**
   * Get render job status
   */
  async getRenderJobStatus(jobId: string): Promise<RenderJob | null> {
    return await this.storage.loadRenderJob(jobId);
  }

  /**
   * List render jobs
   */
  async listRenderJobs(scriptId?: string): Promise<RenderJob[]> {
    return await this.storage.listRenderJobs(scriptId);
  }

  /**
   * Cancel a render job
   */
  async cancelRenderJob(jobId: string): Promise<void> {
    const job = await this.storage.loadRenderJob(jobId);
    if (!job) {
      throw new Error(`Render job not found: ${jobId}`);
    }

    if (job.status === "done" || job.status === "failed") {
      throw new Error(`Cannot cancel job in ${job.status} status`);
    }

    await this.storage.updateRenderJob(jobId, {
      status: "failed",
      error: "Job cancelled by user",
    });

    logger.info("Render job cancelled", { jobId });
  }

  /**
   * Complete a render job
   */
  async completeRenderJob(
    jobId: string,
    outputs: { videoPath: string; thumbPath: string }
  ): Promise<void> {
    await this.storage.updateRenderJob(jobId, {
      status: "done",
      outputs,
    });

    logger.info("Render job completed", { jobId, outputs });
  }

  /**
   * Fail a render job
   */
  async failRenderJob(jobId: string, error: string): Promise<void> {
    await this.storage.updateRenderJob(jobId, {
      status: "failed",
      error,
    });

    logger.error("Render job failed", { jobId, error });
  }
}

/**
 * Default render job service instance
 */
let defaultRenderJobService: RenderJobService | null = null;

export function getDefaultRenderJobService(): RenderJobService {
  if (!defaultRenderJobService) {
    defaultRenderJobService = new RenderJobService();
  }
  return defaultRenderJobService;
}

/**
 * Reset default render job service (useful for testing)
 */
export function resetDefaultRenderJobService(): void {
  defaultRenderJobService = null;
}
