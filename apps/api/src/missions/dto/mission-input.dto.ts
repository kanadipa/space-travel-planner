import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDate,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/** The inputs an agent supplies. Nothing computed appears here, by design. */
export class CreateMissionDto {
  @IsString()
  spacecraftId!: string;

  @IsInt({ message: 'Passenger count must be a whole number.' })
  @Min(1, { message: 'A mission needs at least one passenger.' })
  passengerCount!: number;

  /** Stored in the order the agent chose. Flight order is derived and lives in `legs`. */
  @IsArray()
  @ArrayNotEmpty({ message: 'Choose at least one destination.' })
  @IsString({ each: true })
  destinationIds!: string[];

  @Type(() => Date)
  @IsDate({ message: 'Departure date is not a valid date.' })
  departureDate!: Date;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}

export class EvaluateDto {
  @IsInt({ message: 'Passenger count must be a whole number.' })
  @Min(1, { message: 'A mission needs at least one passenger.' })
  passengerCount!: number;

  @IsArray()
  @ArrayNotEmpty({ message: 'Choose at least one destination.' })
  @IsString({ each: true })
  destinationIds!: string[];

  @Type(() => Date)
  @IsDate({ message: 'Departure date is not a valid date.' })
  departureDate!: Date;

  /** The plan being amended, so the availability check leaves it out of its own check. */
  @IsOptional()
  @IsString()
  editingMissionId?: string;
}

/** Every field optional; the service merges a patch onto the stored mission. */
export class UpdateMissionDto {
  @IsOptional()
  @IsString()
  spacecraftId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  passengerCount?: number;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  destinationIds?: string[];

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  departureDate?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}
