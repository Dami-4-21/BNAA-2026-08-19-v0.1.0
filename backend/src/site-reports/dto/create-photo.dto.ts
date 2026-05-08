import { Type } from "class-transformer";
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export class CreatePhotoDto {
  @IsOptional()
  @IsUUID()
  reportId?: string;

  @IsString()
  fileUrl!: string;

  @IsString()
  fileKey!: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  gpsLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  gpsLng?: number;

  @IsOptional()
  @IsString()
  locationLabel?: string;

  @IsOptional()
  @IsString()
  taskTag?: string;

  @IsOptional()
  @IsDateString()
  takenAt?: string;
}
