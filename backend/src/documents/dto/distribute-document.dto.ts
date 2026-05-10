import { IsNotEmpty, IsString } from "class-validator";

export class DistributeDocumentDto {
  @IsString()
  @IsNotEmpty()
  audience!: string;
}
