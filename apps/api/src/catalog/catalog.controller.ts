import { Controller, Get } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  /** Bodies an agent may pick, plus the ones excluded and why. */
  @Get('planets')
  planets() {
    return {
      departure: this.catalog.departure(),
      destinations: this.catalog.destinations(),
      excluded: this.catalog.excluded(),
    };
  }

  @Get('spacecraft')
  spacecraft() {
    return this.catalog.allSpacecraft();
  }
}
