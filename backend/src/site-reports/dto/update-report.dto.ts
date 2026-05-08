import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { WeatherCode } from "@prisma/client";

class ReportWorkforceLineDto {
  @IsString()
  role!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  count!: number;
}

class ReportProgressItemDto {
  @IsString()
  lot!: string;

  @IsString()
  task!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  progress!: number;
}

class ReportIncidentDto {
  @IsString()
  type!: string;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  @IsString()
  action?: string;
}

export class UpdateReportDto {
  @IsOptional()
  @IsEnum(WeatherCode)
  weather?: WeatherCode;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  workforceCount?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportWorkforceLineDto)
  workforceBreakdown?: ReportWorkforceLineDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportProgressItemDto)
  progressByLot?: ReportProgressItemDto[];

  @IsOptional()
  @IsString()
  activities?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportIncidentDto)
  incidents?: ReportIncidentDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
