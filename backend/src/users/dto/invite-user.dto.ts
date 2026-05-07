import { IsEmail, IsIn, IsString } from "class-validator";

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsIn(["MO", "BE", "CP", "CT", "CO", "ADMIN"])
  role!: string;
}
