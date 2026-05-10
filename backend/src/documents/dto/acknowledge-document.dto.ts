import { IsNotEmpty, IsString } from "class-validator";

export class AcknowledgeDocumentDto {
  @IsString()
  @IsNotEmpty()
  recipientId!: string;
}
