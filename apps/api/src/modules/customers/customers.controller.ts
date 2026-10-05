import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { zodBody } from '../../common/pipes/zod-validation.pipe';
import { customerSchema, customerUpdateSchema, customerQuerySchema } from '@erp/shared';
import { CustomersService } from './customers.service';

@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermissions('sales:read')
  list(@Query(zodBody(customerQuerySchema)) query: never) {
    return this.customers.list(query);
  }

  /** Declared before :id so "options" is not captured as an id. */
  @Get('options')
  @RequirePermissions('masters:read')
  @ApiOperation({ summary: 'id/code/name only — populates the customer <select> on forms' })
  options() {
    return this.customers.options();
  }

  @Get(':id')
  @RequirePermissions('sales:read')
  findOne(@Param('id') id: string) {
    return this.customers.findOne(id);
  }

  @Post()
  @RequirePermissions('sales:create')
  create(@Body(zodBody(customerSchema)) dto: never) {
    return this.customers.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('sales:update')
  update(@Param('id') id: string, @Body(zodBody(customerUpdateSchema)) dto: never) {
    return this.customers.update(id, dto);
  }
}
