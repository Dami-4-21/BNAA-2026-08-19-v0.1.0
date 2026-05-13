import { IsIn } from "class-validator";

export class UpdateInvoiceStatusDto {
  @IsIn(["draft", "issued", "litigious", "project_validation", "client_validation", "validated"])
  status!:
    | "client_validation"
    | "draft"
    | "issued"
    | "litigious"
    | "project_validation"
    | "validated";
}
