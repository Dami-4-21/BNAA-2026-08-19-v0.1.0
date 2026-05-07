import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import cookieParser from "cookie-parser";

import { AppModule } from "@/app.module";
import { PrismaService } from "@/database/prisma.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      credentials: true,
      origin: true,
    },
  });
  const configService = app.get(ConfigService);
  const prismaService = app.get(PrismaService);

  app.setGlobalPrefix("api/v1");
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: true,
    }),
  );

  await prismaService.enableShutdownHooks(app);
  await app.listen(configService.get<number>("PORT", 4000));
}

void bootstrap();
