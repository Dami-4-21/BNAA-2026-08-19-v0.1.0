import { QUEUE_NAMES } from "@/queue/queue.constants";

export class PdfWorker {
  readonly name = "pdf-worker";
  readonly queue = QUEUE_NAMES.pdf;
}
