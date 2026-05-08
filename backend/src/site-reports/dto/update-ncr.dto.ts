import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";
import { NcrSeverity, NcrStatus } from "@prisma/client";

export class UpdateNcrDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(NcrSeverity)
  severity?: NcrSeverity;

  @IsOptional()
  @IsEnum(NcrStatus)
  status?: NcrStatus;

  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsString()
  evidenceUrl?: string;
}
