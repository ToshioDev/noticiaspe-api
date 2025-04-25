import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PublicacionesModule } from './publicaciones/publicaciones.module';

@Module({
  imports: [PublicacionesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
