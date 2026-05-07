import { IsString, MinLength } from "class-validator";

export class AcceptInviteDto {
  @IsString()
  token!: string;

  @IsString()
  fullName!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
