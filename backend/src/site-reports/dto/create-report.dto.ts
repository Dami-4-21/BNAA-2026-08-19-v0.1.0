import { IsDateString, IsInt, IsOptional, IsString, Min } from "class-validator";

export class CreateReportDto {
  @IsDateString()
  reportDate!: string;

  @IsOptional()
  @IsString()
  weather?: string;

  @IsInt()
  @Min(0)
  workforceCount!: number;

  @IsOptional()
  @IsString()
  activities?: string;
}
