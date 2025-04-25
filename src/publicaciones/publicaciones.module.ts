import { Module } from '@nestjs/common';
import { PublicacionesController } from './publicaciones.controller';

@Module({
  controllers: [PublicacionesController],
})
export class PublicacionesModule {}
