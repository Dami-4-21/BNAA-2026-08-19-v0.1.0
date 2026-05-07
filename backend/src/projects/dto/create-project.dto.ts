import { IsDateString, IsOptional, IsString } from "class-validator";

export class CreateProjectDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  governorate?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;
}
