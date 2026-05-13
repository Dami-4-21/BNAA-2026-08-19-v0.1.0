import { Type } from "class-transformer";
import { IsDateString, IsNumber, IsOptional, Min } from "class-validator";

export class CreateStatementDto {
  @IsDateString()
  periodMonth!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  retentionPct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  advanceDeduction?: number;
}
