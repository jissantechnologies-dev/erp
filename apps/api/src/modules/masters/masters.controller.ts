import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  partSchema, partUpdateSchema, partQuerySchema,
  alloySchema, alloyUpdateSchema, alloyQuerySchema,
  drawingSchema, drawingRevisionSchema, drawingQuerySchema,
  toolSchema, toolUpdateSchema, toolQuerySchema,
  partMappingSchema, partMappingUpdateSchema, partMappingQuerySchema,
} from '@erp/shared';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { zodBody } from '../../common/pipes/zod-validation.pipe';
import { PartsService } from './parts.service';
import { AlloysService } from './alloys.service';
import { DrawingsService } from './drawings.service';
import { ToolsService } from './tools.service';
import { MappingsService } from './mappings.service';

/* ------------------------------- Part Master ------------------------------ */

@ApiTags('masters/parts')
@Controller('masters/parts')
export class PartsController {
  constructor(private readonly parts: PartsService) {}

  @Get()
  @RequirePermissions('masters:read')
  @ApiOperation({ summary: 'Part register, with status facets for the filter chips' })
  list(@Query(zodBody(partQuerySchema)) query: never) {
    return this.parts.list(query);
  }

  @Get(':id')
  @RequirePermissions('masters:read')
  @ApiOperation({ summary: 'One part by id or part number, with all detail tabs' })
  findOne(@Param('id') id: string) {
    return this.parts.findOne(id);
  }

  @Post()
  @RequirePermissions('masters:create')
  create(@Body(zodBody(partSchema)) dto: never) {
    return this.parts.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('masters:update')
  update(@Param('id') id: string, @Body(zodBody(partUpdateSchema)) dto: never) {
    return this.parts.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('masters:delete')
  @ApiOperation({ summary: 'Marks the part Obsolete; parts are never hard-deleted' })
  archive(@Param('id') id: string) {
    return this.parts.archive(id);
  }
}

/* ---------------------------- Material / Alloy ---------------------------- */

@ApiTags('masters/alloys')
@Controller('masters/alloys')
export class AlloysController {
  constructor(private readonly alloys: AlloysService) {}

  @Get()
  @RequirePermissions('masters:read')
  list(@Query(zodBody(alloyQuerySchema)) query: never) {
    return this.alloys.list(query);
  }

  @Get(':id')
  @RequirePermissions('masters:read')
  @ApiOperation({ summary: 'Grade with chemistry limits, mechanicals and charge guide' })
  findOne(@Param('id') id: string) {
    return this.alloys.findOne(id);
  }

  @Post()
  @RequirePermissions('masters:create')
  create(@Body(zodBody(alloySchema)) dto: never) {
    return this.alloys.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('masters:update')
  update(@Param('id') id: string, @Body(zodBody(alloyUpdateSchema)) dto: never) {
    return this.alloys.update(id, dto);
  }
}

/* --------------------------- Drawing Revision ----------------------------- */

@ApiTags('masters/drawings')
@Controller('masters/drawings')
export class DrawingsController {
  constructor(private readonly drawings: DrawingsService) {}

  @Get()
  @RequirePermissions('masters:read')
  @ApiOperation({ summary: 'Drawing register — one row per drawing, showing its current revision' })
  list(@Query(zodBody(drawingQuerySchema)) query: never) {
    return this.drawings.list(query);
  }

  @Get(':id')
  @RequirePermissions('masters:read')
  findOne(@Param('id') id: string) {
    return this.drawings.findOne(id);
  }

  @Post()
  @RequirePermissions('masters:create')
  create(@Body(zodBody(drawingSchema)) dto: never) {
    return this.drawings.create(dto);
  }

  @Post(':id/revisions')
  @RequirePermissions('masters:update')
  @ApiOperation({ summary: 'Add a revision; supersedes the current one atomically' })
  addRevision(@Param('id') id: string, @Body(zodBody(drawingRevisionSchema)) dto: never) {
    return this.drawings.addRevision(id, dto);
  }

  @Post(':id/revisions/:revisionId/approve')
  @RequirePermissions('masters:approve')
  @ApiOperation({ summary: 'Release a pending revision and return the part to Released' })
  approve(@Param('id') id: string, @Param('revisionId') revisionId: string) {
    return this.drawings.approveRevision(id, revisionId);
  }
}

/* ------------------------ Pattern / Die / Tool ---------------------------- */

@ApiTags('masters/tools')
@Controller('masters/tools')
export class ToolsController {
  constructor(private readonly tools: ToolsService) {}

  @Get()
  @RequirePermissions('masters:read')
  list(@Query(zodBody(toolQuerySchema)) query: never) {
    return this.tools.list(query);
  }

  @Get(':id')
  @RequirePermissions('masters:read')
  findOne(@Param('id') id: string) {
    return this.tools.findOne(id);
  }

  @Post()
  @RequirePermissions('masters:create')
  create(@Body(zodBody(toolSchema)) dto: never) {
    return this.tools.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('masters:update')
  update(@Param('id') id: string, @Body(zodBody(toolUpdateSchema)) dto: never) {
    return this.tools.update(id, dto);
  }

  @Post(':id/shots')
  @RequirePermissions('masters:update')
  @ApiOperation({ summary: 'Record shots after a run; auto-flags Maintenance Due at 85% life' })
  recordShots(@Param('id') id: string, @Body() body: { shots: number }) {
    return this.tools.recordShots(id, Number(body?.shots));
  }
}

/* ------------------------ Customer Part Mapping --------------------------- */

@ApiTags('masters/mappings')
@Controller('masters/mappings')
export class MappingsController {
  constructor(private readonly mappings: MappingsService) {}

  @Get()
  @RequirePermissions('masters:read')
  list(@Query(zodBody(partMappingQuerySchema)) query: never) {
    return this.mappings.list(query);
  }

  @Get(':id')
  @RequirePermissions('masters:read')
  findOne(@Param('id') id: string) {
    return this.mappings.findOne(id);
  }

  @Post()
  @RequirePermissions('masters:create')
  create(@Body(zodBody(partMappingSchema)) dto: never) {
    return this.mappings.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('masters:update')
  update(@Param('id') id: string, @Body(zodBody(partMappingUpdateSchema)) dto: never) {
    return this.mappings.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('masters:delete')
  remove(@Param('id') id: string) {
    return this.mappings.remove(id);
  }
}
