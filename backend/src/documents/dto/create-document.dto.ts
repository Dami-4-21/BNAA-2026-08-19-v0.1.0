import { IsOptional, IsString } from "class-validator";

export class CreateDocumentDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  phase?: string;

  @IsOptional()
  @IsString()
  docType?: string;
}
