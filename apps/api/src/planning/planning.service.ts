import { Injectable } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { evaluate, evaluateFleet, type Evaluation, type Spacecraft } from '../domain';

interface RouteRequest {
  passengerCount: number;
  destinationIds: string[];
}

interface CraftRequest extends RouteRequest {
  spacecraftId: string;
}

/**
 * The single place the domain layer is invoked.
 *
 * Both the live evaluation endpoint and the save path go through here, so a
 * mission can never be persisted with figures the evaluator would not produce.
 */
@Injectable()
export class PlanningService {
  constructor(private readonly catalog: CatalogService) {}

  /** Evaluates the whole fleet against a proposed route. */
  evaluateFleetFor(request: RouteRequest): { anyFeasible: boolean; evaluations: Evaluation[] } {
    const destinations = this.catalog.destinationsByIds(request.destinationIds);

    const evaluations = evaluateFleet(
      this.catalog.allSpacecraft(),
      this.catalog.departure(),
      destinations,
      this.catalog.allBodies(),
      request.passengerCount,
    );

    return { anyFeasible: evaluations.some((e) => e.feasible), evaluations };
  }

  /** Evaluates one named craft. Used on save, where the craft is already chosen. */
  evaluateOne(input: CraftRequest): { evaluation: Evaluation; craft: Spacecraft } {
    const craft = this.catalog.spacecraftById(input.spacecraftId);
    const destinations = this.catalog.destinationsByIds(input.destinationIds);

    return {
      craft,
      evaluation: evaluate(
        craft,
        this.catalog.departure(),
        destinations,
        this.catalog.allBodies(),
        input.passengerCount,
      ),
    };
  }
}
