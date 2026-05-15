import { QUEUE_NAMES } from "@/queue/queue.constants";

export class EmailWorker {
  readonly name = "email-worker";
  readonly queue = QUEUE_NAMES.email;
}
