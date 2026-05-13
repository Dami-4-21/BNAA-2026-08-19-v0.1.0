import { Type } from "class-transformer";
import { IsDateString, IsNumber, IsOptional, IsUUID, Min } from "class-validator";

export class CreateInvoiceDto {
  @IsUUID()
  statementId!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  tvaRate?: number;
}
