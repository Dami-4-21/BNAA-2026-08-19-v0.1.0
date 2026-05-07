import { IsIn, IsString } from "class-validator";

export class UpdateRoleDto {
  @IsString()
  @IsIn(["MO", "BE", "CP", "CT", "CO", "ADMIN"])
  role!: string;
}
