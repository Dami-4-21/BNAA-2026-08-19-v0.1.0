import { IsNotEmpty, IsString } from "class-validator";

export class UpdateDocumentDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  discipline!: string;

  @IsString()
  @IsNotEmpty()
  lot!: string;

  @IsString()
  @IsNotEmpty()
  phase!: string;
}
