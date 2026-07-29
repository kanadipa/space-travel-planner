import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { CreateMissionDto, UpdateMissionDto } from './dto/mission-input.dto';
import { MissionsService } from './missions.service';

@Controller('missions')
export class MissionsController {
  constructor(private readonly missions: MissionsService) {}

  /** Listed as well as fetchable by reference, so a lost code is not a dead end. */
  @Get()
  list() {
    return this.missions.list();
  }

  @Get('reference/:reference')
  getByReference(@Param('reference') reference: string) {
    return this.missions.getByReference(reference.toUpperCase());
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.missions.get(id);
  }

  @Post()
  create(@Body() body: CreateMissionDto) {
    return this.missions.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateMissionDto) {
    return this.missions.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.missions.remove(id);
  }
}
