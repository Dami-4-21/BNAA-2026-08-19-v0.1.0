import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import Redis, { type RedisOptions } from "ioredis";

import { QUEUE_NAMES, type QueueName } from "@/queue/queue.constants";
import type {
  DeferredWorkQueuePayload,
  EmailQueuePayload,
  PdfQueuePayload,
  QueueDispatchResult,
  QueueEnqueueInput,
  ReminderQueuePayload,
} from "@/queue/queue.types";

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly redisUrl: string;
  private readonly queueBrokerEnabled: boolean;
  private readonly connections = new Map<QueueName, Redis>();
  private readonly queues = new Map<QueueName, Queue>();

  constructor(private readonly configService: ConfigService) {
    this.redisUrl = this.configService.get<string>("REDIS_URL", "").trim();
    this.queueBrokerEnabled =
      this.redisUrl.length > 0 &&
      this.configService.get<string>("QUEUE_BROKER_ENABLED", "false").toLowerCase() === "true";
  }

  isQueueBrokerEnabled() {
    return this.queueBrokerEnabled;
  }

  async enqueueEmailJob(
    jobName: string,
    payload: EmailQueuePayload,
    input: { jobId?: string } = {},
  ) {
    return this.enqueue({
      jobId: input.jobId,
      jobName,
      payload,
      queue: QUEUE_NAMES.email,
    });
  }

  async enqueuePdfJob(
    jobName: string,
    payload: PdfQueuePayload,
    input: { jobId?: string } = {},
  ) {
    return this.enqueue({
      jobId: input.jobId,
      jobName,
      payload,
      queue: QUEUE_NAMES.pdf,
    });
  }

  async enqueueReminderJob(
    jobName: string,
    payload: ReminderQueuePayload,
    input: { jobId?: string } = {},
  ) {
    return this.enqueue({
      jobId: input.jobId,
      jobName,
      payload,
      queue: QUEUE_NAMES.reminder,
    });
  }

  async enqueueDeferredJob(
    jobName: string,
    payload: DeferredWorkQueuePayload,
    input: { jobId?: string } = {},
  ) {
    return this.enqueue({
      jobId: input.jobId,
      jobName,
      payload,
      queue: QUEUE_NAMES.deferred,
    });
  }

  async onModuleDestroy() {
    await Promise.all(
      [...this.queues.values()].map(async (queue) => {
        try {
          await queue.close();
        } catch (error) {
          this.logger.warn(`Queue close failed: ${this.toErrorMessage(error)}`);
        }
      }),
    );

    await Promise.all(
      [...this.connections.values()].map(async (connection) => {
        try {
          await connection.quit();
        } catch (error) {
          this.logger.warn(`Redis quit failed: ${this.toErrorMessage(error)}`);
          try {
            connection.disconnect();
          } catch {
            // noop
          }
        }
      }),
    );
  }

  private async enqueue<TPayload>(
    input: QueueEnqueueInput<TPayload>,
  ): Promise<QueueDispatchResult> {
    if (!this.queueBrokerEnabled) {
      return {
        mode: "disabled",
        queue: input.queue,
        jobName: input.jobName,
        reason: "QUEUE_BROKER_ENABLED is false or REDIS_URL is missing.",
      };
    }

    try {
      const queue = await this.getQueue(input.queue);
      const job = await queue.add(input.jobName, input.payload, {
        removeOnComplete: 100,
        removeOnFail: 100,
        ...input.options,
        jobId: input.jobId ?? input.options?.jobId,
      });

      return {
        mode: "queued",
        queue: input.queue,
        jobId: String(job.id ?? input.jobId ?? ""),
        jobName: input.jobName,
      };
    } catch (error) {
      this.logger.warn(
        `Queue enqueue failed for ${input.queue}/${input.jobName}: ${this.toErrorMessage(error)}`,
      );

      return {
        mode: "disabled",
        queue: input.queue,
        jobName: input.jobName,
        reason: this.toErrorMessage(error),
      };
    }
  }

  private async getQueue(queueName: QueueName) {
    const existingQueue = this.queues.get(queueName);
    if (existingQueue) {
      return existingQueue;
    }

    const connection = await this.getConnection(queueName);
    const queue = new Queue(queueName, {
      connection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    });

    this.queues.set(queueName, queue);
    return queue;
  }

  private async getConnection(queueName: QueueName) {
    const existingConnection = this.connections.get(queueName);
    if (existingConnection) {
      return existingConnection;
    }

    const options: RedisOptions = {
      connectTimeout: 1000,
      enableOfflineQueue: false,
      enableReadyCheck: false,
      lazyConnect: true,
      maxRetriesPerRequest: null,
      retryStrategy: () => null,
    };

    const connection = new Redis(this.redisUrl, options);

    try {
      await connection.connect();
    } catch (error) {
      try {
        connection.disconnect();
      } catch {
        // noop
      }
      this.logger.warn(
        `Redis connection failed for queue ${queueName}: ${this.toErrorMessage(error)}`,
      );
      throw error;
    }

    this.connections.set(queueName, connection);
    return connection;
  }

  private toErrorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
