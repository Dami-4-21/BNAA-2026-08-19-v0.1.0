import { IsDateString } from "class-validator";

export class CreateStatementDto {
  @IsDateString()
  periodMonth!: string;
}
