import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator";
import { NcrSeverity } from "@prisma/client";

class NcrPhotoAttachmentDto {
  @IsString()
  fileUrl!: string;

  @IsString()
  fileKey!: string;
}

export class CreateNcrDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(NcrSeverity)
  severity?: NcrSeverity;

  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsString()
  evidenceUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NcrPhotoAttachmentDto)
  photos?: NcrPhotoAttachmentDto[];
}
