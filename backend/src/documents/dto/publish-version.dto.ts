import { IsBase64, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class PublishVersionDto {
  @IsString()
  @IsNotEmpty()
  revision!: string;

  @IsString()
  @IsNotEmpty()
  format!: string;

  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @IsOptional()
  @IsString()
  @IsBase64()
  fileBase64?: string;
}
