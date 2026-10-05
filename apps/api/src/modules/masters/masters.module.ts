import { Module } from '@nestjs/common';
import { PartsService } from './parts.service';
import { AlloysService } from './alloys.service';
import { DrawingsService } from './drawings.service';
import { ToolsService } from './tools.service';
import { MappingsService } from './mappings.service';
import {
  PartsController, AlloysController, DrawingsController, ToolsController, MappingsController,
} from './masters.controller';

@Module({
  providers: [PartsService, AlloysService, DrawingsService, ToolsService, MappingsService],
  controllers: [
    PartsController, AlloysController, DrawingsController, ToolsController, MappingsController,
  ],
  exports: [PartsService, AlloysService, DrawingsService, ToolsService, MappingsService],
})
export class MastersModule {}
