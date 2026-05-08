import { Type } from "class-transformer";
import {
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

class NcrPhotoAttachmentDto {
  @IsString()
  fileUrl!: string;

  @IsString()
  fileKey!: string;
}

export class CloseNcrDto {
  @IsOptional()
  @IsString()
  evidenceUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NcrPhotoAttachmentDto)
  photos?: NcrPhotoAttachmentDto[];
}
