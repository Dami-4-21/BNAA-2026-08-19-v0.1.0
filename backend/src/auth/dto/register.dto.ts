import { IsEmail, IsString, MinLength } from "class-validator";

export class RegisterDto {
  @IsString()
  tenantName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  fullName!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
