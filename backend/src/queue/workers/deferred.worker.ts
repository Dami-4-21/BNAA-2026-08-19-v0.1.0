import { QUEUE_NAMES } from "@/queue/queue.constants";

export class DeferredWorker {
  readonly name = "deferred-worker";
  readonly queue = QUEUE_NAMES.deferred;
}
