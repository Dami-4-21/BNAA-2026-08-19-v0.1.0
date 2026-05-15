import { QUEUE_NAMES } from "@/queue/queue.constants";

export class ReminderWorker {
  readonly name = "reminder-worker";
  readonly queue = QUEUE_NAMES.reminder;
}
