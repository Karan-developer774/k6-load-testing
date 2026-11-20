import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { MetricsAggregator } from './metrics-aggregator.js';
import { redactSensitiveData } from '../security/log-redactor.js';
import { config } from '../config/env.js';

export interface ActiveExecutionProcess {
  executionId: string;
  process: ChildProcess;
  workDir: string;
  aggregator: MetricsAggregator;
  isAborted: boolean;
}

export class K6RunnerService {
  private activeProcesses: Map<string, ActiveExecutionProcess> = new Map();

  public async runK6Test(
    executionId: string,
    scriptContent: string,
    envVars: Record<string, string>,
    aggregator: MetricsAggregator,
    onLog?: (line: string) => void
  ): Promise<{ exitCode: number; summaryJson?: unknown }> {
    // Check concurrency limit
    if (this.activeProcesses.size >= config.maxConcurrentTests) {
      throw new Error(
        `Maximum concurrent test limit reached (${config.maxConcurrentTests}). Please wait for current executions to complete.`
      );
    }

    // Create isolated ephemeral directory
    const workDir = path.join(os.tmpdir(), 'k6_executions', executionId);
    fs.mkdirSync(workDir, { recursive: true });

    const scriptPath = path.join(workDir, 'test.js');
    fs.writeFileSync(scriptPath, scriptContent, 'utf8');

    const metricsOutPath = path.join(workDir, 'metrics.json');
    const summaryJsonPath = path.join(workDir, 'summary.json');

    // Build process environment
    const processEnv: NodeJS.ProcessEnv = {
      ...process.env,
      ...envVars,
    };

    // k6 arguments
    const k6Args = [
      'run',
      '--out',
      `json=${metricsOutPath}`,
      '--summary-export',
      summaryJsonPath,
      '--no-color',
      scriptPath,
    ];

    aggregator.start();

    return new Promise<{ exitCode: number; summaryJson?: unknown }>((resolve, reject) => {
      let isSettled = false;

      const child = spawn(config.k6BinPath, k6Args, {
        cwd: workDir,
        env: processEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const activeExec: ActiveExecutionProcess = {
        executionId,
        process: child,
        workDir,
        aggregator,
        isAborted: false,
      };
      this.activeProcesses.set(executionId, activeExec);

      // Tail and parse real-time NDJSON metrics file
      let fileByteOffset = 0;
      let tailTimer: NodeJS.Timeout | null = null;

      const pollMetricsFile = () => {
        try {
          if (!fs.existsSync(metricsOutPath)) return;
          const stats = fs.statSync(metricsOutPath);
          if (stats.size > fileByteOffset) {
            const stream = fs.createReadStream(metricsOutPath, {
              start: fileByteOffset,
              encoding: 'utf8',
            });

            const rl = readline.createInterface({ input: stream });
            rl.on('line', (line) => {
              if (!line.trim()) return;
              try {
                const metricObj = JSON.parse(line);
                if (metricObj.type === 'Point' && metricObj.metric && metricObj.data) {
                  aggregator.ingestMetric(
                    metricObj.metric,
                    metricObj.data.value,
                    metricObj.data.tags
                  );
                }
              } catch {
                // Ignore incomplete line chunks
              }
            });

            fileByteOffset = stats.size;
          }
        } catch (err) {
          // Ignore read collisions during active file writes
        }
      };

      tailTimer = setInterval(pollMetricsFile, 500);

      // Capture stdout / stderr for logs and real-time terminal output
      child.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        const redacted = redactSensitiveData(text);
        if (onLog) onLog(redacted);
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        const redacted = redactSensitiveData(text);
        if (onLog) onLog(redacted);
      });

      const cleanup = () => {
        if (tailTimer) {
          clearInterval(tailTimer);
          tailTimer = null;
        }
        pollMetricsFile(); // final read
        aggregator.stop();
        this.activeProcesses.delete(executionId);
      };

      child.on('error', (err) => {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        reject(new Error(`Failed to start k6 process: ${err.message}`));
      });

      child.on('close', (code) => {
        if (isSettled) return;
        isSettled = true;
        cleanup();

        let summaryJson: unknown = null;
        if (fs.existsSync(summaryJsonPath)) {
          try {
            summaryJson = JSON.parse(fs.readFileSync(summaryJsonPath, 'utf8'));
          } catch {
            // Summary parse fallback
          }
        }

        // Clean up temporary script and large NDJSON file after run
        try {
          if (fs.existsSync(metricsOutPath)) fs.unlinkSync(metricsOutPath);
        } catch {
          // Ignore cleanup errors
        }

        resolve({
          exitCode: code ?? 0,
          summaryJson,
        });
      });
    });
  }

  public async stopExecution(executionId: string): Promise<boolean> {
    const active = this.activeProcesses.get(executionId);
    if (!active || !active.process) {
      return false;
    }

    active.isAborted = true;

    if (process.platform === 'win32' && active.process.pid) {
      try {
        spawn('taskkill', ['/pid', active.process.pid.toString(), '/T', '/F']);
      } catch {
        active.process.kill('SIGINT');
      }
    } else {
      active.process.kill('SIGINT');
    }

    return true;
  }

  public getActiveExecution(executionId: string): ActiveExecutionProcess | undefined {
    return this.activeProcesses.get(executionId);
  }

  public isRunning(executionId: string): boolean {
    return this.activeProcesses.has(executionId);
  }
}

export const k6Runner = new K6RunnerService();
