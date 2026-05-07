import { Controller, Get } from "@nestjs/common";

@Controller("finance")
export class FinanceModuleController {
  @Get("_scaffold")
  scaffold() {
    return {
      mode: "scaffold",
      area: "finance",
    };
  }
}
