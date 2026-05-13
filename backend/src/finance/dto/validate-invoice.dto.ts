import { IsIn, IsOptional } from "class-validator";

export class ValidateInvoiceDto {
  @IsOptional()
  @IsIn(["project", "client"])
  stage?: "project" | "client";
}
